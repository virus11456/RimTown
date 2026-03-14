// ============================================================
// RimTown - Custom NPC + Multi-Ending System
// ============================================================
// J1-J2: 自訂 NPC 系統 — 創建、限制、AI 接管
// J3-J4: 多結局判定 + 鎮史回顧演出

// ============================================================
// Available trait & job definitions (mirrors simulation.js)
// ============================================================
const CUSTOM_NPC_TRAITS = [
    { key: 'kind',         label: '善良',   icon: '💛' },
    { key: 'shy',          label: '害羞',   icon: '😳' },
    { key: 'charismatic',  label: '有魅力', icon: '✨' },
    { key: 'hardworking',  label: '勤勞',   icon: '💪' },
    { key: 'creative',     label: '有創意', icon: '🎨' },
    { key: 'romantic',     label: '浪漫',   icon: '💕' },
    { key: 'optimist',     label: '樂觀',   icon: '😊' },
    { key: 'pessimist',    label: '悲觀',   icon: '😔' },
    { key: 'night_owl',    label: '夜貓子', icon: '🦉' },
    { key: 'early_bird',   label: '早起鳥', icon: '🐦' },
    { key: 'gossip',       label: '八卦',   icon: '🗣️' },
    { key: 'stoic',        label: '沉穩',   icon: '🧘' },
    { key: 'abrasive',     label: '刻薄',   icon: '💢' },
    { key: 'perfectionist',label: '完美主義',icon: '🎯' },
    { key: 'lazy',         label: '懶惰',   icon: '😴' },
    { key: 'glutton',      label: '貪吃',   icon: '🍕' },
];

const CUSTOM_NPC_JOBS = [
    { key: 'farmer',     label: '農夫',   icon: '🌾' },
    { key: 'miner',      label: '礦工',   icon: '⛏️' },
    { key: 'cook',       label: '廚師',   icon: '🍳' },
    { key: 'blacksmith', label: '鐵匠',   icon: '⚒️' },
    { key: 'carpenter',  label: '木匠',   icon: '🪓' },
    { key: 'tailor',     label: '裁縫',   icon: '🧵' },
    { key: 'guard',      label: '守衛',   icon: '🛡️' },
    { key: 'trader',     label: '商人',   icon: '💰' },
    { key: 'researcher', label: '研究員', icon: '🔬' },
    { key: 'priest',     label: '牧師',   icon: '⛪' },
];

const CUSTOM_NPC_VALUES = ['家庭','自由','知識','財富','權力','藝術','自然','社群','冒險','和平'];

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
            if (!world.stockpile?.consume(res, amount, world.tickCount, `招募新居民：${config.name}`)) {
                // Rollback already consumed resources
                for (const [rRes, rAmt] of consumed) {
                    world.stockpile?.add(rRes, rAmt, world.tickCount, `退還：招募取消`);
                }
                return { success: false, error: `資源不足：需要 ${amount} ${res}` };
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

        world.logMessage?.('system', `🎉 新居民「${config.name}」加入了邊境鎮！`);
        if (world.dailyNews) {
            world.dailyNews.collectEvent('lifecycle', `新居民「${config.name}」從遠方來到了邊境鎮！`, 7, [config.name]);
        }

        return { success: true, agentId };
    }

    // ============================================================
    // 驗證
    // ============================================================
    _validate(config, world) {
        if (!config.name || config.name.trim().length === 0) {
            return '請輸入名字';
        }
        if (config.name.length > 10) {
            return '名字最多 10 個字';
        }

        // Check duplicate name
        const existingNames = Object.values(world.agents || {}).map(a => a.name);
        if (existingNames.includes(config.name.trim())) {
            return `「${config.name}」已經有人使用了`;
        }

        // Max custom NPCs
        if (this.customNPCs.length >= this.maxCustomNPCs) {
            return `最多只能創建 ${this.maxCustomNPCs} 個自訂居民`;
        }

        // Traits validation
        if (!config.traits || config.traits.length === 0) {
            return '請至少選擇 1 個性格特質';
        }
        if (config.traits.length > 3) {
            return '最多選擇 3 個性格特質';
        }

        // Incompatible trait check
        for (const [a, b] of INCOMPATIBLE_PAIRS) {
            if (config.traits.includes(a) && config.traits.includes(b)) {
                const labelA = CUSTOM_NPC_TRAITS.find(t => t.key === a)?.label || a;
                const labelB = CUSTOM_NPC_TRAITS.find(t => t.key === b)?.label || b;
                return `「${labelA}」和「${labelB}」不能同時選擇`;
            }
        }

        // Age validation
        const age = config.age || 25;
        if (age < 16 || age > 60) {
            return '年齡需在 16-60 之間';
        }

        // Background length
        if (config.background && config.background.length > 200) {
            return '背景故事最多 200 字';
        }

        // Resource check
        for (const [res, amount] of Object.entries(this.creationCost)) {
            if ((world.stockpile?.get(res) || 0) < amount) {
                return `資源不足：需要 ${amount} ${res === 'silver' ? '銀幣' : res === 'food' ? '食物' : res}`;
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
        title: '繁榮結局',
        subtitle: '小鎮成為遠近聞名的貿易中心',
        icon: '🏙️',
        color: '#FFD700',
        description: '在你的帶領下，邊境鎮從一個荒涼的小村莊，發展成為遠近聞名的繁榮城鎮。商人絡繹不絕，居民安居樂業。',
    },
    peace: {
        id: 'peace',
        title: '和平結局',
        subtitle: '所有人和睦共處，大團圓',
        icon: '🕊️',
        color: '#87CEEB',
        description: '你選擇了和平與友愛的道路。鎮上每個人都是你的朋友，這裡沒有紛爭，只有溫暖。',
    },
    legend: {
        id: 'legend',
        title: '傳奇結局',
        subtitle: '完美通關，你就是傳奇',
        icon: '🏆',
        color: '#FF6347',
        description: '你征服了每一個挑戰，開創了所有產業，建立了深厚的人際關係。你的名字將被世世代代傳頌。',
    },
    personal: {
        id: 'personal',
        title: '個人結局',
        subtitle: '在邊境鎮找到了屬於自己的幸福',
        icon: '💕',
        color: '#FF69B4',
        description: '你在這片土地上找到了真愛，組建了家庭。這就是你的歸宿。',
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

        world.logMessage?.('system', `🎊 恭喜！達成「${ENDING_TYPES[finalEnding].title}」！`);

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
        const bestFriend = playerRels.reduce((best, r) => (!best || r.affinity > best.affinity) ? r : best, null);
        const spouse = playerRels.find(r => r.status === 'married');

        return {
            totalDays: (world.clock.year - 1) * 60 + (Math.max(0, ['春季','夏季','秋季','冬季'].indexOf(world.clock.season)) * 15) + world.clock.day,
            year: world.clock.year,
            season: world.clock.season,
            population: agents.length,
            friendsCount: friends.length,
            bestFriend: bestFriend ? { name: bestFriend.targetName, affinity: bestFriend.affinity } : null,
            spouse: spouse ? { name: spouse.targetName } : null,
            prosperity: world.prosperity?.prosperity || 0,
            prosperityLevel: world.prosperity?.level || '未知',
            silver: world.stockpile?.get('silver') || 0,
            food: world.stockpile?.get('food') || 0,
            townLevel: world.industry?.townLevel || 1,
            industries: world.industry ? Object.keys(world.industry.industries || {}).length : 0,
            buildings: world.buildings?.completed?.length || 0,
            questsCompleted: world.questSystem?.completedCount || 0,
            npcQuestsCompleted: world.npcQuests ? Object.values(world.npcQuests.quests || {}).filter(q => q.status === 'completed').length : 0,
            reputation: world.questSystem?.reputation || 0,
            customNPCs: world.customNPC?.customNPCs?.length || 0,
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
                        time: paper.dateStr || `第${paper.year || '?'}年`,
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
                    content: `完成任務：${q.title}`,
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
    renderEndingHTML() {
        if (!this.endingData) return '';
        const e = this.endingData;
        const t = e.type;
        const s = e.stats;

        let html = `<div class="ending-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;overflow-y:auto">`;
        html += `<div class="ending-content" style="max-width:600px;width:90%;padding:40px;text-align:center;color:#fff">`;

        // Title
        html += `<div style="font-size:60px;margin-bottom:10px">${t.icon}</div>`;
        html += `<h1 style="font-size:28px;color:${t.color};margin-bottom:5px">${t.title}</h1>`;
        html += `<p style="font-size:14px;color:#aaa;margin-bottom:20px">${t.subtitle}</p>`;
        html += `<p style="font-size:15px;line-height:1.8;margin-bottom:30px">${t.description}</p>`;

        // Stats
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left;margin-bottom:30px">`;
        html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">遊玩天數</div><div style="font-size:18px;font-weight:bold">${s.totalDays} 天</div></div>`;
        html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">人口</div><div style="font-size:18px;font-weight:bold">${s.population} 人</div></div>`;
        html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">繁榮度</div><div style="font-size:18px;font-weight:bold">${s.prosperity} (${s.prosperityLevel})</div></div>`;
        html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">朋友數</div><div style="font-size:18px;font-weight:bold">${s.friendsCount} 位</div></div>`;
        html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">完成任務</div><div style="font-size:18px;font-weight:bold">${s.questsCompleted + s.npcQuestsCompleted} 個</div></div>`;
        html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">聲望</div><div style="font-size:18px;font-weight:bold">${s.reputation} ⭐</div></div>`;
        if (s.bestFriend) {
            html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">最好的朋友</div><div style="font-size:18px;font-weight:bold">${s.bestFriend.name}</div></div>`;
        }
        if (s.spouse) {
            html += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px"><div style="font-size:11px;color:#888">伴侶</div><div style="font-size:18px;font-weight:bold">💕 ${s.spouse.name}</div></div>`;
        }
        html += '</div>';

        // Town History
        if (e.history && e.history.length > 0) {
            html += `<div style="text-align:left;margin-bottom:30px">`;
            html += `<h2 style="font-size:18px;color:${t.color};margin-bottom:12px">📜 邊境鎮志</h2>`;
            const typeIcons = { quest: '⚔️', personal: '💫', news: '📰', memory: '💭' };
            for (const entry of e.history.slice(0, 20)) {
                html += `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px">`;
                html += `<span style="margin-right:6px">${typeIcons[entry.type] || '📋'}</span>`;
                html += `<span style="color:#ccc">${entry.content}</span>`;
                html += `</div>`;
            }
            html += '</div>';
        }

        // Buttons: continue playing + new game plus
        html += `<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">`;
        html += `<button data-action="close-ending" style="padding:12px 32px;font-size:16px;background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:8px;cursor:pointer;font-weight:bold">繼續遊玩</button>`;
        html += `<button data-action="start-newgame-plus" style="padding:12px 32px;font-size:16px;background:${t.color};color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:bold">🔄 開始二周目</button>`;
        html += `</div>`;

        // New game plus info
        html += `<p style="font-size:12px;color:#888;margin-top:12px">二周目將繼承：50% 銀幣、已建建築、已開發產業、部分繁榮度<br>鎮民會記得上一代的故事</p>`;

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
