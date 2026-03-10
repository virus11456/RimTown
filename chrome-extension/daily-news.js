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

        // Build richer NPC interaction context
        const agentList = Object.values(world.agents).filter(a => !a.isPlayer);
        const relationshipSnippets = [];
        for (const agent of agentList.slice(0, 6)) {
            if (agent.relationships) {
                const rels = Object.entries(agent.relationships).slice(0, 2);
                for (const [targetId, rel] of rels) {
                    const target = world.agents[targetId];
                    if (target && rel.affinity !== undefined) {
                        const status = rel.status || (rel.affinity > 60 ? '好友' : rel.affinity < -20 ? '不合' : '普通');
                        relationshipSnippets.push(`${agent.name}與${target.name}：${status}（好感度${rel.affinity}）`);
                    }
                }
            }
        }
        const relContext = relationshipSnippets.length ? `\n居民關係動態：\n${relationshipSnippets.slice(0, 5).join('\n')}` : '';

        // Get recent NPC conversations for richer material
        const recentConvos = world.conversationEngine?.npcConversationLog?.slice(-5) || [];
        const convoContext = recentConvos.length
            ? `\n最近的居民對話精華：\n${recentConvos.map(c => `- ${c.agentA}對${c.agentB}說了什麼，結果：${c.summary}`).join('\n')}`
            : '';

        const prompt = `你是「${reporter.name}」，${bg}
你的性格特徵：${traits}
你的職業：${reporter.job?.title || '居民'}
你正在為邊境鎮寫今天的日報——這可不是普通的報紙，而是小鎮裡人人愛看的八卦報！

今天發生的事：
${events.map(e => `- [${e.category}] ${e.content}`).join('\n')}
${relContext}
${convoContext}

目前季節：${world.clock.season} 第${world.clock.day}天（第${world.clock.year}年）
小鎮等級：${townLevel}
產業：${industries}
小鎮人口：${Object.keys(world.agents).length}人
鎮上八卦：${gossip}
${prevRef}

請用你的視角寫一篇精彩的日報（300-500字），包含：
1. 【頭條】一個吸引人的頭條標題（要有畫面感，像小說章節名）
2. 本日新聞：2-3 則新聞報導，每則要：
   - 描述具體場景和細節（誰在哪裡做了什麼，當時的氛圍如何）
   - 加入你作為記者的個人觀察和評論（可以八卦、吐槽、感動、爆料）
   - 如果涉及居民互動，要寫出他們的表情、語氣、小動作
3. 【${reporter.name}碎碎念】你個人的心情或觀察（要有溫度，像在跟讀者聊天）

寫作風格要求：
- 像小鎮八卦報，生動、有畫面感、充滿人情味
- 用具體細節取代抽象描述（不要「心情不錯」，要「嘴角藏不住笑意」）
- 善用比喻、誇張、擬人等修辭讓文字更有趣
- 記者個性要鮮明——根據你的性格特徵來決定報導角度（毒舌就吐槽、浪漫就寫愛情、嚴肅就分析局勢）
- 必須使用繁體中文（台灣用語）`;

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
