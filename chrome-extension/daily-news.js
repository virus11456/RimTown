// ============================================================
// RimTown - Daily News Engine (AI 日報系統)
// 保留所有日報不刪除！
// ============================================================

class DailyNewsEngine {
    constructor() {
        this.newspapers = [];      // 歷史報紙（永久保存）
        this.todayEvents = [];     // 今日素材收集
        this._lastPublishDay = 0;
        this._enabled = true;
    }

    collectEvent(category, content, importance, agents = []) {
        this.todayEvents.push({
            category, content, importance, agents,
            time: '',
        });
    }

    async generateNewspaper(world) {
        if (!this._enabled) return null;
        if (this.todayEvents.length === 0) return null;

        // Avoid double-publish on same day
        const dayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        if (this._lastPublishDay === dayKey) return null;
        this._lastPublishDay = dayKey;

        // Sort by importance, take top 5
        const events = [...this.todayEvents]
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 5);

        // Pick a random NPC as reporter
        const candidates = Object.values(world.agents).filter(a => !a.isPlayer);
        if (candidates.length === 0) {
            this.todayEvents = [];
            return null;
        }
        const reporter = candidates[Math.floor(Math.random() * candidates.length)];

        // Try LLM generation
        let content = null;
        if (world.conversationEngine?.llm) {
            try {
                content = await this._generateWithLLM(reporter, events, world);
            } catch (e) {
                console.warn('[DailyNews] LLM generation failed, using template:', e);
            }
        }

        // Fallback to template if no LLM
        if (!content) {
            content = this._generateTemplate(reporter, events, world);
        }

        const newspaper = {
            id: this.newspapers.length + 1,
            day: world.clock.day,
            season: world.clock.season,
            year: world.clock.year,
            reporter: reporter.name,
            reporterId: reporter.agentId,
            reporterJob: reporter.job?.title || '居民',
            content: content,
            events: events.map(e => ({ category: e.category, content: e.content, importance: e.importance })),
            publishedAt: world.tickCount,
        };

        this.newspapers.push(newspaper);
        this.todayEvents = [];
        return newspaper;
    }

    async _generateWithLLM(reporter, events, world) {
        const traits = reporter.personality?.traits?.join('、') || '普通';
        const bg = reporter.personality?.background || '';
        const gossip = world.gossipNetwork?.activeGossip?.slice(-3)?.map(g => g.content)?.join('；') || '沒什麼特別的';
        const townLevel = world.industry?.townLevelName || '荒村';
        const industries = world.industry?.industries
            ? Object.keys(world.industry.industries).map(k => INDUSTRIES[k]?.name).join('、')
            : '無';

        // Get previous newspaper summary for continuity
        const prevPaper = this.newspapers.length > 0 ? this.newspapers[this.newspapers.length - 1] : null;
        const prevRef = prevPaper ? `上一期日報（記者：${prevPaper.reporter}）的摘要：${(prevPaper.content || '').substring(0, 100)}...` : '';

        const prompt = `你是「${reporter.name}」，${bg}
你的性格特徵：${traits}
你的職業：${reporter.job?.title || '居民'}
你正在為邊境鎮寫今天的日報。

今天發生的事：
${events.map(e => `- [${e.category}] ${e.content}`).join('\n')}

目前季節：${world.clock.season} 第${world.clock.day}天（第${world.clock.year}年）
小鎮等級：${townLevel}
產業：${industries}
小鎮人口：${Object.keys(world.agents).length}人
鎮上八卦：${gossip}
${prevRef}

請用你的視角寫一篇簡短有趣的日報（200-400字），包含：
1. 一個吸引人的頭條標題
2. 2-3 則新聞（用你的個性來評論）
3. 一段「記者碎碎念」（你個人的心情或觀察）

風格：像小鎮黑板報，親切、生活化、帶有你的個人色彩。用繁體中文。`;

        const response = await world.conversationEngine.llm.chat([
            { role: 'user', content: prompt }
        ], { max_tokens: 800 });

        return response?.content || response?.choices?.[0]?.message?.content || null;
    }

    _generateTemplate(reporter, events, world) {
        const lines = [];
        lines.push(`【頭條】${events[0]?.content || '今天是平靜的一天'}`);
        lines.push('');
        lines.push('本日新聞：');
        for (const e of events.slice(0, 3)) {
            const icons = { farm:'🌾', economy:'💰', event:'⚡', relationship:'💕', politics:'🗳️',
                building:'🏗️', factory:'🏭', exploration:'🗺️', lifecycle:'👶', incident:'⚠️',
                drama:'🎭', social:'💬', town:'🏘️', industry:'⚒️' };
            lines.push(`${icons[e.category] || '📌'} ${e.content}`);
        }
        lines.push('');
        const thoughts = [
            '今天天氣不錯，適合出門走走。',
            '最近鎮上好像越來越熱鬧了呢。',
            '希望明天也是平安的一天。',
            '聽說隔壁鎮的人都羨慕我們這裡呢！',
            '寫日報寫到手酸了...不過值得。',
        ];
        lines.push(`【${reporter.name}碎碎念】`);
        lines.push(thoughts[Math.floor(Math.random() * thoughts.length)]);
        return lines.join('\n');
    }

    getLatestNewspaper() {
        return this.newspapers.length > 0 ? this.newspapers[this.newspapers.length - 1] : null;
    }

    getNewspaper(id) {
        return this.newspapers.find(n => n.id === id) || null;
    }

    toDict() {
        return {
            newspapers: this.newspapers,
            enabled: this._enabled,
            totalPublished: this.newspapers.length,
            todayEventCount: this.todayEvents.length,
        };
    }

    serialize() {
        return {
            newspapers: this.newspapers,
            todayEvents: this.todayEvents,
            _lastPublishDay: this._lastPublishDay,
            _enabled: this._enabled,
        };
    }

    loadFrom(data) {
        if (!data) return;
        this.newspapers = data.newspapers || [];
        this.todayEvents = data.todayEvents || [];
        this._lastPublishDay = data._lastPublishDay || 0;
        this._enabled = data._enabled ?? true;
    }
}
