// RimTown - sim-society.js：從 simulation.js 拆出的 派系、節慶、人生目標、城鎮身分、生老病死、探險、世代傳承（v6.1.0 B14）。
// 純粹搬移頂層宣告，共用全域詞法範圍；載入順序：sim-agent → sim-conversation → sim-town → sim-economy → sim-society → simulation(World) → sim-systems（index.html／rimtown.php／sw.js 都要列）。
// --- Faction / Social Circle System ---
const FACTION_TYPES = {
    work_buddies:  { name:t('工作夥伴'), icon:'🔨', maxSize:5, formCondition:'sameJob' },
    drinking_pals: { name:t('酒友'), icon:'🍺', maxSize:6, formCondition:'tavernRegulars' },
    gossip_circle: { name:t('八卦圈'), icon:'🗣️', maxSize:5, formCondition:'gossipTraits' },
    scholars:      { name:t('學者聯盟'), icon:'📚', maxSize:4, formCondition:'intellectual' },
    romantics:     { name:t('戀愛同盟'), icon:'💕', maxSize:4, formCondition:'romanticTraits' },
    troublemakers: { name:t('搗蛋鬼'), icon:'😈', maxSize:4, formCondition:'abrasiveTraits' },
    elders_council:{ name:t('長者議會'), icon:'🧓', maxSize:5, formCondition:'olderAgents' },
    night_owls:    { name:t('夜貓族'), icon:'🦉', maxSize:5, formCondition:'nightOwlTraits' },
};

class Faction {
    constructor(id, type, founderName) {
        this.id = id;
        this.type = type; // key from FACTION_TYPES
        this.name = FACTION_TYPES[type]?.name || type;
        this.icon = FACTION_TYPES[type]?.icon || '👥';
        this.members = []; // agentId[]
        this.founderName = founderName;
        this.formedTick = 0;
        this.cohesion = 50; // 0-100, how united the group is
        this.rivalFactionId = null; // rival faction
        this.allyFactionId = null;  // allied faction
    }
    addMember(agentId) {
        if (!this.members.includes(agentId)) this.members.push(agentId);
    }
    removeMember(agentId) {
        this.members = this.members.filter(id => id !== agentId);
    }
    hasMember(agentId) { return this.members.includes(agentId); }
    get size() { return this.members.length; }
}

class FactionSystem {
    constructor() {
        this.factions = {}; // id -> Faction
        this._counter = 0;
        this._daysSinceCheck = 0;
    }

    dailyUpdate(world) {
        this._daysSinceCheck++;
        if (this._daysSinceCheck < 3) return; // check every 3 days
        this._daysSinceCheck = 0;

        this._dedupeFactions(); // v5.35.2 合併同型重複派系(舊版允許同名×2,顯示成兩個「學者聯盟」)
        this._tryFormFactions(world);
        this._updateCohesion(world);
        this._tryFactionEvents(world);
        this._cleanupDeadFactions(world);
    }

    // v5.35.2 同型派系名字相同,重複存在會顯示成兩個同名派系;合併成一個(保留較早的,成員取聯集)
    _dedupeFactions() {
        const byType = {};
        for (const [id, f] of Object.entries(this.factions)) {
            const kept = byType[f.type];
            if (kept) {
                f.members.forEach(m => kept.addMember(m));
                delete this.factions[id];
            } else {
                byType[f.type] = f;
            }
        }
    }

    _tryFormFactions(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        const existingTypes = Object.values(this.factions).map(f => f.type);

        for (const [type, def] of Object.entries(FACTION_TYPES)) {
            if (existingTypes.includes(type)) continue; // v5.35.2 同型派系最多 1 個(同名重複會讓玩家混亂)

            let candidates = [];
            switch (def.formCondition) {
                case 'sameJob': {
                    const jobGroups = {};
                    npcs.forEach(a => { if (a.job) { (jobGroups[a.job.key] = jobGroups[a.job.key] || []).push(a); } });
                    for (const group of Object.values(jobGroups)) {
                        if (group.length >= 2) { candidates = group.slice(0, def.maxSize); break; }
                    }
                    break;
                }
                case 'tavernRegulars': {
                    candidates = npcs.filter(a => {
                        const socialCount = a.memory.entries.filter(m => (m.content || '').includes(t('酒')) || (m.content || '').includes('tavern')).length;
                        return socialCount > 0 || a.personality.traits.includes('glutton') || a.personality.traits.includes('charismatic');
                    }).slice(0, def.maxSize);
                    break;
                }
                case 'gossipTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('gossip') || a.personality.traits.includes('charismatic')).slice(0, def.maxSize);
                    break;
                case 'intellectual':
                    candidates = npcs.filter(a => a.personality.values.includes('知識') || a.job?.category === 'intellectual').slice(0, def.maxSize);
                    break;
                case 'romanticTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('romantic') || a.personality.traits.includes('kind')).slice(0, def.maxSize);
                    break;
                case 'abrasiveTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('abrasive') || a.personality.traits.includes('lazy')).slice(0, def.maxSize);
                    break;
                case 'olderAgents':
                    candidates = npcs.filter(a => a.age >= 40).slice(0, def.maxSize);
                    break;
                case 'nightOwlTraits':
                    candidates = npcs.filter(a => a.personality.traits.includes('night_owl')).slice(0, def.maxSize);
                    break;
            }

            if (candidates.length >= 2 && Math.random() < 0.3) {
                // Check members not already in too many factions
                const filtered = candidates.filter(a => {
                    const factionCount = Object.values(this.factions).filter(f => f.hasMember(a.agentId)).length;
                    return factionCount < 2; // max 2 factions per NPC
                });
                if (filtered.length >= 2) {
                    const faction = new Faction(`faction_${++this._counter}`, type, filtered[0].name);
                    faction.formedTick = world.tickCount;
                    filtered.forEach(a => faction.addMember(a.agentId));
                    this.factions[faction.id] = faction;
                    const memberNames = filtered.map(a => a.name).join(t('、'));
                    world.logMessage('faction', `${faction.icon} ${memberNames}${t('組成了「')}${faction.name}${t('」！')}`, filtered[0].name);
                    filtered.forEach(a => {
                        a.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('我加入了「')}${faction.name}${t('」，成員有')}${memberNames}${t('。')}`, 6, filtered.map(x => x.name));
                        // Boost mutual affinity (scaled by personality compatibility)
                        filtered.forEach(b => {
                            if (a.agentId !== b.agentId) {
                                const factionCompat = Personality.compatibility(a.personality.traits, b.personality.traits);
                                const rel = a.relationships.getOrCreate(b.agentId, b.name);
                                rel.modifyAffinity(Math.round(randInt(2, 5) * factionCompat));
                                rel.modifyTrust(Math.round(randInt(1, 3) * factionCompat));
                            }
                        });
                    });
                }
            }
        }
    }

    _updateCohesion(world) {
        for (const faction of Object.values(this.factions)) {
            // Cohesion based on average mutual affinity
            let totalAffinity = 0, pairCount = 0;
            for (let i = 0; i < faction.members.length; i++) {
                for (let j = i + 1; j < faction.members.length; j++) {
                    const a = world.agents[faction.members[i]];
                    const b = world.agents[faction.members[j]];
                    if (a && b) {
                        const rel = a.relationships.getOrCreate(b.agentId, b.name);
                        totalAffinity += rel.affinity;
                        pairCount++;
                    }
                }
            }
            if (pairCount > 0) {
                const avgAff = totalAffinity / pairCount;
                faction.cohesion = Math.max(0, Math.min(100, 50 + avgAff));
            }

            // Members with very low affinity to others may leave
            for (const memberId of [...faction.members]) {
                const agent = world.agents[memberId];
                if (!agent) { faction.removeMember(memberId); continue; }
                const otherMembers = faction.members.filter(id => id !== memberId);
                const avgAff = otherMembers.reduce((sum, otherId) => {
                    const other = world.agents[otherId];
                    if (!other) return sum;
                    return sum + agent.relationships.getOrCreate(otherId, other.name).affinity;
                }, 0) / Math.max(1, otherMembers.length);
                if (avgAff < -30 && Math.random() < 0.2) {
                    faction.removeMember(memberId);
                    world.logMessage('faction', `${agent.name}${t('退出了「')}${faction.name}${t('」。')}`, agent.name);
                    agent.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('我退出了「')}${faction.name}${t('」，我受不了他們了。')}`, 5, []);
                }
            }
        }
    }

    _tryFactionEvents(world) {
        const factionList = Object.values(this.factions).filter(f => f.size >= 2);
        if (factionList.length < 2 || Math.random() > 0.15) return;

        // Pick two factions for interaction
        const [fA, fB] = shuffle(factionList).slice(0, 2);
        const roll = Math.random();

        if (roll < 0.4) {
            // Conflict between factions
            if (fA.rivalFactionId === fB.id || Math.random() < 0.3) {
                fA.rivalFactionId = fB.id;
                fB.rivalFactionId = fA.id;
                const eventDesc = pickRandom([
                    `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」在鎮上爆發了爭執！')}`,
                    `${t('「')}${fA.name}${t('」的成員公開批評「')}${fB.name}${t('」。')}`,
                    `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」因為意見不合發生衝突。')}`,
                ]);
                world.logMessage('faction', eventDesc);
                world.events.conversationTopics.push(eventDesc);
                // Damage cross-faction relationships
                fA.members.forEach(aId => {
                    fB.members.forEach(bId => {
                        const a = world.agents[aId], b = world.agents[bId];
                        if (a && b) {
                            a.relationships.getOrCreate(bId, b.name).modifyAffinity(randInt(-5, -2));
                            b.relationships.getOrCreate(aId, a.name).modifyAffinity(randInt(-5, -2));
                        }
                    });
                });
                fA.members.forEach(aId => { const a = world.agents[aId]; if (a) a.moodModifier = (a.moodModifier || 0) - 5; });
                fB.members.forEach(bId => { const b = world.agents[bId]; if (b) b.moodModifier = (b.moodModifier || 0) - 5; });
            }
        } else if (roll < 0.7) {
            // Cooperation between factions
            fA.allyFactionId = fB.id;
            fB.allyFactionId = fA.id;
            if (fA.rivalFactionId === fB.id) { fA.rivalFactionId = null; fB.rivalFactionId = null; }
            const eventDesc = pickRandom([
                `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」決定攜手合作！')}`,
                `${t('「')}${fA.name}${t('」邀請「')}${fB.name}${t('」一起舉辦活動。')}`,
                `${t('「')}${fA.name}${t('」和「')}${fB.name}${t('」化敵為友，達成共識。')}`,
            ]);
            world.logMessage('faction', eventDesc);
            // Boost cross-faction relationships
            fA.members.forEach(aId => {
                fB.members.forEach(bId => {
                    const a = world.agents[aId], b = world.agents[bId];
                    if (a && b) {
                        a.relationships.getOrCreate(bId, b.name).modifyAffinity(randInt(2, 5));
                        b.relationships.getOrCreate(aId, a.name).modifyAffinity(randInt(2, 5));
                    }
                });
            });
            fA.members.forEach(aId => { const a = world.agents[aId]; if (a) a.moodModifier = (a.moodModifier || 0) + 3; });
            fB.members.forEach(bId => { const b = world.agents[bId]; if (b) b.moodModifier = (b.moodModifier || 0) + 3; });
        } else {
            // Internal faction drama
            const faction = pickRandom([fA, fB]);
            if (faction.size >= 3 && Math.random() < 0.4) {
                const members = faction.members.map(id => world.agents[id]).filter(Boolean);
                const [instigator, target] = shuffle(members).slice(0, 2);
                const drama = pickRandom([
                    `${instigator.name}${t('在「')}${faction.name}${t('」聚會中公開指責')}${target.name}${t('！')}`,
                    `${instigator.name}${t('和')}${target.name}${t('在「')}${faction.name}${t('」內鬧不愉快。')}`,
                    `${t('「')}${faction.name}${t('」內部出現分裂，')}${instigator.name}${t('帶頭反對')}${target.name}${t('。')}`,
                ]);
                world.logMessage('faction', drama, instigator.name, target.name);
                instigator.relationships.getOrCreate(target.agentId, target.name).modifyAffinity(randInt(-8, -3));
                target.relationships.getOrCreate(instigator.agentId, instigator.name).modifyAffinity(randInt(-6, -2));
                faction.cohesion = Math.max(0, faction.cohesion - 10);
                world.gossipNetwork.activeGossip.push({
                    about: instigator.name, content: drama, source: t('鎮民'),
                    spreadCount: 0, tickCreated: world.tickCount, isTrue: true
                });
            }
        }
    }

    _cleanupDeadFactions(world) {
        for (const [id, faction] of Object.entries(this.factions)) {
            // Remove members no longer in the world
            faction.members = faction.members.filter(mId => world.agents[mId]);
            if (faction.size < 2) {
                if (faction.size === 1) {
                    const lastAgent = world.agents[faction.members[0]];
                    if (lastAgent) {
                        world.logMessage('faction', `${t('「')}${faction.name}${t('」因人數不足而解散。')}`, lastAgent.name);
                    }
                }
                delete this.factions[id];
            }
        }
    }

    getAgentFactions(agentId) {
        return Object.values(this.factions).filter(f => f.hasMember(agentId));
    }

    toDict() {
        return {
            factions: Object.fromEntries(Object.entries(this.factions).map(([k, f]) => [k, {
                id: f.id, type: f.type, name: f.name, icon: f.icon,
                members: [...f.members], founderName: f.founderName,
                formedTick: f.formedTick, cohesion: f.cohesion,
                rivalFactionId: f.rivalFactionId, allyFactionId: f.allyFactionId,
            }])),
            _counter: this._counter,
            _daysSinceCheck: this._daysSinceCheck,
        };
    }
}

// --- Seasonal Festival System ---
const FESTIVALS = {
    '春季': {
        day: 8, name: t('春祭'), icon: '🌸',
        description: t('慶祝新生與播種的季節！全城一起祈禱豐收。'),
        effects: { mood_all: 15, social_boost: 20, conversation_topic: t('春祭慶典') },
        activities: [t('舞龍舞獅'), t('花車遊行'), t('種下許願樹'), t('分享春餅')],
        questName: t('採集春花'), questDesc: t('在城外採集100朵春花裝飾廣場。'),
    },
    '夏季': {
        day: 10, name: t('豐收前夜祭'), icon: '🔥',
        description: t('仲夏夜的篝火慶典，居民圍著篝火講故事。'),
        effects: { mood_all: 12, social_boost: 15, conversation_topic: t('仲夏篝火') },
        activities: [t('篝火晚會'), t('說故事比賽'), t('夜間市集'), t('放煙火')],
        questName: t('收集木材'), questDesc: t('收集足夠的木材來搭建巨型篝火。'),
    },
    '秋季': {
        day: 12, name: t('秋收節'), icon: '🍂',
        description: t('感謝大地豐收！全城分享收成的喜悅。'),
        effects: { mood_all: 18, food_bonus: 50, conversation_topic: t('秋收慶典') },
        activities: [t('豐收宴席'), t('農產品比賽'), t('秋收舞會'), t('感恩祭祀')],
        questName: t('豐收祭品'), questDesc: t('準備最好的農產品作為祭品。'),
    },
    '冬季': {
        day: 7, name: t('冬至慶典'), icon: '❄️',
        description: t('最長的夜晚，居民們互相取暖、交換禮物。'),
        effects: { mood_all: 20, social_boost: 25, conversation_topic: t('冬至禮物') },
        activities: [t('交換禮物'), t('熱湯分享'), t('冬至詩會'), t('雪地遊戲')],
        questName: t('準備禮物'), questDesc: t('為每位居民準備一份特別的禮物。'),
    },
};

// --- v5.4.0 村民人生故事線(LifeGoalSystem):每個村民有長期夢想,隨真實狀態推進,AI 敘事 ---
const LIFE_GOALS = {
    truelove: {
        icon: '💗', name: t('尋覓真愛'),
        stages: [t('憧憬愛情'), t('怦然心動'), t('兩情相悅'), t('步入婚姻')],
        // 直接讀愛恨引擎:憧憬→有暗戀→交往→結婚
        stageReady(w, a, stage) {
            const rels = Object.values(a.relationships.relationships).filter(r => { const o = w.agents[r.targetId]; return o && !o.isPlayer; });
            if (stage === 0) return rels.some(r => r.romanticInterest > 40);
            if (stage === 1) return rels.some(r => r.status === 'dating' || r.status === 'married');
            if (stage === 2) return rels.some(r => r.status === 'married');
            return false;
        },
    },
    entrepreneur: {
        icon: '🏪', name: t('開店創業'),
        stages: [t('胸懷創業夢'), t('攢下第一桶金'), t('盤下店面'), t('開張大吉')],
        stageReady(w, a, stage) {
            const prosp = w.prosperity?.score || 0;
            if (stage === 0) return prosp > 15 || (w.stockpile.get('silver') || 0) > 120;
            if (stage === 1) return prosp > 30 || (w.stockpile.get('silver') || 0) > 250;
            if (stage === 2) return prosp > 45 || (w.buildings?.completed?.some(b => b.buildingKey === 'marketplace'));
            return false;
        },
    },
    master: {
        icon: '🎨', name: t('技藝登峰'),
        stages: [t('拜師苦練'), t('小有名氣'), t('獨當一面'), t('一代宗師')],
        stageReady(w, a, stage) {
            const cats = ['工藝', '藝術', '烹飪', '醫療', '智識', '建造', '種植'];
            const lv = Math.max(...cats.map(c => a.skills.get(c)?.level || 0));
            return lv >= [6, 10, 15, 99][stage];
        },
    },
    adventurer: {
        icon: '🧭', name: t('浪跡天涯'),
        stages: [t('嚮往遠方'), t('打點行裝'), t('踏上旅程'), t('滿載而歸')],
        stageReady(w, a, stage) { return true; }, // 純時間推進(冒險是心境)
    },
    family: {
        icon: '👨‍👩‍👧', name: t('闔家團圓'),
        stages: [t('渴望有個家'), t('遇見對的人'), t('開枝散葉'), t('兒孫繞膝')],
        stageReady(w, a, stage) {
            const partner = a.relationships.getPartner();
            if (stage === 0) return !!partner;
            if (stage === 1) return a.relationships.getSpouse && !!a.relationships.getSpouse();
            if (stage === 2) return (w.lifecycle?.births || []).some(b => (b.parentNames || []).includes(a.name));
            return false;
        },
    },
    legacy: {
        icon: '🏛️', name: t('名留青史'),
        stages: [t('胸懷大志'), t('嶄露頭角'), t('舉足輕重'), t('名留青史')],
        stageReady(w, a, stage) {
            const prosp = w.prosperity?.score || 0;
            const onCouncil = (w.council?.members || []).includes(a.agentId);
            if (stage === 0) return prosp > 20;
            if (stage === 1) return prosp > 40 || onCouncil;
            if (stage === 2) return prosp > 60 && onCouncil;
            return false;
        },
    },
};

class LifeGoalSystem {
    constructor() { this.goals = {}; this._assigned = false; }
    _pickGoal(a) {
        const v = a.values || a.personality?.values || [];
        const tr = a.personality?.traits || [];
        const score = { truelove: 0, entrepreneur: 0, master: 0, adventurer: 0, family: 0, legacy: 0 };
        if (v.includes(t('財富'))) score.entrepreneur += 3;
        if (v.includes(t('知識'))) score.master += 2;
        if (v.includes(t('藝術'))) score.master += 3;
        if (v.includes(t('家庭'))) { score.family += 3; score.truelove += 1; }
        if (v.includes(t('冒險'))) score.adventurer += 3;
        if (v.includes(t('自由'))) score.adventurer += 2;
        if (v.includes(t('權力'))) score.legacy += 3;
        if (v.includes(t('榮譽'))) score.legacy += 2;
        if (v.includes(t('社群')) || v.includes(t('和平'))) score.legacy += 1;
        if (tr.includes('romantic')) score.truelove += 3;
        if (tr.includes('creative')) score.master += 2;
        if (tr.includes('hardworking')) score.entrepreneur += 1;
        if (tr.includes('charismatic')) score.legacy += 1;
        // 職業傾向
        const jobGoal = { blacksmith: 'master', tailor: 'master', carpenter: 'master', cook: 'master',
            doctor: 'master', researcher: 'master', trader: 'entrepreneur', guard: 'legacy', priest: 'legacy' };
        if (a.job?.key && jobGoal[a.job.key]) score[jobGoal[a.job.key]] += 2;
        // 若已婚/交往,傾向 family;單身年輕傾向 truelove
        if (a.relationships.getPartner()) score.family += 2; else if (a.age < 35) score.truelove += 1;
        let best = 'truelove', bv = -1;
        for (const [k, s] of Object.entries(score)) if (s > bv) { bv = s; best = k; }
        if (bv <= 0) best = pickRandom(['truelove', 'adventurer', 'master']);
        return best;
    }
    ensureAssigned(world) {
        for (const a of Object.values(world.agents)) {
            if (a.isPlayer || a.isDead) continue;
            if (!this.goals[a.agentId]) {
                this.goals[a.agentId] = { key: this._pickGoal(a), stage: 0, stageStartDay: world.clock.totalDays || 0, done: false };
            }
        }
        this._assigned = true;
    }
    dailyUpdate(world) {
        this.ensureAssigned(world);
        const today = world.clock.totalDays || 0;
        for (const a of Object.values(world.agents)) {
            if (a.isPlayer || a.isDead) continue;
            const g = this.goals[a.agentId];
            if (!g || g.done) continue;
            const def = LIFE_GOALS[g.key]; if (!def) continue;
            const daysAtStage = today - (g.stageStartDay || 0);
            const minDays = 6; // 每階段至少醞釀 6 天
            if (daysAtStage < minDays) continue;
            const ready = def.stageReady(world, a, g.stage);
            // 條件達成 → 推進;純時間型(adventurer)靠機率慢慢走
            const advance = ready && (def.stageReady === LIFE_GOALS.adventurer.stageReady ? Math.random() < 0.18 : Math.random() < 0.5);
            if (advance) {
                g.stage++;
                g.stageStartDay = today;
                const isDone = g.stage >= def.stages.length;
                if (isDone) { g.done = true; g.doneDay = today; }
                // 敘事:AI 或模板,推播里程碑
                if (world.conversationEngine?.narrateLifeMilestone)
                    world.conversationEngine.narrateLifeMilestone(world, a, def, g, isDone);
            }
        }
    }
    getGoal(agentId) { return this.goals[agentId]; }
    describe(agentId) {
        const g = this.goals[agentId]; if (!g) return null;
        const def = LIFE_GOALS[g.key]; if (!def) return null;
        return { key: g.key, icon: def.icon, name: def.name,
            stageName: g.done ? def.stages[def.stages.length - 1] : def.stages[g.stage],
            stage: g.stage, totalStages: def.stages.length, done: g.done };
    }
    nudge(world, agentId) { // 玩家助夢:縮短當前階段醞釀時間
        const g = this.goals[agentId]; if (!g || g.done) return false;
        g.stageStartDay = Math.min(g.stageStartDay, (world.clock.totalDays || 0) - 6);
        g._nudged = true;
        return true;
    }
    serialize() { return { goals: this.goals }; }
    load(d) { if (d && d.goals) { this.goals = d.goals; this._assigned = true; } }
}

// v5.19.0 城鎮身分/路線:小鎮依長期決策自然長成某種樣貌,影響移民、氛圍與事件
const TOWN_ROUTES = {
    commerce:  { icon: '💰', name: () => t('商業自由鎮'), desc: () => t('金流暢旺,商人與旅人絡繹不絕') },
    military:  { icon: '🛡️', name: () => t('軍事要塞'),   desc: () => t('壁壘森嚴,以武立鎮') },
    agrarian:  { icon: '🌾', name: () => t('農業共同體'), desc: () => t('阡陌相連,自給自足') },
    scholarly: { icon: '📚', name: () => t('學術聚落'),   desc: () => t('崇尚知識,書香瀰漫') },
    romance:   { icon: '💕', name: () => t('浪漫小鎮'),   desc: () => t('愛情故事在此處處上演') },
    crime:     { icon: '🗡️', name: () => t('龍蛇混雜之地'), desc: () => t('恩怨情仇,暗流洶湧') },
};
const JOB_AXIS = {
    farmer: 'agrarian', cook: 'agrarian',
    trader: 'commerce', tailor: 'commerce', carpenter: 'commerce', miner: 'commerce',
    guard: 'military', blacksmith: 'military',
    researcher: 'scholarly', doctor: 'scholarly', priest: 'scholarly',
};
const POLICY_AXIS = { economy: 'commerce', freedom: 'commerce', defense: 'military', welfare: 'agrarian', nature: 'agrarian', culture: 'scholarly' };

class TownIdentitySystem {
    constructor() {
        this.scores = { commerce: 0, military: 0, agrarian: 0, scholarly: 0, romance: 0, crime: 0 };
        this.route = null;      // 目前結晶出的路線 key
        this.routeSince = null; // 成為該路線的日子
        this.history = [];      // [{route, day}]
    }
    dailyUpdate(world) {
        const s = this.scores;
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        // 職業分佈:小鎮靠什麼維生
        for (const a of npcs) { const ax = JOB_AXIS[a.job?.key]; if (ax) s[ax] += 1; }
        // 經濟樣態
        const silver = world.stockpile?.get?.('silver') || 0;
        const food = world.stockpile?.get?.('food') || 0;
        if (silver > 300) s.commerce += 2; else if (silver > 150) s.commerce += 1;
        if (food > 150) s.agrarian += 1;
        // 研究氛圍
        const techDone = world.research?.completed?.length || world.research?.unlocked?.length || 0;
        if (techDone > 0) s.scholarly += Math.min(3, techDone * 0.4);
        // 愛恨密度
        let couples = 0, rivalPairs = 0;
        for (const a of npcs) {
            if (a.relationships?.getPartner?.()) couples++;
            for (const r of Object.values(a.relationships?.relationships || {})) if ((r.affinity || 0) < -40) rivalPairs++;
        }
        s.romance += Math.min(5, couples / 2);
        s.crime += Math.min(4, rivalPairs / 4);
        // 選舉政策(最近一屆的方向,強訊號)
        const pol = world.election?.electionHistory?.slice(-1)[0]?.winner?.policy;
        if (pol && POLICY_AXIS[pol]) s[POLICY_AXIS[pol]] += 4;
        // 輕微衰退:讓「近期」比「遠古」更有份量,路線可隨玩法轉變
        for (const k in s) s[k] *= 0.97;
        this._evaluate(world);
    }
    _evaluate(world) {
        const days = world.clock?.totalDays || 0;
        if (days < 15) return; // 需要一段歷史才成形
        const sorted = Object.entries(this.scores).sort((a, b) => b[1] - a[1]);
        const [topK, topV] = sorted[0];
        const runnerV = sorted[1] ? sorted[1][1] : 0;
        if (topV < 25 || topV < runnerV * 1.2) return; // 訊號不夠強或不夠獨佔 → 尚未成形
        if (this.route === topK) return;
        const prev = this.route;
        this.route = topK; this.routeSince = days;
        this.history.push({ route: topK, day: days });
        const def = TOWN_ROUTES[topK];
        const verb = prev ? t('小鎮的樣貌轉變了,如今成為「') : t('小鎮的樣貌逐漸成形——「');
        world.logMessage?.('event', `${def.icon} ${verb}${def.name()}${t('」:')}${def.desc()}`);
        world.dailyNews?.collectEvent?.('event', `${def.icon} ${prev ? t('小鎮轉型為:') : t('小鎮成形為:')}${def.name()}`, 9, []);
    }
    currentRoute() {
        if (!this.route) return null;
        const def = TOWN_ROUTES[this.route];
        return { key: this.route, icon: def.icon, name: def.name(), desc: def.desc() };
    }
    // 依路線偏好的職業軸(供移民加權)
    routeAxis() { return this.route; }
    toDict() { return { route: this.route, routeName: this.route ? TOWN_ROUTES[this.route].name() : null, routeIcon: this.route ? TOWN_ROUTES[this.route].icon : null, routeDesc: this.route ? TOWN_ROUTES[this.route].desc() : null, scores: { ...this.scores } }; }
    serialize() { return { scores: this.scores, route: this.route, routeSince: this.routeSince, history: this.history }; }
    load(d) { if (!d) return; this.scores = d.scores || this.scores; this.route = d.route || null; this.routeSince = d.routeSince || null; this.history = d.history || []; }
}

class FestivalSystem {
    constructor() {
        this.activeFestival = null; // current festival or null
        this.festivalLog = [];     // past festivals
        this.activeQuest = null;   // {name, desc, progress, goal, rewards, deadline}
        this._lastFestivalSeason = null;
    }

    dailyUpdate(world) {
        const season = world.clock.season;
        const day = world.clock.day;
        const festival = FESTIVALS[season];
        if (!festival) return;

        // Festival announcement (1 day before)
        if (day === festival.day - 1 && this._lastFestivalSeason !== season) {
            world.logMessage('festival', `${festival.icon} ${t('明天就是')}${festival.name}${t('了！全城都在準備中。')}`);
            world.events.conversationTopics.push(`${t('即將到來的')}${festival.name}`);
            // Start quest
            this.activeQuest = {
                name: festival.questName, desc: festival.questDesc,
                progress: 0, goal: 100, season: season,
                rewards: { mood: 10, resources: { food: 30, silver: 20 } },
            };
        }

        // Festival day!
        if (day === festival.day && this._lastFestivalSeason !== season) {
            this._lastFestivalSeason = season;
            this.activeFestival = {
                ...festival, season, startTick: world.tickCount,
                endTick: world.tickCount + 96 * 2, // lasts 2 days
            };

            // Apply effects
            Object.values(world.agents).forEach(a => {
                a.moodModifier = (a.moodModifier || 0) + festival.effects.mood_all;
                if (!a.isPlayer) a.addThought('festival_joy', world); // v5.15.0 祭典的歡樂
                if (festival.effects.social_boost) {
                    a.needs.social = Math.min(100, a.needs.social + festival.effects.social_boost);
                }
                const activity = pickRandom(festival.activities);
                a.memory.add(world.tickCount, world.clock.timeStr, 'social',
                    `${t('參加了')}${festival.name}${t('！')}${activity}${t('真有趣。')}`, 7, []);
            });

            // Food bonus
            if (festival.effects.food_bonus) {
                world.stockpile.add('food', festival.effects.food_bonus);
                world.stockpile.add('meals', Math.floor(festival.effects.food_bonus / 2));
            }

            world.logMessage('festival', `${festival.icon} ${festival.name}${t('開始了！')}${festival.description}`);
            world.events.conversationTopics.push(festival.effects.conversation_topic);

            // Boost relationships during festival
            const agents = Object.values(world.agents);
            for (let i = 0; i < agents.length; i++) {
                for (let j = i + 1; j < agents.length; j++) {
                    if (Math.random() < 0.3) {
                        const relA = agents[i].relationships.getOrCreate(agents[j].agentId, agents[j].name);
                        const relB = agents[j].relationships.getOrCreate(agents[i].agentId, agents[i].name);
                        relA.modifyAffinity(randInt(1, 4));
                        relB.modifyAffinity(randInt(1, 4));
                    }
                }
            }

            this.festivalLog.push({ name: festival.name, season, year: world.clock.year, tick: world.tickCount });

            // v5.0.0 祭典邀約:對玩家最有感情的 NPC(伴侶>心動>最好的朋友)主動傳訊邀玩家逛祭典
            const playerAgent = Object.values(world.agents).find(a => a.isPlayer);
            if (playerAgent && world.conversationEngine?.sendEventComment) {
                let inviter = null, best = -Infinity;
                for (const a of Object.values(world.agents)) {
                    if (a.isPlayer || a.isDead) continue;
                    const rel = a.relationships.relationships[playerAgent.agentId];
                    if (!rel) continue;
                    const score = (rel.status === 'married' ? 300 : rel.status === 'dating' ? 200 : 0) + (rel.romanticInterest >= 50 ? 100 : 0) + rel.affinity;
                    if (score > best) { best = score; inviter = a; }
                }
                if (inviter && best > 10) {
                    const act = pickRandom(festival.activities);
                    world.conversationEngine.sendEventComment(world,
                        `${t('今天是')}${festival.name}${t('！')}${festival.description}${t('你想邀')}${playerAgent.name}${t('一起去')}${act}`,
                        [], [inviter.agentId], [
                            `${t('欸欸,今天是')}${festival.name}${t('耶!要不要一起去')}${act}${t('?我在廣場等你!')}`,
                            `${festival.name}${t('開始了!走啦,陪我去')}${act}${t(',一個人去多無聊')}`,
                        ]);
                }
            }

            // Special festival dialogue templates
            world.gossipNetwork.activeGossip.push({
                about: t('全鎮'), content: `${festival.name}${t('好熱鬧！')}${pickRandom(festival.activities)}${t('太棒了！')}`,
                source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true
            });
        }

        // End festival
        if (this.activeFestival && world.tickCount > this.activeFestival.endTick) {
            world.logMessage('festival', `${this.activeFestival.icon} ${this.activeFestival.name}${t('結束了，大家帶著美好的回憶回到日常。')}`);
            this.activeFestival = null;
        }

        // Auto-progress quest (NPC contributions)
        if (this.activeQuest && this.activeQuest.season === season) {
            const workers = Object.values(world.agents).filter(a => !a.isPlayer && a.activity === 'working');
            this.activeQuest.progress = Math.min(this.activeQuest.goal,
                this.activeQuest.progress + workers.length * randInt(2, 5));
            if (this.activeQuest.progress >= this.activeQuest.goal) {
                world.logMessage('festival', `🎉 ${t('節日任務「')}${this.activeQuest.name}${t('」完成！獲得獎勵！')}`);
                if (this.activeQuest.rewards.resources) {
                    for (const [r, amt] of Object.entries(this.activeQuest.rewards.resources)) {
                        world.stockpile.add(r, amt);
                    }
                }
                Object.values(world.agents).forEach(a => {
                    a.moodModifier = (a.moodModifier || 0) + (this.activeQuest.rewards.mood || 5);
                });
                this.activeQuest = null;
            }
        }
        // Clear quest if season changed
        if (this.activeQuest && this.activeQuest.season !== season) {
            this.activeQuest = null;
        }
    }

    toDict() {
        return {
            activeFestival: this.activeFestival ? { ...this.activeFestival } : null,
            festivalLog: this.festivalLog.slice(-10000),
            activeQuest: this.activeQuest ? { ...this.activeQuest } : null,
            _lastFestivalSeason: this._lastFestivalSeason,
            _gameRewardKey: this._gameRewardKey || null, // v5.1.0 本屆祭典攤位獎勵是否已領
        };
    }
}

// --- NPC Death / Birth / Aging System ---
const DEATH_CAUSES = [
    t('年老體衰'), t('突發疾病'), t('意外事故'), t('在探險中犧牲'), t('神秘失蹤後被發現'),
];
const BABY_NAMES_MALE = ['小龍','天明','子軒','浩宇','嘉禾','承恩','宏志','瑞陽','文博','志遠','新宇','國棟'];
const BABY_NAMES_FEMALE = ['小鳳','曉月','詩涵','雨桐','美琪','欣怡','佳穎','思琪','夢瑤','婉清','紫萱','若蘭'];

// v5.27.0 肉鴿:隨機開局用的名字/背景池
const RANDOM_SURNAMES = ['陳','林','黃','張','李','王','吳','劉','蔡','楊','許','鄭','謝','郭','洪','曾','廖','賴','徐','周','葉','蘇','高','呂','潘','簡','何','羅','梁','宋','唐','趙','馬','柯','凌','韓','董','魏','方','石']; // v5.79.0 26→40 姓
const RANDOM_GIVEN_MALE = ['志明','建宏','俊傑','家豪','承翰','冠廷','宗翰','柏翰','彥廷','子墨','宇軒','澤','思成','岳','峰','昊','翔','睿','浩然','立','風','岩','洲','霆','文傑','俊宏','明哲','柏宇','承佑','冠宇','奕辰','子恆','景行','允文','懷安','一帆','兆宏','俊宇','廷威','冠霖','哲瑋','少軒','季恆','紹文','嘉祥','弘毅','子安','辰','宸','曜','朗','寬','鈞','楷','恆','邦','泰','燁','川','勳']; // v5.79.0 24→60 名
const RANDOM_GIVEN_FEMALE = ['淑芬','美玲','雅婷','怡君','佳蓉','曉薇','子晴','語彤','欣妍','佩珊','宛柔','思妤','詠晴','若曦','芷若','靜宜','采薇','韻如','婉婷','晴','嵐','薇','蕎','菱','雨彤','芷晴','怡萱','沛珊','佳琪','宜庭','雅雯','庭瑄','品妍','語嫣','嘉欣','予涵','舒婷','恩綺','靜怡','心瑜','依婷','柔安','昕妤','貝兒','安琪','語珊','若瑄','婕','妍','瑄','彤','霏','綺','恩','棠','芊','語','寧','曦','芸']; // v5.79.0 24→60 名
// v5.79.0 五鎮劇本卡司與移民池的名字,隨機卡司不再抽到(避免兩鎮撞名)
const RESERVED_NAMES = new Set(['丁傑','何昌','何秀','何芳','凌波','劉俊','吳達','呂嵐','周明','唐琳','大熊','孫雨','小滿','小鑽','小鷗','張豪','書儀','曹峰','木叔','木根','木蝦','李雪','杏姑','杜鵑','林姥','林美','柯薇','桂嬸','楊鋒','樹婆','油伯','浪叔','海伯','海嬤','燈爺','牛叔','王麗','珊珊','白姑','白露','皮姑','石叔','石磊','礦爺','祠婆','秀姑','窯叔','綵姑','繡姑','老帳','老樵','老漁','老謝','老錘','肥叔','范浩','蔡文','蕭瑜','蘇晴','蚵嫂','許瑩','財叔','趙霞','邱雅','鄭強','鄭薇','金老爺','鋸哥','鐵柱','門叔','阿哨','阿岩','阿帆','阿晴','阿杏','阿松','阿梯','阿榫','阿汐','阿浮','阿潮','阿狐','阿矢','阿算','阿舵','阿苔','阿苗','阿葉','阿蓉','阿鈴','阿鋼','阿錨','阿鹽','陳偉','雲姨','馬強','駝姐','高朗','鳳姨','鹿娘','黃莉']);
const RANDOM_BG = () => [
    '帶著一身故事來到邊境鎮,想在這裡重新開始。',
    '土生土長的鎮民,對這片土地有說不完的感情。',
    '曾在遠方闖蕩多年,如今只想找個安穩的落腳處。',
    '沉默寡言,但只要熟了就會發現一顆熱心腸。',
    '心裡藏著一個沒說出口的夢,也藏著一個沒說出口的人。',
    '嘴上不饒人,做起事來卻比誰都認真。',
    '走到哪都能交到朋友,也總在不經意間牽動誰的心。',
    '看似瀟灑,其實對某段過去始終放不下。',
];

class LifecycleSystem {
    constructor() {
        this.graveyard = [];   // { name, age, deathCause, deathTick, deathTime, epitaph, job }
        this.births = [];       // { name, parentNames, birthTick, birthTime }
        this._daysSinceCheck = 0;
    }

    dailyUpdate(world) {
        this._daysSinceCheck++;
        if (this._daysSinceCheck < 2) return;
        this._daysSinceCheck = 0;

        this._processAging(world);
        this._checkDeaths(world);
        this._checkBirths(world);
    }

    _processAging(world) {
        // Age NPCs once every 2 seasons (approx every 30 game-days)
        if (world.clock.day !== 1) return;
        if (!this._agingToggle) this._agingToggle = false;
        this._agingToggle = !this._agingToggle;
        if (!this._agingToggle) return; // Skip every other season
        Object.values(world.agents).forEach(a => {
            if (!a.isPlayer) {
                a.age += 1; // 1 year per 2 seasons for balanced lifespan
                // Aging effects
                if (a.age >= 60) {
                    a.needs.rest = Math.max(0, a.needs.rest - 3); // elders tire faster
                }
                if (a.age >= 70) {
                    a.needs.comfort = Math.max(0, a.needs.comfort - 2);
                }
            }
        });
    }

    _checkDeaths(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);
        for (const npc of npcs) {
            let deathChance = 0;

            // Age-based mortality
            if (npc.age >= 80) deathChance = 0.08;
            else if (npc.age >= 70) deathChance = 0.03;
            else if (npc.age >= 60) deathChance = 0.01;

            // Mood modifier: very miserable people are more susceptible
            if (npc.mood < -50) deathChance += 0.01;

            // Disease event modifier
            if (world.events.activeEffects.disease) deathChance += 0.02;

            // Random accident (very rare)
            deathChance += 0.001;

            if (deathChance > 0 && Math.random() < deathChance) {
                this._killNpc(world, npc);
            }
        }
    }

    _killNpc(world, npc) {
        let cause;
        if (npc.age >= 70) cause = t('年老體衰');
        else if (world.events.activeEffects.disease) cause = t('突發疾病');
        else cause = pickRandom(DEATH_CAUSES.slice(1));

        const epitaph = this._generateEpitaph(npc);

        // Record in graveyard
        this.graveyard.push({
            name: npc.name, age: npc.age, gender: npc.gender,
            deathCause: cause, deathTick: world.tickCount,
            deathTime: world.clock.timeStr, epitaph: epitaph,
            job: npc.job?.title || t('無'), traits: npc.personality.traits.slice(0, 3),
        });

        // Notify the world
        world.logMessage('death', `⚰️ ${npc.name}${t('（')}${npc.age}${t('歲）因')}${cause}${t('離世了。')}${epitaph}`, npc.name);

        // Grief for related NPCs + mourning behavior
        Object.values(world.agents).forEach(a => {
            if (a.agentId === npc.agentId) return;
            const rel = a.relationships.relationships[npc.agentId];
            if (rel) {
                let grief = -5;
                let isFamily = false;
                if (rel.status === 'married' || rel.status === 'dating') { grief = -30; isFamily = true; }
                else if (rel.affinity > 50) grief = -20;
                else if (rel.affinity > 20) grief = -10;
                // Check parent-child relationship
                if (a._parentNames && a._parentNames.includes(npc.name)) isFamily = true;
                if (npc._parentNames && npc._parentNames.includes(a.name)) isFamily = true;
                a.moodModifier = (a.moodModifier || 0) + grief;
                if (isFamily || rel.affinity > 50) a.addThought('lost_loved_one', world, npc.agentId, npc.name); // v5.15.0 痛失至親
                a.memory.add(world.tickCount, world.clock.timeStr, 'social',
                    `${npc.name}${t('去世了...我很難過。')}`, 9, [npc.name]);
                // Add mourning target — everyone with a relationship will visit graveyard
                if (!a.isPlayer && a._mourningTargets) {
                    a._mourningTargets.push({ name: npc.name, deathTick: world.tickCount, isFamily });
                }
                // Clear relationship status
                if (rel.status === 'married' || rel.status === 'dating') {
                    rel.status = 'ex'; rel.statusSince = world.tickCount;
                }
            }
        });

        // Town-wide mourning: even unacquainted NPCs pay brief respects
        Object.values(world.agents).forEach(a => {
            if (a.agentId === npc.agentId || a.isPlayer) return;
            if (!a.relationships.relationships[npc.agentId] && a._mourningTargets && Math.random() < 0.4) {
                a._mourningTargets.push({ name: npc.name, deathTick: world.tickCount, isFamily: false });
            }
        });

        // Town-wide mood hit
        Object.values(world.agents).forEach(a => {
            if (a.agentId !== npc.agentId && !a.isPlayer) {
                a.moodModifier = (a.moodModifier || 0) - 3;
            }
        });

        world.gossipNetwork.activeGossip.push({
            about: npc.name, content: `${npc.name}${t('去世了...願他安息。')}`,
            source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${npc.name}${t('（')}${npc.age}${t('歲）因')}${cause}${t('離世了。')}${epitaph}`, 10, [npc.name]);

        // Remove from factions
        if (world.factions) {
            for (const faction of Object.values(world.factions.factions)) {
                faction.removeMember(npc.agentId);
            }
        }

        // Remove from factories
        if (world.processing) world.processing.removeWorker(npc.agentId);

        // Remove the agent
        world.removeAgent(npc.agentId);

        // Job vacancy - may need immigration
        world.events.TARGET_POPULATION = Math.max(world.events.TARGET_POPULATION,
            Object.values(world.agents).filter(a => !a.isPlayer).length + 1);
    }

    _checkBirths(world) {
        // Check for married couples (including player-NPC couples)
        const allAgents = Object.values(world.agents);
        for (const agent of allAgents) {
            if (agent.age < 20 || agent.age > 45) continue;
            const partner = agent.relationships.getPartner();
            if (!partner || partner.status !== 'married') continue;
            const otherAgent = world.agents[partner.targetId];
            if (!otherAgent) continue;

            // Only check once per couple (by comparing IDs)
            if (agent.agentId > partner.targetId) continue;

            // Player-NPC couples: mark child as player's child
            const involvesPlayer = agent.isPlayer || otherAgent.isPlayer;

            // Birth probability based on age and relationship quality
            const avgAge = (agent.age + otherAgent.age) / 2;
            let birthChance = 0.02;
            if (avgAge > 35) birthChance = 0.01;
            if (avgAge > 40) birthChance = 0.005;
            if (partner.affinity > 60) birthChance *= 1.5;

            // Population limits
            if (involvesPlayer) {
                // Player-NPC couples: max 3 children, no population cap
                const playerChildCount = (this.playerChildren || []).length;
                if (playerChildCount >= 3) continue;
            } else {
                // NPC-NPC couples: limited by total population
                const currentPop = Object.values(world.agents).filter(a => !a.isPlayer).length;
                if (currentPop >= 20) continue;
            }

            if (Math.random() < birthChance) {
                this._birthChild(world, agent, otherAgent, involvesPlayer);
            }
        }
    }

    _birthChild(world, parentA, parentB, isPlayerChild = false) {
        const gender = Math.random() < 0.5 ? 'male' : 'female';
        const namePool = gender === 'male' ? BABY_NAMES_MALE : BABY_NAMES_FEMALE;
        const usedNames = new Set(Object.values(world.agents).map(a => a.name));
        const graveyardNames = new Set(this.graveyard.map(g => g.name));
        const availableNames = namePool.filter(n => !usedNames.has(n) && !graveyardNames.has(n));
        const name = availableNames.length > 0 ? pickRandom(availableNames) :
            `${parentA.name.charAt(0)}${pickRandom(namePool).slice(-1)}`;

        // Inherit traits from parents
        const allTraits = [...parentA.personality.traits, ...parentB.personality.traits];
        const inheritedTraits = shuffle(allTraits).slice(0, 2);
        // Add one random new trait
        const POSSIBLE_TRAITS = ['kind','shy','charismatic','gossip','hardworking','lazy','perfectionist','creative','optimist','pessimist','neurotic','stoic','romantic','night_owl','early_bird'];
        const newTrait = pickRandom(POSSIBLE_TRAITS.filter(t => !inheritedTraits.includes(t)));
        inheritedTraits.push(newTrait);

        const values = shuffle([...parentA.personality.values, ...parentB.personality.values]).slice(0, 2);
        const background = `${parentA.name}${t('和')}${parentB.name}${t('的孩子。在邊境鎮出生長大。')}`;

        const personality = new Personality(inheritedTraits, background, values);
        const childAge = 16; // Start as young adult
        const agent = new Agent(`child_${world.tickCount}`, name, childAge, personality, null,
            parentA.homeLocation, gender);

        world.addAgent(agent);

        this.births.push({
            name, parentNames: [parentA.name, parentB.name],
            birthTick: world.tickCount, birthTime: world.clock.timeStr,
        });

        // Parents get mood boost
        parentA.moodModifier = (parentA.moodModifier || 0) + 25;
        parentB.moodModifier = (parentB.moodModifier || 0) + 25;
        parentA.memory.add(world.tickCount, world.clock.timeStr, 'relationship',
            `${t('我們的孩子')}${name}${t('出生了！')}`, 10, [parentB.name, name]);
        parentB.memory.add(world.tickCount, world.clock.timeStr, 'relationship',
            `${t('我們的孩子')}${name}${t('出生了！')}`, 10, [parentA.name, name]);

        // Set up parent-child relationships
        const relA = agent.relationships.getOrCreate(parentA.agentId, parentA.name);
        relA.modifyAffinity(50); relA.modifyTrust(40);
        const relB = agent.relationships.getOrCreate(parentB.agentId, parentB.name);
        relB.modifyAffinity(50); relB.modifyTrust(40);
        parentA.relationships.getOrCreate(agent.agentId, name).modifyAffinity(60);
        parentB.relationships.getOrCreate(agent.agentId, name).modifyAffinity(60);

        // Track player's children for inheritance
        if (isPlayerChild) {
            agent._isPlayerChild = true;
            agent._parentNames = [parentA.name, parentB.name];
            if (!this.playerChildren) this.playerChildren = [];
            this.playerChildren.push({ agentId: agent.agentId, name, parentNames: [parentA.name, parentB.name], birthTick: world.tickCount });
            world.logMessage('system', `🎉 ${t('你的孩子')}${name}${t('出生了！將來可以繼承你的一切。')}`);
        }

        // Town celebration
        Object.values(world.agents).forEach(a => {
            if (a.agentId !== agent.agentId) {
                a.moodModifier = (a.moodModifier || 0) + 5;
            }
        });

        world.logMessage('birth', `🎒 ${parentA.name}${t('和')}${parentB.name}${t('的孩子')}${name}${t('出生了！全鎮慶祝！')}`, name);
        world.gossipNetwork.activeGossip.push({
            about: name, content: `${parentA.name}${t('和')}${parentB.name}${t('生了個')}${gender==='male'?t('男'):t('女')}${t('孩，取名')}${name}${t('！')}`,
            source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true
        });
        if (world.dailyNews) world.dailyNews.collectEvent('lifecycle', `${parentA.name}${t('和')}${parentB.name}${t('的孩子')}${name}${t('出生了！')}`, 9, [parentA.name, parentB.name, name]);
    }

    _generateEpitaph(npc) {
        const lines = [];
        if (npc.job) lines.push(`${t('曾任')}${npc.job.title}`);
        if (npc.personality.traits.includes('kind')) lines.push(t('以善良著稱'));
        else if (npc.personality.traits.includes('hardworking')) lines.push(t('勤勞一生'));
        else if (npc.personality.traits.includes('creative')) lines.push(t('才華洋溢'));
        else if (npc.personality.traits.includes('charismatic')) lines.push(t('深受愛戴'));
        else lines.push(t('將被永遠懷念'));
        return lines.join(t('，')) + t('。');
    }

    toDict() {
        return {
            graveyard: this.graveyard.slice(-10000),
            births: this.births.slice(-10000),
            playerChildren: this.playerChildren || [],
            _daysSinceCheck: this._daysSinceCheck,
        };
    }
}

// --- Exploration / Map Expansion System ---
const EXPLORATION_ZONES = [
    { id:'deep_forest', name:t('幽深森林'), icon:'🌲', difficulty:2, distance:3,
      description:t('城鎮外的茂密森林，傳說中有稀有草藥和野生動物。'),
      rewards: { resources:{ wood:30, herbs:20 }, xpSkill:t('種植'), xpAmount:50 },
      events: [t('發現了一片珍貴的草藥田！'),t('遭遇了一群野狼，但成功擊退！'),t('找到了一個隱藏的獵人小屋。'),t('迷路了一陣子，但最終找到了回家的路。')] },
    { id:'ancient_ruins', name:t('古代遺跡'), icon:'🏛️', difficulty:4, distance:5,
      description:t('神秘的古代建築遺址，可能藏有珍貴的知識和寶物。'),
      rewards: { resources:{ silver:40, research_points:30 }, xpSkill:t('智識'), xpAmount:80 },
      events: [t('發現了古代文字記錄！'),t('觸發了一個古老的陷阱！'),t('找到了珍貴的古代文物。'),t('遺跡深處傳來神秘的聲音...')] },
    { id:'abandoned_mine', name:t('廢棄礦坑'), icon:'⛏️', difficulty:3, distance:4,
      description:t('一座被廢棄的老礦坑，據說深處仍有豐富的礦脈。'),
      rewards: { resources:{ stone:25, metal:20 }, xpSkill:t('採礦'), xpAmount:60 },
      events: [t('發現了一條新的礦脈！'),t('礦坑塌方，但安全逃出！'),t('找到了前礦工留下的工具。'),t('在礦坑深處看到了奇異的光芒。')] },
    { id:'mountain_pass', name:t('山間隘口'), icon:'⛰️', difficulty:5, distance:6,
      description: t('通往外界的危險山路，但可能找到貿易路線和珍稀資源。'),
      rewards: { resources:{ silver:30, cloth:15, tools:10 }, xpSkill:t('近戰'), xpAmount:70 },
      events: [t('在山頂看到了壯麗的風景！'),t('遭遇山賊，經過一番苦戰取勝。'),t('發現了一條通往鄰鎮的捷徑。'),t('暴風雪來襲，艱難地撐了過去。')] },
    { id:'riverside_cave', name:t('河畔洞窟'), icon:'🕳️', difficulty:2, distance:2,
      description:t('河邊的一個神秘洞穴，經常有奇怪的回音。'),
      rewards: { resources:{ herbs:15, stone:10 }, xpSkill:t('建造'), xpAmount:40 },
      events: [t('在洞窟裡發現了古老的壁畫！'),t('找到了地下泉水，可能對鎮上的供水有幫助。'),t('洞窟深處有蝙蝠群棲息。'),t('發現了被水沖來的寶箱殘骸。')] },
    { id:'cursed_swamp', name:t('詛咒沼澤'), icon:'🌿', difficulty:4, distance:4,
      description:t('傳說被詛咒的沼澤地，危險但也可能有珍貴的材料。'),
      rewards: { resources:{ herbs:30, medicine:10 }, xpSkill:t('醫療'), xpAmount:60 },
      events: [t('找到了極為罕見的藥用植物！'),t('陷入了沼澤泥潭，差點走不出來。'),t('遇到了一位隱居的老藥師。'),t('在沼澤中心發現了一塊奇怪的石頭。')] },
];

class ExplorationSystem {
    constructor() {
        this.discoveredZones = {};  // zoneId -> { discovered:bool, timesExplored:int, lastExploredTick }
        this.activeExpeditions = []; // { zoneId, agentIds[], departureTick, returnTick, status }
        this.expeditionLog = [];     // completed expedition results
        this._counter = 0;
    }

    dailyUpdate(world) {
        this._checkReturningExpeditions(world);
        this._autoDiscoverZones(world);
    }

    _autoDiscoverZones(world) {
        // Gradually discover zones based on town development
        const npcCount = Object.values(world.agents).filter(a => !a.isPlayer).length;
        const dayCount = world.clock.year * 60 + (['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15 + world.clock.day;

        for (const zone of EXPLORATION_ZONES) {
            if (this.discoveredZones[zone.id]) continue;
            let discoverChance = 0;
            // Guards and researchers discover zones
            const explorers = Object.values(world.agents).filter(a =>
                a.job && (a.job.key === 'guard' || a.job.key === 'researcher'));
            if (explorers.length > 0) discoverChance = 0.02 * explorers.length;
            // Time-based discovery
            if (dayCount > 20) discoverChance += 0.01;
            if (dayCount > 40) discoverChance += 0.02;
            // Difficulty check
            discoverChance /= zone.difficulty;

            if (Math.random() < discoverChance) {
                this.discoveredZones[zone.id] = { discovered: true, timesExplored: 0, lastExploredTick: 0 };
                world.logMessage('exploration', `🗺️ ${t('發現了新的探索區域：')}${zone.icon} ${zone.name}${t('！')}${zone.description}`);
                world.events.conversationTopics.push(`${t('新發現的')}${zone.name}`);
                if (world.dailyNews) world.dailyNews.collectEvent('exploration', `${t('發現了新的探索區域：')}${zone.name}${t('！')}`, 7);
            }
        }
    }

    canSendExpedition(zoneId) {
        if (!this.discoveredZones[zoneId]) return false;
        // Check if not already exploring this zone
        return !this.activeExpeditions.some(e => e.zoneId === zoneId);
    }

    sendExpedition(world, zoneId, agentIds) {
        const zone = EXPLORATION_ZONES.find(z => z.id === zoneId);
        if (!zone || !this.canSendExpedition(zoneId)) return null;

        const agents = agentIds.map(id => world.agents[id]).filter(Boolean);
        if (agents.length === 0) return null;

        const returnTick = world.tickCount + 96 * zone.distance; // distance in days

        const expedition = {
            id: `exp_${++this._counter}`,
            zoneId, zoneName: zone.name, zoneIcon: zone.icon,
            agentIds: agents.map(a => a.agentId),
            agentNames: agents.map(a => a.name),
            departureTick: world.tickCount,
            returnTick: returnTick,
            status: 'travelling',
        };

        this.activeExpeditions.push(expedition);

        // Remove agents from town temporarily
        agents.forEach(a => {
            a.currentLocation = 'exploration';
            a.activity = 'exploring';
            a.memory.add(world.tickCount, world.clock.timeStr, 'discovery',
                `${t('出發前往')}${zone.name}${t('探險！')}`, 7, agents.map(x => x.name));
        });

        const names = agents.map(a => a.name).join(t('、'));
        world.logMessage('exploration', `${zone.icon} ${names}${t('出發前往')}${zone.name}${t('探險了！預計')}${zone.distance}${t('天後返回。')}`);

        return expedition;
    }

    _checkReturningExpeditions(world) {
        const returning = this.activeExpeditions.filter(e => world.tickCount >= e.returnTick);

        for (const expedition of returning) {
            const zone = EXPLORATION_ZONES.find(z => z.id === expedition.zoneId);
            if (!zone) continue;

            const agents = expedition.agentIds.map(id => world.agents[id]).filter(Boolean);
            const teamSkill = agents.reduce((sum, a) => {
                const relevantSkill = a.skills.get(zone.rewards.xpSkill);
                return sum + (relevantSkill?.level || 1);
            }, 0) / Math.max(1, agents.length);

            // Success chance based on team skill vs difficulty
            const successChance = Math.min(0.95, 0.4 + (teamSkill / zone.difficulty) * 0.15);
            const isSuccess = Math.random() < successChance;

            const event = pickRandom(zone.events);
            let resultMsg = '';

            if (isSuccess) {
                // Give rewards
                const multiplier = 0.5 + teamSkill * 0.1;
                for (const [resource, amount] of Object.entries(zone.rewards.resources)) {
                    const gained = Math.floor(amount * multiplier);
                    world.stockpile.add(resource, gained);
                }
                // XP for participants
                agents.forEach(a => {
                    a.skills.addXp(zone.rewards.xpSkill, zone.rewards.xpAmount);
                    a.moodModifier = (a.moodModifier || 0) + 10;
                    a.currentLocation = a.homeLocation;
                    a.activity = 'idle';
                    a.memory.add(world.tickCount, world.clock.timeStr, 'discovery',
                        `${t('從')}${zone.name}${t('探險歸來！')}${event}`, 8, agents.map(x => x.name));
                });

                resultMsg = `${zone.icon} ${t('探險隊從')}${zone.name}${t('凱旋歸來！')}${event}`;
                this.discoveredZones[zone.id].timesExplored++;
            } else {
                // Failed expedition - agents return wounded
                agents.forEach(a => {
                    a.moodModifier = (a.moodModifier || 0) - 15;
                    a.needs.rest = Math.max(0, a.needs.rest - 30);
                    a.needs.hunger = Math.max(0, a.needs.hunger - 20);
                    a.currentLocation = a.homeLocation;
                    a.activity = 'idle';
                    a.memory.add(world.tickCount, world.clock.timeStr, 'discovery',
                        `${t('從')}${zone.name}${t('探險失敗返回...')}${event}`, 7, agents.map(x => x.name));
                });
                // Some resources still found
                for (const [resource, amount] of Object.entries(zone.rewards.resources)) {
                    world.stockpile.add(resource, Math.floor(amount * 0.2));
                }
                resultMsg = `${zone.icon} ${t('探險隊從')}${zone.name}${t('狼狽歸來...')}${event}`;
            }

            this.discoveredZones[zone.id].lastExploredTick = world.tickCount;
            expedition.status = isSuccess ? 'success' : 'failed';
            expedition.result = event;

            world.logMessage('exploration', resultMsg, agents.map(a => a.name).join(t('、')));
            if (world.dailyNews) world.dailyNews.collectEvent('exploration', resultMsg, isSuccess ? 7 : 5, agents.map(a => a.name));
            this.expeditionLog.push({
                ...expedition, completedTick: world.tickCount,
                success: isSuccess, event: event,
            });
        }

        this.activeExpeditions = this.activeExpeditions.filter(e => world.tickCount < e.returnTick);
    }

    toDict() {
        return {
            discoveredZones: { ...this.discoveredZones },
            activeExpeditions: this.activeExpeditions.map(e => ({ ...e })),
            expeditionLog: this.expeditionLog.slice(-10000),
            _counter: this._counter,
        };
    }
}

// --- Legacy / New Game+ System ---
class LegacySystem {
    // Collects inheritance data from the current world and applies it to a new one
    static collectLegacy(world) {
        const player = world.agents?.player;
        const npcs = Object.values(world.agents || {}).filter(a => !a.isPlayer);

        // Find player's children
        const playerChildren = npcs.filter(a => a._isPlayerChild);

        // Determine heir: oldest player child, or null
        let heir = null;
        if (playerChildren.length > 0) {
            heir = playerChildren.reduce((oldest, c) => c.age > oldest.age ? c : oldest, playerChildren[0]);
        }

        // Collect NPC memories about the player (for "remembering the previous generation")
        const npcMemories = {};
        for (const npc of npcs) {
            const relToPlayer = npc.relationships?.relationships?.player;
            if (relToPlayer && relToPlayer.affinity !== 0) {
                npcMemories[npc.agentId] = {
                    name: npc.name,
                    affinity: relToPlayer.affinity,
                    trust: relToPlayer.trust,
                    status: relToPlayer.status,
                    memories: npc.memory?.entries
                        ?.filter(m => m.relatedAgents?.includes(player?.name))
                        ?.slice(-5)
                        ?.map(m => m.content) || [],
                };
            }
        }

        // Collect ending stats
        const stats = world.multiEnding?._collectStats?.(world) || {};

        return {
            version: 1,
            generation: (world._legacyGeneration || 1),
            previousPlayerName: player?.name || t('旅人'),
            heir: heir ? {
                agentId: heir.agentId,
                name: heir.name,
                age: heir.age,
                gender: heir.gender,
                traits: heir.personality.traits,
                values: heir.personality.values,
                background: heir.personality.background,
                parentNames: heir._parentNames || [],
                skills: Object.fromEntries(Object.entries(heir.skills.skills).map(([k,s]) => [k, { xp: Math.floor(s.xp * 0.3), passion: s.passion }])),
            } : null,
            // 中度繼承: 50% silver
            silver: Math.floor((world.stockpile?.get('silver') || 0) * 0.5),
            food: Math.floor((world.stockpile?.get('food') || 0) * 0.3),
            // Keep completed buildings
            buildings: (world.buildings?.completed || []).map(b => ({ ...b })),
            // Keep industries (keys and levels)
            industries: world.industry ? JSON.parse(JSON.stringify(world.industry.industries || {})) : {},
            industryMeta: {
                townLevel: world.industry?.townLevel || 1,
                townLevelName: world.industry?.townLevelName || t('荒村'),
                maxIndustries: world.industry?.maxIndustries || 1,
                firstChoice: world.industry?.firstChoice || null,
            },
            // Prosperity (carry over partially)
            prosperity: Math.floor((world.prosperity?.prosperity || 0) * 0.6),
            // NPC memories of previous generation
            npcMemories,
            // Town history
            endingType: world.multiEnding?.endingTriggered || null,
            stats,
            // Farm data (partial)
            farms: world.farm ? JSON.parse(JSON.stringify(world.farm.farms || {})) : {},
            // Research progress (keep completed)
            research: world.research ? Object.fromEntries(
                Object.entries(world.research.projects)
                    .filter(([, p]) => p.completed)
                    .map(([k, p]) => [k, { ...p }])
            ) : {},
        };
    }

    static applyLegacy(world, legacy) {
        if (!legacy || legacy.version !== 1) return;

        world._legacyGeneration = (legacy.generation || 1) + 1;

        // --- Heir becomes new player ---
        if (legacy.heir) {
            const player = world.agents?.player;
            if (player) {
                player.name = legacy.heir.name;
                player.age = legacy.heir.age || 18;
                player.gender = legacy.heir.gender || 'male';
                player.personality = new Personality(
                    legacy.heir.traits || ['creative', 'kind'],
                    `${legacy.previousPlayerName}${t('的孩子。繼承了家業，在邊境鎮長大。第')}${world._legacyGeneration}${t('代。')}`,
                    legacy.heir.values || [t('冒險'), t('友情')]
                );
                // Inherit some skills (30%)
                if (legacy.heir.skills) {
                    for (const [sk, sv] of Object.entries(legacy.heir.skills)) {
                        const s = player.skills.get(sk);
                        if (s) { s.xp = sv.xp; s.passion = sv.passion; }
                    }
                }
            }
        } else {
            // No heir: new traveler with legacy background
            const player = world.agents?.player;
            if (player) {
                player.personality = new Personality(
                    ['creative', 'kind'],
                    `${t('收到了')}${legacy.previousPlayerName}${t('的遺產，來到邊境鎮開始新生活。第')}${world._legacyGeneration}${t('代。')}`,
                    [t('冒險'), t('友情')]
                );
            }
        }

        // --- Silver & food ---
        if (legacy.silver > 0) world.stockpile.add('silver', legacy.silver);
        if (legacy.food > 0) world.stockpile.add('food', legacy.food);

        // --- Buildings ---
        if (legacy.buildings?.length && world.buildings) {
            world.buildings.completed = legacy.buildings;
            // Re-apply building effects
            for (const b of legacy.buildings) {
                if (b.effects) {
                    for (const [k, v] of Object.entries(b.effects)) {
                        world.buildings.activeEffects[k] = (world.buildings.activeEffects[k] || 0) + v;
                    }
                }
            }
        }

        // --- Industries ---
        if (legacy.industries && Object.keys(legacy.industries).length > 0 && world.industry) {
            world.industry.industries = legacy.industries;
            // Clear workers from inherited industries (they're from last gen)
            for (const ind of Object.values(world.industry.industries)) {
                ind.workers = [];
            }
            world.industry.townLevel = legacy.industryMeta?.townLevel || 1;
            world.industry.townLevelName = legacy.industryMeta?.townLevelName || t('荒村');
            world.industry.maxIndustries = legacy.industryMeta?.maxIndustries || 1;
            world.industry.firstChoice = legacy.industryMeta?.firstChoice || null;
            world.industry.needsIndustryChoice = false;
            world.industry._updateSynergies?.();
        }

        // --- Prosperity ---
        if (legacy.prosperity > 0 && world.prosperity) {
            world.prosperity.prosperity = legacy.prosperity;
            world.prosperity._updateLevel?.();
        }

        // --- Research (keep completed) ---
        if (legacy.research && world.research) {
            for (const [k, p] of Object.entries(legacy.research)) {
                if (world.research.projects[k]) {
                    Object.assign(world.research.projects[k], p);
                }
            }
        }

        // --- Farm plots (keep planted) ---
        if (legacy.farms && Object.keys(legacy.farms).length > 0 && world.farm) {
            for (const [k, f] of Object.entries(legacy.farms)) {
                if (world.farm.farms[k]) {
                    world.farm.farms[k].unlocked = f.unlocked;
                    // Don't carry over crop state, just the unlocked status
                }
            }
        }

        // --- NPC memories of previous generation ---
        // NPCs that survived from last gen will remember the previous player
        if (legacy.npcMemories) {
            for (const npc of Object.values(world.agents).filter(a => !a.isPlayer)) {
                const prevMemory = legacy.npcMemories[npc.agentId];
                if (prevMemory) {
                    // Transfer affinity as "memory of the parent" -> goodwill toward child
                    const rel = npc.relationships.getOrCreate('player', world.agents.player?.name || t('旅人'));
                    const inheritedAffinity = Math.floor(prevMemory.affinity * 0.5);
                    const inheritedTrust = Math.floor(prevMemory.trust * 0.3);
                    rel.modifyAffinity(inheritedAffinity);
                    rel.modifyTrust(inheritedTrust);
                    // Add a memory about the previous generation
                    npc.memory.add(0, t('第1年 春季 第1天 6:00'),  'legacy',
                        `${legacy.previousPlayerName}${t('的')}${legacy.heir ? t('孩子') : t('繼承人')}${t('來到了鎮上。想起了和')}${legacy.previousPlayerName}${t('的日子。')}`,
                        8, [world.agents.player?.name || t('旅人'), legacy.previousPlayerName]);
                }
            }
        }

        // --- Log the inheritance ---
        const heirName = legacy.heir?.name || t('新旅人');
        world.logMessage('system', `📜 ${t('第')}${world._legacyGeneration}${t('代開始！')}${heirName}${t('繼承了')}${legacy.previousPlayerName}${t('的遺產。')}`);
        world.logMessage('system', `💰 ${t('繼承銀幣')} ${legacy.silver}${t('，已建建築')} ${legacy.buildings?.length || 0} ${t('棟，產業')} ${Object.keys(legacy.industries || {}).length} ${t('個。')}`);
        if (legacy.endingType) {
            world.logMessage('system', `📖 ${t('上一代結局：')}${legacy.endingType}${t('。鎮民們仍然記得')}${legacy.previousPlayerName}${t('的故事。')}`);
        }
    }
}
