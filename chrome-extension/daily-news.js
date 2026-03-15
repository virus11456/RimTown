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
            reporterJob: reporter.job?.title || t('居民'),
            content: content,
            events: events.map(e => ({ category: e.category, content: e.content, importance: e.importance })),
            publishedAt: world.tickCount,
        };

        this.newspapers.push(newspaper);
        this.todayEvents = [];
        return newspaper;
    }

    async _generateWithLLM(reporter, events, world) {
        const traits = reporter.personality?.traits?.join('、') || t('普通');
        const bg = reporter.personality?.background || '';
        const gossip = world.gossipNetwork?.activeGossip?.slice(-3)?.map(g => g.content)?.join('；') || t('沒什麼特別的');
        const townLevel = world.industry?.townLevelName || t('荒村');
        const industries = world.industry?.industries
            ? Object.keys(world.industry.industries).map(k => INDUSTRIES[k]?.name).join('、')
            : t('無');

        // Get previous newspaper summary for continuity
        const prevPaper = this.newspapers.length > 0 ? this.newspapers[this.newspapers.length - 1] : null;
        const prevRef = prevPaper ? `${t('上一期日報')}（${t('記者')}：${prevPaper.reporter}）${t('的摘要')}：${(prevPaper.content || '').substring(0, 100)}...` : '';

        // Build richer NPC interaction context
        const agentList = Object.values(world.agents).filter(a => !a.isPlayer);
        const relationshipSnippets = [];
        for (const agent of agentList.slice(0, 8)) {
            if (agent.relationships) {
                const rels = Object.entries(agent.relationships).slice(0, 3);
                for (const [targetId, rel] of rels) {
                    const target = world.agents[targetId];
                    if (target && rel.affinity !== undefined) {
                        const status = rel.status || (rel.affinity > 60 ? t('好友') : rel.affinity < -20 ? t('不合') : t('普通'));
                        relationshipSnippets.push(`${agent.name}${t('與')}${target.name}：${status}（${t('好感度')}${rel.affinity}${rel.romanticInterest > 30 ? t('，有浪漫火花💕') : ''}）`);
                    }
                }
            }
        }
        const relContext = relationshipSnippets.length ? `\n${t('居民關係動態')}：\n${relationshipSnippets.slice(0, 8).join('\n')}` : '';

        // Get recent NPC conversations for richer material
        const recentConvos = world.conversationEngine?.npcConversationLog?.slice(-5) || [];
        const convoContext = recentConvos.length
            ? `\n${t('最近的居民對話精華')}：\n${recentConvos.map(c => `- ${c.agentA}${t('對')}${c.agentB}：「${c.summary}」`).join('\n')}`
            : '';

        // Town resource snapshot
        const sp = world.stockpile;
        const keyRes = sp ? ['food','wood','stone','silver','meals','tools'].filter(r => (sp[r] || 0) > 0).map(r => {
            const labels = {food:t('食物'),wood:t('木材'),stone:t('石材'),silver:t('銀幣'),meals:t('餐食'),tools:t('工具')};
            return `${labels[r]||r}:${Math.round(sp[r])}`;
        }).join('、') : '';
        const resContext = keyRes ? `\n${t('鎮上資源概況')}：${keyRes}` : '';

        // Election context
        const electionCtx = world.election?.active
            ? `\n${t('選舉動態')}：${world.election.phase === 'campaign' ? t('競選期間') : world.election.phase === 'voting' ? t('投票進行中') : t('已結束')}${world.election.candidates ? t('，候選人：') + world.election.candidates.map(c => `${c.name}(${c.policyLabel})`).join('、') : ''}`
            : (world.election?.mayor ? `\n${t('現任鎮長')}：${world.agents[world.election.mayor]?.name || t('未知')}` : '');

        // Weather / season mood
        const weather = world.news?.bulletins?.find(b => b.category === 'weather');
        const weatherCtx = weather ? `\n${t('天氣狀況')}：${weather.headline}` : '';

        // NPC daily activities snapshot
        const activitySnap = agentList.slice(0, 6).map(a => `${a.name}(${a.job?.title||t('無業')})${t('正在')}${a.activity||a.currentAction||t('閒逛')}`).join('；');

        const prompt = `你是「${reporter.name}」，${bg}
你的性格特徵：${traits}
你的職業：${reporter.job?.title || t('居民')}
你的年齡：${reporter.age}歲
你正在為邊境鎮寫今天的日報——這是小鎮裡人人都愛看的報紙！

═══ 今日重要事件 ═══
${events.map(e => `- [${e.category}] ${e.content}`).join('\n')}

═══ 鎮上情報 ═══
季節時間：${world.clock.season} 第${world.clock.day}天（第${world.clock.year}年）
小鎮等級：${townLevel}
產業：${industries}
人口：${Object.keys(world.agents).length}人
八卦消息：${gossip}${resContext}${weatherCtx}${electionCtx}
${relContext}
${convoContext}

═══ 居民動態速寫 ═══
${activitySnap}

${prevRef}

請用「${reporter.name}」的第一人稱視角寫一篇精彩日報（400-600字），結構如下：

📰 【頭條標題】（一句話，像小說章節名，有畫面感）

🔥 頭條報導
用最重要的事件寫一段深度報導。要有場景描寫、人物動作表情、你的現場觀察。像是你親眼看到的一樣。

📋 鎮務簡報
2-3 則簡短新聞（每則1-2句），涵蓋經濟/建設/天氣/日常等不同面向。

💬 街頭巷尾
選一個有趣的居民互動或八卦，用對話或場景還原的方式呈現。

✍️ ${reporter.name}手記
用你的個性寫一段私人感想（溫馨、毒舌、浪漫、或哲學思考都行），像在跟老朋友聊天。

風格要求：
- 每個段落用上述 emoji 標題開頭
- 要有「記者人設」：根據你的性格決定語氣（毒舌就嘲諷、浪漫就抒情、務實就分析）
- 用具體細節（「她翻了個白眼」比「她不開心」好十倍）
- 繁體中文（台灣口語風格）
- 不要用「本報記者」這種官腔`;

        const response = await world.conversationEngine.llm.chat([
            { role: 'user', content: prompt }
        ], { max_tokens: 1200 });

        return response?.content || response?.choices?.[0]?.message?.content || null;
    }

    _generateTemplate(reporter, events, world) {
        const catIcons = { farm:'🌾', economy:'💰', event:'⚡', relationship:'💕', politics:'🗳️',
            building:'🏗️', factory:'🏭', exploration:'🗺️', lifecycle:'👶', incident:'⚠️',
            drama:'🎭', social:'💬', town:'🏘️', industry:'⚒️' };
        const lines = [];
        lines.push(`📰 【${events[0]?.content || t('邊境小鎮的平凡日常')}】`);
        lines.push('');
        lines.push(t('🔥 頭條報導'));
        lines.push(events[0]?.content || t('今天是平靜的一天，鎮上一切如常。'));
        lines.push('');
        if (events.length > 1) {
            lines.push(t('📋 鎮務簡報'));
            for (const e of events.slice(1, 4)) {
                lines.push(`${catIcons[e.category] || '📌'} ${e.content}`);
            }
            lines.push('');
        }
        const thoughts = [
            t('坐在廣場的長椅上寫完這篇報導，夕陽正好灑在稿紙上。'),
            t('最近鎮上的人越來越多了，每天都有新鮮事可以寫。'),
            t('希望明天也是值得記錄的一天。要是沒有新聞⋯那就寫天氣吧。'),
            t('聽說隔壁鎮的人都想來我們這裡，不知道是不是因為讀了我的日報呢？'),
            t('手都寫酸了，不過能把小鎮的故事記錄下來，這份工作還是挺值得的。'),
        ];
        lines.push(`✍️ ${reporter.name}${t('手記')}`);
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
