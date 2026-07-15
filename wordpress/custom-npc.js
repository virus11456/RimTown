// ============================================================
// RimTown - Custom NPC + Multi-Ending System
// ============================================================
// J1-J2: 自訂 NPC 系統 — 創建、限制、AI 接管
// J3-J4: 多結局判定 + 鎮史回顧演出

// ============================================================
// Available trait & job definitions (mirrors simulation.js)
// ============================================================
const CUSTOM_NPC_TRAITS = [
    { key: 'kind',         label: t('善良'),   icon: '💛' },
    { key: 'shy',          label: t('害羞'),   icon: '😳' },
    { key: 'charismatic',  label: t('有魅力'), icon: '✨' },
    { key: 'hardworking',  label: t('勤勞'),   icon: '💪' },
    { key: 'creative',     label: t('有創意'), icon: '🎨' },
    { key: 'romantic',     label: t('浪漫'),   icon: '💕' },
    { key: 'optimist',     label: t('樂觀'),   icon: '😊' },
    { key: 'pessimist',    label: t('悲觀'),   icon: '😔' },
    { key: 'night_owl',    label: t('夜貓子'), icon: '🦉' },
    { key: 'early_bird',   label: t('早起鳥'), icon: '🐦' },
    { key: 'gossip',       label: t('八卦'),   icon: '🗣️' },
    { key: 'stoic',        label: t('沉穩'),   icon: '🧘' },
    { key: 'abrasive',     label: t('刻薄'),   icon: '💢' },
    { key: 'perfectionist',label: t('完美主義'),icon: '🎯' },
    { key: 'lazy',         label: t('懶惰'),   icon: '😴' },
    { key: 'glutton',      label: t('貪吃'),   icon: '🍕' },
];

const CUSTOM_NPC_JOBS = [
    { key: 'farmer',     label: t('農夫'),   icon: '🌾' },
    { key: 'miner',      label: t('礦工'),   icon: '⛏️' },
    { key: 'cook',       label: t('廚師'),   icon: '🍳' },
    { key: 'blacksmith', label: t('鐵匠'),   icon: '⚒️' },
    { key: 'carpenter',  label: t('木匠'),   icon: '🪓' },
    { key: 'tailor',     label: t('裁縫'),   icon: '🧵' },
    { key: 'guard',      label: t('守衛'),   icon: '🛡️' },
    { key: 'trader',     label: t('商人'),   icon: '💰' },
    { key: 'researcher', label: t('研究員'), icon: '🔬' },
    { key: 'priest',     label: t('牧師'),   icon: '⛪' },
];

const CUSTOM_NPC_VALUES = [t('家庭'),t('自由'),t('知識'),t('財富'),t('權力'),t('藝術'),t('自然'),t('社群'),t('冒險'),t('和平')];

const INCOMPATIBLE_PAIRS = [['optimist','pessimist'],['hardworking','lazy'],['shy','charismatic'],['night_owl','early_bird']];

// ============================================================
// CustomNPCSystem
// ============================================================
class CustomNPCSystem {
    constructor() {
        this.customNPCs = [];       // Array of custom NPC configs
        this.maxCustomNPCs = 3;
        this.creationCost = { silver: 50, food: 30 };
    }

    // ============================================================
    // 創建自訂 NPC
    // ============================================================
    createCustomNPC(config, world) {
        // Trim name early to avoid inconsistency
        if (config.name) config.name = config.name.trim();

        // Validate
        const error = this._validate(config, world);
        if (error) return { success: false, error };

        // Deduct resources (pre-validated, consume atomically)
        const consumed = [];
        for (const [res, amount] of Object.entries(this.creationCost)) {
            if (!world.stockpile?.consume(res, amount, world.tickCount, `${t('招募新居民')}：${config.name}`)) {
                // Rollback already consumed resources
                for (const [rRes, rAmt] of consumed) {
                    world.stockpile?.add(rRes, rAmt, world.tickCount, `${t('退還')}：${t('招募取消')}`);
                }
                return { success: false, error: `${t('資源不足')}：${t('需要')} ${amount} ${res}` };
            }
            consumed.push([res, amount]);
        }

        // Create agent using simulation.js classes (they're global)
        const agentId = `custom_${config.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        const personality = new Personality(config.traits, config.background || '', config.values || []);
        const job = config.job ? new Job(config.job) : null;

        // Pick a random home location
        const homes = ['residential_north', 'residential_south', 'residential_east'];
        const home = homes[Math.floor(Math.random() * homes.length)];

        const agent = new Agent(agentId, config.name, config.age || 25, personality, job, home, config.gender || 'male');
        agent.isCustom = true;
        world.addAgent(agent);

        // Record
        this.customNPCs.push({
            id: agentId,
            name: config.name,
            age: config.age || 25,
            gender: config.gender || 'male',
            job: config.job,
            traits: [...config.traits],
            values: [...(config.values || [])],
            background: config.background || '',
            createdDay: world.clock.day,
            createdYear: world.clock.year,
        });

        world.logMessage?.('system', `🎉 ${t('新居民')}「${config.name}」${t('加入了邊境鎮')}！`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('lifecycle', `${t('新居民')}「${config.name}」${t('從遠方來到了邊境鎮')}！`, 7, [config.name]);
        }

        return { success: true, agentId };
    }

    // ============================================================
    // 驗證
    // ============================================================
    _validate(config, world) {
        if (!config.name || config.name.trim().length === 0) {
            return t('請輸入名字');
        }
        if (config.name.length > 10) {
            return t('名字最多 10 個字');
        }

        // Check duplicate name
        const existingNames = Object.values(world.agents || {}).map(a => a.name);
        if (existingNames.includes(config.name.trim())) {
            return `「${config.name}」${t('已經有人使用了')}`;
        }

        // Max custom NPCs
        if (this.customNPCs.length >= this.maxCustomNPCs) {
            return `${t('最多只能創建')} ${this.maxCustomNPCs} ${t('個自訂居民')}`;
        }

        // Traits validation
        if (!config.traits || config.traits.length === 0) {
            return t('請至少選擇 1 個性格特質');
        }
        if (config.traits.length > 3) {
            return t('最多選擇 3 個性格特質');
        }

        // Incompatible trait check
        for (const [a, b] of INCOMPATIBLE_PAIRS) {
            if (config.traits.includes(a) && config.traits.includes(b)) {
                const labelA = CUSTOM_NPC_TRAITS.find(t => t.key === a)?.label || a;
                const labelB = CUSTOM_NPC_TRAITS.find(t => t.key === b)?.label || b;
                return `「${labelA}」${t('和')}「${labelB}」${t('不能同時選擇')}`;
            }
        }

        // Age validation
        const age = config.age || 25;
        if (age < 16 || age > 60) {
            return t('年齡需在 16-60 之間');
        }

        // Background length
        if (config.background && config.background.length > 200) {
            return t('背景故事最多 200 字');
        }

        // Resource check
        for (const [res, amount] of Object.entries(this.creationCost)) {
            if ((world.stockpile?.get(res) || 0) < amount) {
                return `${t('資源不足')}：${t('需要')} ${amount} ${res === 'silver' ? t('銀幣') : res === 'food' ? t('食物') : res}`;
            }
        }

        return null; // No error
    }

    // ============================================================
    // 查詢
    // ============================================================
    canCreate(world) {
        if (this.customNPCs.length >= this.maxCustomNPCs) return false;
        for (const [res, amount] of Object.entries(this.creationCost)) {
            if ((world.stockpile?.get(res) || 0) < amount) return false;
        }
        return true;
    }

    getRemainingSlots() {
        return this.maxCustomNPCs - this.customNPCs.length;
    }

    toDict() {
        return {
            customNPCs: this.customNPCs,
            maxCustomNPCs: this.maxCustomNPCs,
            remainingSlots: this.getRemainingSlots(),
            creationCost: { ...this.creationCost },
        };
    }

    serialize() {
        return {
            customNPCs: JSON.parse(JSON.stringify(this.customNPCs)),
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.customNPCs = data.customNPCs || [];
    }
}


// ============================================================
// Multi-Ending System (多結局系統)
// ============================================================
const ENDING_TYPES = {
    prosper: {
        id: 'prosper',
        title: t('繁榮結局'),
        subtitle: t('小鎮成為遠近聞名的貿易中心'),
        icon: '🏙️',
        color: '#FFD700',
        description: t('在你的帶領下，邊境鎮從一個荒涼的小村莊，發展成為遠近聞名的繁榮城鎮。商人絡繹不絕，居民安居樂業。'),
    },
    peace: {
        id: 'peace',
        title: t('和平結局'),
        subtitle: t('所有人和睦共處，大團圓'),
        icon: '🕊️',
        color: '#87CEEB',
        description: t('你選擇了和平與友愛的道路。鎮上每個人都是你的朋友，這裡沒有紛爭，只有溫暖。'),
    },
    legend: {
        id: 'legend',
        title: t('傳奇結局'),
        subtitle: t('完美通關，你就是傳奇'),
        icon: '🏆',
        color: '#FF6347',
        description: t('你征服了每一個挑戰，開創了所有產業，建立了深厚的人際關係。你的名字將被世世代代傳頌。'),
    },
    personal: {
        id: 'personal',
        title: t('個人結局'),
        subtitle: t('在邊境鎮找到了屬於自己的幸福'),
        icon: '💕',
        color: '#FF69B4',
        description: t('你在這片土地上找到了真愛，組建了家庭。這就是你的歸宿。'),
    },
};

class MultiEndingSystem {
    constructor() {
        this.endingTriggered = null;    // Which ending was triggered
        this.endingData = null;         // Ending details
        this.townHistory = [];          // Collected town history events
    }

    // ============================================================
    // 檢查結局條件（在 ch5_legacy 完成時呼叫）
    // ============================================================
    checkEnding(world, completedRouteId) {
        if (this.endingTriggered) return; // Already triggered

        const endingType = ENDING_TYPES[completedRouteId];
        if (!endingType) return;

        // Check personal ending as bonus
        const player = world.agents?.player;
        const hasSpouse = player?.relationships ?
            Object.values(player.relationships.relationships || {}).some(r => r.status === 'married') : false;

        // Use the quest-completed route as the primary ending
        let finalEnding = completedRouteId;

        // If player is married, can upgrade to personal ending
        if (hasSpouse && completedRouteId !== 'legend') {
            finalEnding = 'personal';
        }

        this.endingTriggered = finalEnding;
        this.endingData = {
            type: ENDING_TYPES[finalEnding],
            triggeredDay: world.clock.day,
            triggeredYear: world.clock.year,
            triggeredSeason: world.clock.season,
            stats: this._collectStats(world),
            history: this._buildTownHistory(world),
        };

        world.logMessage?.('system', `🎊 ${t('恭喜')}！${t('達成')}「${ENDING_TYPES[finalEnding].title}」！`);

        return this.endingData;
    }

    // ============================================================
    // 收集結局統計
    // ============================================================
    _collectStats(world) {
        const agents = Object.values(world.agents || {});
        const npcs = agents.filter(a => !a.isPlayer);
        const player = world.agents?.player;

        // Player relationships summary
        const playerRels = player?.relationships ? Object.values(player.relationships.relationships || {}) : [];
        const friends = playerRels.filter(r => r.affinity >= 30);
        const enemies = playerRels.filter(r => r.affinity <= -30);
        const bestFriend = playerRels.reduce((best, r) => (!best || r.affinity > best.affinity) ? r : best, null);
        const worstEnemy = playerRels.reduce((worst, r) => (!worst || r.affinity < worst.affinity) ? r : worst, null);
        const spouse = playerRels.find(r => r.status === 'married');
        const exes = playerRels.filter(r => r.status === 'ex');
        const datingPartners = playerRels.filter(r => r.status === 'dating');
        const cheatingRels = playerRels.filter(r => r.isCheating);

        // Count player's children
        const children = agents.filter(a => a._isPlayerChild);

        // Graveyard stats
        const graveyard = world.lifecycle?.graveyard || [];
        const killCount = graveyard.length; // Total deaths in town

        // Relationship totals across all NPCs
        const totalRelationships = playerRels.length;
        const romances = playerRels.filter(r => r.romanticInterest > 30);

        // Player skills
        const playerSkills = player?.skills?.skills ? Object.entries(player.skills.skills)
            .map(([key, skill]) => ({ key, level: skill.level, xp: skill.xp, passion: skill.passion }))
            .sort((a, b) => b.level - a.level) : [];
        const totalSkillLevel = playerSkills.reduce((sum, s) => sum + s.level, 0);

        // Player memories - count categories
        const memories = player?.memory?.entries || [];
        const memoryCounts = {};
        memories.forEach(m => { memoryCounts[m.category] = (memoryCounts[m.category] || 0) + 1; });

        // Top relationship details for narrative
        const topRelationships = [...playerRels].sort((a, b) => b.affinity - a.affinity).slice(0, 5)
            .map(r => ({ name: r.targetName, affinity: r.affinity, status: r.status, romantic: r.romanticInterest }));

        return {
            totalDays: (world.clock.year - 1) * 60 + (Math.max(0, ['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15) + world.clock.day,
            year: world.clock.year,
            season: world.clock.season,
            population: agents.length,
            friendsCount: friends.length,
            enemiesCount: enemies.length,
            bestFriend: bestFriend ? { name: bestFriend.targetName, affinity: bestFriend.affinity } : null,
            worstEnemy: worstEnemy && worstEnemy.affinity < -10 ? { name: worstEnemy.targetName, affinity: worstEnemy.affinity } : null,
            spouse: spouse ? { name: spouse.targetName } : null,
            exCount: exes.length,
            datingCount: datingPartners.length,
            cheatingCount: cheatingRels.length,
            childrenCount: children.length,
            childrenNames: children.map(c => c.name),
            romanceCount: romances.length,
            totalRelationships,
            topRelationships,
            prosperity: world.prosperity?.prosperity || 0,
            prosperityLevel: world.prosperity?.level || t('未知'),
            silver: world.stockpile?.get('silver') || 0,
            food: world.stockpile?.get('food') || 0,
            townLevel: world.industry?.townLevel || 1,
            industries: world.industry ? Object.keys(world.industry.industries || {}).length : 0,
            buildings: world.buildings?.completed?.length || 0,
            questsCompleted: world.questSystem?.completedCount || 0,
            npcQuestsCompleted: world.npcQuests ? Object.values(world.npcQuests.quests || {}).filter(q => q.status === 'completed').length : 0,
            reputation: world.questSystem?.reputation || 0,
            customNPCs: world.customNPC?.customNPCs?.length || 0,
            deathCount: killCount,
            graveyardNames: graveyard.slice(-10).map(g => g.name),
            playerSkills,
            totalSkillLevel,
            playerJob: player?.job?.title || t('無業'),
            playerAge: player?.age || 0,
            playerName: player?.name || t('旅人'),
            playerTraits: player?.personality?.traits || [],
            memoryCounts,
        };
    }

    // ============================================================
    // 建構鎮史（用 NPC 記憶和日報拼湊）
    // ============================================================
    _buildTownHistory(world) {
        const history = [];

        // Collect key events from daily news archives
        if (world.dailyNews?.newspapers) {
            for (const paper of world.dailyNews.newspapers.slice(-30)) {
                if (paper.headline) {
                    history.push({
                        type: 'news',
                        time: paper.dateStr || `${t('第')}${paper.year || '?'}${t('年')}`,
                        content: paper.headline,
                    });
                }
            }
        }

        // Collect important NPC memories
        const player = world.agents?.player;
        if (player?.memory) {
            const importantMemories = player.memory.entries
                .filter(m => m.importance >= 7)
                .slice(-20);
            for (const mem of importantMemories) {
                history.push({
                    type: 'memory',
                    time: mem.timeStr,
                    content: mem.content,
                });
            }
        }

        // Collect quest milestones
        if (world.questSystem) {
            const completedQuests = Object.entries(world.questSystem.quests || {})
                .filter(([, q]) => q.status === 'completed');
            for (const [qId, q] of completedQuests) {
                history.push({
                    type: 'quest',
                    time: '',
                    content: `${t('完成任務')}：${q.title}`,
                });
            }
        }

        // NPC personal quest milestones
        if (world.npcQuests) {
            const completedPersonal = Object.entries(world.npcQuests.quests || {})
                .filter(([, q]) => q.status === 'completed');
            for (const [, q] of completedPersonal) {
                history.push({
                    type: 'personal',
                    time: '',
                    content: `${q.title}`,
                });
            }
        }

        // Sort by type priority: quest > personal > news > memory
        const typePriority = { quest: 0, personal: 1, news: 2, memory: 3 };
        history.sort((a, b) => (typePriority[a.type] || 9) - (typePriority[b.type] || 9));

        return history.slice(0, 50); // Limit to 50 entries
    }

    // ============================================================
    // 生成結局 HTML（供 app.js 呼叫）
    // ============================================================
    // Helper: generate a CSS bar chart row
    _chartBar(label, value, maxValue, color) {
        const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
        return `<div style="display:flex;align-items:center;margin:4px 0">
            <div style="width:80px;font-size:11px;color:#aaa;text-align:right;margin-right:8px;flex-shrink:0">${label}</div>
            <div style="flex:1;height:16px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width 0.5s"></div>
            </div>
            <div style="width:40px;font-size:12px;color:#ccc;text-align:right;margin-left:6px;flex-shrink:0">${value}</div>
        </div>`;
    }

    // Generate narrative life summary
    _generateLifeSummary(s, et) {
        let story = '';
        // Opening
        story += `${s.playerName}${t('在邊境鎮度過了')}${s.totalDays}${t('天的歲月')}`;
        if (s.playerJob !== t('無業')) {
            story += `${t('，以')}${s.playerJob}${t('的身份')}`;
        }
        story += `${t('，從一介旅人成長為這座小鎮不可或缺的一份子。')}`;

        // Relationships
        if (s.spouse) {
            story += `${t('在這段旅途中，與')}${s.spouse.name}${t('結為連理')}`;
            if (s.childrenCount > 0) {
                story += `${t('，養育了')}${s.childrenCount}${t('個孩子')}`;
                if (s.childrenNames.length > 0) story += `（${s.childrenNames.join(t('、'))}）`;
            }
            story += `${t('，建立了溫暖的家庭。')}`;
        } else if (s.romanceCount > 0) {
            story += `${t('經歷了')}${s.romanceCount}${t('段感情')}`;
            if (s.exCount > 0) story += `${t('，其中')}${s.exCount}${t('段已成往事')}`;
            story += `${t('。')}`;
        }

        // Friendships
        if (s.friendsCount > 0) {
            story += `${t('結交了')}${s.friendsCount}${t('位摯友')}`;
            if (s.bestFriend) story += `${t('，與')}${s.bestFriend.name}${t('的友誼最為深厚')}`;
            story += `${t('。')}`;
        }
        if (s.enemiesCount > 0) {
            story += `${t('也樹立了')}${s.enemiesCount}${t('個敵人')}`;
            if (s.worstEnemy) story += `${t('，與')}${s.worstEnemy.name}${t('的恩怨最深')}`;
            story += `${t('。')}`;
        }

        // Achievements
        const totalQuests = s.questsCompleted + s.npcQuestsCompleted;
        if (totalQuests > 0) {
            story += `${t('完成了')}${totalQuests}${t('個任務')}`;
            if (s.reputation > 0) story += `${t('，聲望達到')}${s.reputation}`;
            story += `${t('。')}`;
        }

        // Town
        if (s.prosperity > 0) {
            story += `${t('小鎮的繁榮度達到了')}${s.prosperity}${t('，等級為')}${s.prosperityLevel}${t('。')}`;
        }

        // Deaths
        if (s.deathCount > 0) {
            story += `${t('在這段歲月中，')}${s.deathCount}${t('位居民離開了人世')}`;
            if (s.graveyardNames.length > 0) {
                story += `${t('，包括')}${s.graveyardNames.slice(-3).join(t('、'))}`;
            }
            story += `${t('。')}`;
        }

        // Closing
        story += `${t('這就是')}${s.playerName}${t('在邊境鎮的故事——')}${et.subtitle}`;

        return story;
    }

    renderEndingHTML() {
        if (!this.endingData) return '';
        const e = this.endingData;
        const et = e.type;
        const s = e.stats;

        const cardStyle = 'background:rgba(255,255,255,0.05);padding:12px;border-radius:8px';
        const statLabel = 'font-size:11px;color:#888;margin-bottom:2px';
        const statValue = 'font-size:20px;font-weight:bold';

        let html = `<div class="ending-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 0">`;
        html += `<div class="ending-content" style="max-width:680px;width:92%;padding:30px;color:#fff">`;

        // ===== Title Section =====
        html += `<div style="text-align:center;margin-bottom:30px">`;
        html += `<div style="font-size:60px;margin-bottom:8px">${et.icon}</div>`;
        html += `<h1 style="font-size:28px;color:${et.color};margin-bottom:4px">${et.title}</h1>`;
        html += `<p style="font-size:14px;color:#aaa;margin-bottom:10px">${et.subtitle}</p>`;
        html += `<p style="font-size:15px;line-height:1.8;margin-bottom:0">${et.description}</p>`;
        html += `</div>`;

        // ===== Life Summary Narrative =====
        html += `<div style="background:rgba(255,255,255,0.03);border-left:3px solid ${et.color};padding:16px 20px;margin-bottom:24px;border-radius:0 8px 8px 0">`;
        html += `<h2 style="font-size:16px;color:${et.color};margin-bottom:10px">📖 ${t('一生總結')}</h2>`;
        html += `<p style="font-size:14px;line-height:1.9;color:#d0d0d0">${this._generateLifeSummary(s, et)}</p>`;
        html += `</div>`;

        // ===== Key Stats Grid =====
        html += `<h2 style="font-size:16px;color:${et.color};margin-bottom:12px;text-align:center">📊 ${t('人生數據')}</h2>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px">`;
        html += `<div style="${cardStyle}"><div style="${statLabel}">${t('遊玩天數')}</div><div style="${statValue}">${s.totalDays} ${t('天')}</div></div>`;
        html += `<div style="${cardStyle}"><div style="${statLabel}">${t('年齡')}</div><div style="${statValue}">${s.playerAge} ${t('歲')}</div></div>`;
        html += `<div style="${cardStyle}"><div style="${statLabel}">${t('人口')}</div><div style="${statValue}">${s.population} ${t('人')}</div></div>`;
        html += `<div style="${cardStyle}"><div style="${statLabel}">${t('銀幣')}</div><div style="${statValue}">💰 ${s.silver}</div></div>`;
        html += `<div style="${cardStyle}"><div style="${statLabel}">${t('繁榮度')}</div><div style="${statValue}">${s.prosperity}</div></div>`;
        html += `<div style="${cardStyle}"><div style="${statLabel}">${t('聲望')}</div><div style="${statValue}">⭐ ${s.reputation}</div></div>`;
        html += `</div>`;

        // ===== Relationship Stats =====
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">`;
        // Left: Relationship numbers
        html += `<div style="${cardStyle}">`;
        html += `<h3 style="font-size:14px;color:${et.color};margin-bottom:10px">💕 ${t('感情生活')}</h3>`;
        const relStats = [
            { icon: '💍', label: t('配偶'), value: s.spouse ? s.spouse.name : t('無') },
            { icon: '👶', label: t('子女'), value: s.childrenCount },
            { icon: '❤️', label: t('戀愛次數'), value: s.romanceCount },
            { icon: '💔', label: t('前任'), value: s.exCount },
            { icon: '🤝', label: t('好友'), value: s.friendsCount },
            { icon: '😠', label: t('仇敵'), value: s.enemiesCount },
        ];
        for (const rs of relStats) {
            html += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05)">`;
            html += `<span style="color:#aaa">${rs.icon} ${rs.label}</span><span style="font-weight:600">${rs.value}</span>`;
            html += `</div>`;
        }
        if (s.cheatingCount > 0) {
            html += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#e57373">`;
            html += `<span>🫣 ${t('出軌次數')}</span><span style="font-weight:600">${s.cheatingCount}</span>`;
            html += `</div>`;
        }
        html += `</div>`;

        // Right: Achievement numbers
        html += `<div style="${cardStyle}">`;
        html += `<h3 style="font-size:14px;color:${et.color};margin-bottom:10px">🏆 ${t('成就統計')}</h3>`;
        const achStats = [
            { icon: '⚔️', label: t('完成任務'), value: s.questsCompleted + s.npcQuestsCompleted },
            { icon: '💼', label: t('職業'), value: s.playerJob },
            { icon: '🏭', label: t('開發產業'), value: s.industries },
            { icon: '🏗️', label: t('建設建築'), value: s.buildings },
            { icon: '📊', label: t('城鎮等級'), value: `Lv.${s.townLevel}` },
            { icon: '⚰️', label: t('鎮民去世'), value: s.deathCount },
        ];
        for (const as of achStats) {
            html += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05)">`;
            html += `<span style="color:#aaa">${as.icon} ${as.label}</span><span style="font-weight:600">${as.value}</span>`;
            html += `</div>`;
        }
        html += `</div>`;
        html += `</div>`;

        // ===== Skills Chart =====
        if (s.playerSkills && s.playerSkills.length > 0) {
            html += `<div style="${cardStyle};margin-bottom:24px">`;
            html += `<h3 style="font-size:14px;color:${et.color};margin-bottom:10px">🎯 ${t('技能')}（${t('總計：')}${s.totalSkillLevel}）</h3>`;
            const skillColors = ['#4fc3f7','#81c784','#ffb74d','#e57373','#ba68c8','#4dd0e1','#fff176','#a1887f','#90a4ae','#f48fb1','#aed581','#ce93d8'];
            const maxSkill = Math.max(...s.playerSkills.map(sk => sk.level), 1);
            s.playerSkills.forEach((sk, i) => {
                if (sk.level > 0) {
                    const passionIcon = sk.passion === '有興趣' ? '🔥' : sk.passion === '熱情' ? '🔥🔥' : '';
                    html += this._chartBar(`${sk.key} ${passionIcon}`, sk.level, maxSkill, skillColors[i % skillColors.length]);
                }
            });
            html += `</div>`;
        }

        // ===== Top Relationships Chart =====
        if (s.topRelationships && s.topRelationships.length > 0) {
            html += `<div style="${cardStyle};margin-bottom:24px">`;
            html += `<h3 style="font-size:14px;color:${et.color};margin-bottom:10px">👥 ${t('最重要的人')}</h3>`;
            const maxAff = Math.max(...s.topRelationships.map(r => Math.abs(r.affinity)), 1);
            for (const rel of s.topRelationships) {
                const statusBadge = rel.status === 'married' ? ' 💍' : rel.status === 'dating' ? ' 💕' : rel.status === 'ex' ? ' 💔' : '';
                const color = rel.affinity >= 0 ? '#81c784' : '#e57373';
                html += this._chartBar(`${rel.name}${statusBadge}`, rel.affinity, maxAff, color);
            }
            html += `</div>`;
        }

        // ===== Children Section =====
        if (s.childrenCount > 0) {
            html += `<div style="${cardStyle};margin-bottom:24px">`;
            html += `<h3 style="font-size:14px;color:${et.color};margin-bottom:8px">👨‍👩‍👧‍👦 ${t('子女')}</h3>`;
            html += `<p style="font-size:13px;color:#ccc">${s.childrenNames.join(t('、'))}</p>`;
            html += `</div>`;
        }

        // ===== Town History =====
        if (e.history && e.history.length > 0) {
            html += `<div style="margin-bottom:24px">`;
            html += `<h2 style="font-size:16px;color:${et.color};margin-bottom:12px">📜 ${t('邊境鎮志')}</h2>`;
            const typeIcons = { quest: '⚔️', personal: '💫', news: '📰', memory: '💭' };
            for (const entry of e.history.slice(0, 20)) {
                html += `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px">`;
                html += `<span style="margin-right:6px">${typeIcons[entry.type] || '📋'}</span>`;
                html += `<span style="color:#ccc">${entry.content}</span>`;
                html += `</div>`;
            }
            html += '</div>';
        }

        // ===== Graveyard Memorial =====
        if (s.deathCount > 0 && s.graveyardNames.length > 0) {
            html += `<div style="${cardStyle};margin-bottom:24px;text-align:center">`;
            html += `<h3 style="font-size:14px;color:#aaa;margin-bottom:8px">🪦 ${t('逝去的人們')}</h3>`;
            html += `<p style="font-size:12px;color:#777">${s.graveyardNames.join(t('、'))}</p>`;
            html += `</div>`;
        }

        // ===== Buttons =====
        html += `<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px">`;
        html += `<button data-action="close-ending" style="padding:12px 32px;font-size:16px;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:8px;cursor:pointer;font-weight:bold">${t('繼續遊玩')}</button>`;
        html += `<button data-action="start-newgame-plus" style="padding:12px 32px;font-size:16px;background:${et.color};color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:bold">🔄 ${t('開始二周目')}</button>`;
        html += `</div>`;

        // New game plus info
        html += `<p style="font-size:12px;color:#888;margin-top:12px;text-align:center">${t('二周目將繼承：50% 銀幣、已建建築、已開發產業、部分繁榮度')}<br>${t('鎮民會記得上一代的故事')}</p>`;

        html += '</div></div>';

        return html;
    }

    // ============================================================
    // Serialization
    // ============================================================
    toDict() {
        return {
            endingTriggered: this.endingTriggered,
            hasEnding: !!this.endingTriggered,
        };
    }

    serialize() {
        return {
            endingTriggered: this.endingTriggered,
            endingData: this.endingData ? JSON.parse(JSON.stringify(this.endingData)) : null,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.endingTriggered = data.endingTriggered || null;
        this.endingData = data.endingData || null;
    }
}
