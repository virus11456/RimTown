// ============================================================
// RimTown - NPC Relationship Chain Events (NPC 關係連鎖事件)
// ============================================================

class NPCEventSystem {
    constructor() {
        this.activeIncidents = [];  // Current ongoing incidents
        this.incidentLog = [];
        this._daysSinceCheck = 0;
    }

    dailyUpdate(world) {
        this._daysSinceCheck++;
        if (this._daysSinceCheck < 2) return; // Check every 2 days
        this._daysSinceCheck = 0;

        this._processHospitalized(world);
        this._processMissing(world);
        this._checkFights(world);
        this._checkSabotage(world);
        this._checkCollaboration(world);
    }

    _processHospitalized(world) {
        for (const agent of Object.values(world.agents)) {
            if (!agent.status || agent.status !== 'hospitalized') continue;
            agent._hospitalDays = (agent._hospitalDays || 0) + 1;

            // Consume medicine
            const hasMedicine = world.stockpile.consume('medicine', 1, world.tickCount, `${agent.name}住院治療`);
            const hasDoctor = Object.values(world.agents).some(a => a.job?.key === 'doctor' && a.status !== 'hospitalized');

            // Recovery
            let recoveryDays = 3;
            if (!hasMedicine) recoveryDays += 2;
            if (!hasDoctor) recoveryDays += 2;

            if (agent._hospitalDays >= recoveryDays) {
                agent.status = 'normal';
                agent._hospitalDays = 0;
                agent.mood = Math.min(100, agent.mood + 10);
                world.logMessage('incident', `${agent.name}出院了！`);
                if (world.dailyNews) {
                    world.dailyNews.collectEvent('lifecycle', `${agent.name}康復出院了！`, 5, [agent.name]);
                }
            } else {
                // Friends mood penalty
                for (const other of Object.values(world.agents)) {
                    if (other.agentId === agent.agentId) continue;
                    const rel = other.relationships?.relationships?.[agent.agentId];
                    if (rel && rel.affinity > 30) {
                        other.mood = Math.max(-100, other.mood - 2);
                    }
                }
            }
        }
    }

    _processMissing(world) {
        for (const agent of Object.values(world.agents)) {
            if (!agent.status || agent.status !== 'missing') continue;
            agent._missingDays = (agent._missingDays || 0) + 1;

            // Partner/family mood crash
            for (const other of Object.values(world.agents)) {
                if (other.agentId === agent.agentId) continue;
                const rel = other.relationships?.relationships?.[agent.agentId];
                if (rel && (rel.status === 'dating' || rel.status === 'married')) {
                    other.mood = Math.max(-100, other.mood - 8);
                }
            }

            // 5 days: permanent departure
            if (agent._missingDays >= 5) {
                world.logMessage('incident', `${agent.name}已經失蹤太久了...大家只能祈禱平安。`);
                world.removeAgent(agent.agentId);
                if (world.dailyNews) {
                    world.dailyNews.collectEvent('lifecycle', `${agent.name}再也沒有回來...全鎮默哀。`, 10, [agent.name]);
                }
            }
        }
    }

    _checkFights(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.status !== 'hospitalized' && a.status !== 'missing');

        for (const agent of npcs) {
            if (!agent.personality?.traits?.includes('abrasive') && Math.random() > 0.3) continue;

            for (const rel of Object.values(agent.relationships?.relationships || {})) {
                if (rel.affinity > -25) continue;
                if (Math.random() > 0.03) continue; // 3% chance when hostile

                const other = world.agents[rel.targetId];
                if (!other || other.isPlayer || other.status === 'hospitalized' || other.status === 'missing') continue;

                // FIGHT!
                other.status = 'hospitalized';
                other._hospitalDays = 0;
                other.mood = Math.max(-100, other.mood - 30);
                agent.mood = Math.max(-100, agent.mood - 10);

                // Remove from factory work
                if (world.processing) world.processing.removeWorker(other.agentId);

                world.logMessage('incident', `⚠️ ${agent.name}和${other.name}大打出手！${other.name}被送進診所！`);

                // Others' reaction
                for (const npc of npcs) {
                    if (npc.agentId === agent.agentId || npc.agentId === other.agentId) continue;
                    const relToAttacker = npc.relationships?.getOrCreate(agent.agentId, agent.name);
                    if (relToAttacker) {
                        relToAttacker.modifyAffinity(-5);
                        if (npc.personality?.traits?.includes('kind')) relToAttacker.modifyAffinity(-5);
                    }
                }

                // Gossip
                world.gossipNetwork?.activeGossip?.push({
                    about: agent.name,
                    content: `${agent.name}把${other.name}打進了診所！`,
                    source: '目擊者', spreadCount: 0,
                    tickCreated: world.tickCount, isTrue: true,
                });

                if (world.dailyNews) {
                    world.dailyNews.collectEvent('incident', `${agent.name}把${other.name}打進了診所！`, 9, [agent.name, other.name]);
                }

                this.incidentLog.push({
                    type: 'fight', attacker: agent.name, victim: other.name,
                    tick: world.tickCount, day: world.clock.day,
                });
                if (this.incidentLog.length > 100) this.incidentLog = this.incidentLog.slice(-100);

                return; // One fight per check
            }
        }
    }

    _checkSabotage(world) {
        if (!world.farm || world.farm.plots.length === 0) return;

        const npcs = Object.values(world.agents).filter(a =>
            !a.isPlayer && a.personality?.traits?.includes('neurotic') && a.mood < -20
        );

        for (const agent of npcs) {
            if (Math.random() > 0.05) continue; // 5% chance

            const growingPlots = world.farm.plots.filter(p => p.state === 'growing');
            if (growingPlots.length === 0) continue;

            const target = growingPlots[Math.floor(Math.random() * growingPlots.length)];
            target.state = 'withered';

            world.logMessage('incident', `⚠️ 有人的農田被破壞了！好像是深夜發生的事...`);

            // Gossip (anonymous)
            world.gossipNetwork?.activeGossip?.push({
                about: '未知', content: '農田遭到不明破壞，村民們人心惶惶。',
                source: '鎮民', spreadCount: 0, tickCreated: world.tickCount, isTrue: true,
            });

            if (world.dailyNews) {
                world.dailyNews.collectEvent('incident', `農田遭到不明破壞，村民們人心惶惶。`, 7);
            }

            this.incidentLog.push({
                type: 'sabotage', suspect: agent.name,
                tick: world.tickCount, day: world.clock.day,
            });
            return; // One sabotage per check
        }
    }

    _checkCollaboration(world) {
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer);

        for (const agent of npcs) {
            for (const rel of Object.values(agent.relationships?.relationships || {})) {
                if (rel.affinity < 60 || rel.trust < 50) continue;
                if (Math.random() > 0.05) continue;

                const other = world.agents[rel.targetId];
                if (!other || other.isPlayer) continue;

                // Same factory bonus
                if (world.processing) {
                    for (const factory of Object.values(world.processing.builtFactories)) {
                        if (factory.workers.includes(agent.agentId) && factory.workers.includes(rel.targetId)) {
                            agent.mood = Math.min(100, agent.mood + 3);
                            other.mood = Math.min(100, other.mood + 3);
                            world.logMessage('social', `${agent.name}和${other.name}配合得越來越默契了！`);
                            return;
                        }
                    }
                }
            }
        }
    }

    // Check if cheating discovery should cause fight (called from _processRelationships)
    handleCheatingDiscovery(world, cheater, partner, thirdParty) {
        partner.mood = Math.max(-100, partner.mood - 40);
        cheater.mood = Math.max(-100, cheater.mood - 20);

        if (partner.personality?.traits?.includes('abrasive') || Math.random() < 0.3) {
            cheater.status = 'hospitalized';
            cheater._hospitalDays = 0;
            if (world.processing) world.processing.removeWorker(cheater.agentId);
            world.logMessage('drama', `${partner.name}發現${cheater.name}劈腿，當街痛打了一頓！`);
        }

        // Everyone's reaction
        for (const npc of Object.values(world.agents)) {
            if (npc.agentId === cheater.agentId) continue;
            const relToCheater = npc.relationships?.getOrCreate(cheater.agentId, cheater.name);
            if (relToCheater) {
                relToCheater.modifyAffinity(-8);
                relToCheater.modifyTrust(-15);
            }
            if (npc.personality?.traits?.includes('kind')) {
                const relToPartner = npc.relationships?.getOrCreate(partner.agentId, partner.name);
                if (relToPartner) relToPartner.modifyAffinity(5);
            }
        }

        // Farm mood penalty
        if (world.farm && partner.job?.key === 'farmer') {
            world.farm.moodPenalty = { agentId: partner.agentId, days: 7, penalty: -0.3 };
        }

        world.gossipNetwork?.activeGossip?.push({
            about: cheater.name,
            content: `${cheater.name}劈腿被${partner.name}抓到了！對象是${thirdParty.name}！`,
            source: '鎮民', spreadCount: 0, tickCreated: world.tickCount, isTrue: true,
        });

        if (world.dailyNews) {
            world.dailyNews.collectEvent('drama', `轟動全鎮！${cheater.name}的秘密關係被揭穿了！`, 10,
                [cheater.name, partner.name, thirdParty.name]);
        }
    }

    toDict() {
        return {
            activeIncidents: this.activeIncidents,
            recentIncidents: this.incidentLog.slice(-20),
        };
    }

    serialize() {
        return {
            activeIncidents: this.activeIncidents,
            incidentLog: this.incidentLog,
            _daysSinceCheck: this._daysSinceCheck,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.activeIncidents = data.activeIncidents || [];
        this.incidentLog = data.incidentLog || [];
        this._daysSinceCheck = data._daysSinceCheck || 0;
    }
}
