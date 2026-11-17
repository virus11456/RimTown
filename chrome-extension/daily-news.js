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
        if (this.todayEvents.length > 120) this.todayEvents = this.todayEvents.slice(-120); // v6.20.0 B12:沒出報(AI 關閉/額度用完)時素材會無限累積(35 天 1700 筆、210KB),最多留 120 筆
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

        // v5.88.0 跨鎮專欄:其他鎮最新一期日報的要聞(app 從本機存檔收集到 world.crossTownNews),最多三鎮、每鎮兩則
        const crossTown = (Array.isArray(world.crossTownNews) ? world.crossTownNews : []).slice(0, 3)
            .map(ct => ({ town: ct.town, reporter: ct.reporter, items: (ct.items || []).slice(0, 2) })).filter(ct => ct.items.length);
        if (crossTown.length) {
            const lines = [`\n\n${t('🐎 跨鎮專欄')}`];
            crossTown.forEach(ct => ct.items.forEach(line => lines.push(`· ${t(ct.town)}｜${t(line)}${ct.reporter ? `${t('（')}${t('記者')}${t('：')}${t(ct.reporter)}${t('）')}` : ''}`)));
            content = (content || '') + lines.join('\n');
            const first = crossTown[0];
            if (world.events?.conversationTopics) world.events.conversationTopics.push(`${t(first.town)}${t('的日報說：')}${t(first.items[0])}`);
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
            events: events.map(e => ({ category: e.category, content: e.content, importance: e.importance, agents: e.agents || [] })), // v5.17.0 保留關聯人物,供情境入口點擊跳轉
            publishedAt: world.tickCount,
            crossTown, // v5.88.0
        };

        this.newspapers.push(newspaper);
        this.todayEvents = [];
        return newspaper;
    }

    async _generateWithLLM(reporter, events, world) {
        // 英文介面：這份題目以前整份是中文（只有語言規則那一行會換）。固定句子改走 t()，
        // 存檔裡存中文的資料（簡介、職稱、季節、產業名）英文時查字典，分隔符號跟著換；中文介面送出去的字一個都不變。
        const EN = typeof I18N !== 'undefined' && I18N.getLang() === 'en';
        const tr = (x) => (EN && typeof x === 'string') ? t(x) : x;
        const C = EN ? ': ' : '：', LS = EN ? ', ' : '、', SS = EN ? '; ' : '；', QL = EN ? '"' : '「', QR = EN ? '"' : '」';
        const traits = (EN ? (reporter.personality?.traits || []).map(x => t((typeof TRAIT_POOL !== 'undefined' && TRAIT_POOL[x]?.label) || x)).join(LS) : reporter.personality?.traits?.join('、')) || t('普通');
        const bg = tr(reporter.personality?.background || '');
        const gossip = world.gossipNetwork?.activeGossip?.slice(-3)?.map(g => g.content)?.join(SS) || t('沒什麼特別的');
        const townLevel = world.industry?.townLevelName || t('荒村');
        const industries = world.industry?.industries
            ? Object.keys(world.industry.industries).map(k => tr(INDUSTRIES[k]?.name)).join(LS)
            : t('無');

        // Get previous newspaper summary for continuity
        const prevPaper = this.newspapers.length > 0 ? this.newspapers[this.newspapers.length - 1] : null;
        const prevRef = prevPaper ? `${t('上一期日報')}${t('（')}${t('記者')}${t('：')}${prevPaper.reporter}${t('）')}${t('的摘要')}${t('：')}${EN ? I18N.localizeNames(prevPaper.content || '', true).substring(0, 240) : (prevPaper.content || '').substring(0, 100)}...` : ''; // 英文先換人名再截：先截的話中文名被切一半就換不掉了（「阿潮」剩一個「阿」）；英文 100 個字元也只有十幾個字，放寬

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
                        relationshipSnippets.push(`${agent.name}${t('與')}${target.name}${t('：')}${status}${t('（')}${t('好感度')}${rel.affinity}${rel.romanticInterest > 30 ? t('，有浪漫火花💕') : ''}${t('）')}`);
                    }
                }
            }
        }
        const relContext = relationshipSnippets.length ? `\n${t('居民關係動態')}${C}\n${relationshipSnippets.slice(0, 8).join('\n')}` : '';

        // Get recent NPC conversations for richer material
        const recentConvos = world.conversationEngine?.npcConversationLog?.slice(-5) || [];
        const convoContext = recentConvos.length
            ? `\n${t('最近的居民對話精華')}${C}\n${recentConvos.map(c => `- ${c.agentA}${t('對')}${c.agentB}${C}${QL}${c.summary}${QR}`).join('\n')}`
            : '';

        // Town resource snapshot
        const sp = world.stockpile;
        const keyRes = sp ? ['food','wood','stone','silver','meals','tools'].filter(r => (sp[r] || 0) > 0).map(r => {
            const labels = {food:t('食物'),wood:t('木材'),stone:t('石材'),silver:t('銀幣'),meals:t('餐食'),tools:t('工具')};
            return `${labels[r]||r}:${Math.round(sp[r])}`;
        }).join(LS) : '';
        const resContext = keyRes ? `\n${t('鎮上資源概況')}${C}${keyRes}` : '';

        // Election context
        const electionCtx = world.election?.active
            ? `\n${t('選舉動態')}${C}${world.election.phase === 'campaign' ? t('競選期間') : world.election.phase === 'voting' ? t('投票進行中') : t('已結束')}${world.election.candidates ? t('，候選人：') + world.election.candidates.map(c => `${c.name}(${tr(c.policyLabel)})`).join(LS) : ''}`
            : (world.election?.mayor ? `\n${t('現任鎮長')}${C}${world.agents[world.election.mayor]?.name || t('未知')}` : '');

        // Weather / season mood
        const weather = world.news?.bulletins?.find(b => b.category === 'weather');
        const weatherCtx = weather ? `\n${t('天氣狀況')}${C}${weather.headline}` : '';

        // NPC daily activities snapshot
        const activitySnap = EN
            ? agentList.slice(0, 6).map(a => `${a.name} (${a.job?.title ? t(a.job.title) : t('無業')}): ${a.activityLabel || a.activity || a.currentAction || t('閒逛')}`).join('; ')
            : agentList.slice(0, 6).map(a => `${a.name}(${a.job?.title||t('無業')})${t('正在')}${a.activity||a.currentAction||t('閒逛')}`).join('；');
        const fill = (k, o) => { let x = t(k); for (const [a, b] of Object.entries(o || {})) x = x.split('{' + a + '}').join(String(b)); return x; };

        const prompt = `${fill('你是「{name}」，{bg}', { name: reporter.name, bg })}
${t('你的性格特徵：')}${traits}
${t('你的職業：')}${reporter.job?.title ? tr(reporter.job.title) : t('居民')}
${fill('你的年齡：{n}歲', { n: reporter.age })}
${EN ? fill('你正在為{town}寫今天的日報——這是小鎮裡人人都愛看的報紙！', { town: t(world.townName || '邊境鎮') }) : '你正在為邊境鎮寫今天的日報——這是小鎮裡人人都愛看的報紙！'}

${t('═══ 今日重要事件 ═══')}
${events.map(e => `- [${e.category}] ${e.content}`).join('\n')}

${t('═══ 鎮上情報 ═══')}
${fill('季節時間：{s} 第{d}天（第{y}年）', { s: tr(world.clock.season), d: world.clock.day, y: world.clock.year })}
${t('小鎮等級：')}${townLevel}
${t('產業：')}${industries}
${fill('人口：{n}人', { n: Object.keys(world.agents).length })}
${t('八卦消息：')}${gossip}${resContext}${weatherCtx}${electionCtx}
${relContext}
${convoContext}

${t('═══ 居民動態速寫 ═══')}
${activitySnap}

${prevRef}

${fill('請用「{name}」的第一人稱視角寫一篇精彩日報（400-600字），結構如下：', { name: reporter.name })}

${t('📰 【頭條標題】（一句話，像小說章節名，有畫面感）')}

${t('🔥 頭條報導')}
${t('用最重要的事件寫一段深度報導。要有場景描寫、人物動作表情、你的現場觀察。像是你親眼看到的一樣。')}

${t('📋 鎮務簡報')}
${t('2-3 則簡短新聞（每則1-2句），涵蓋經濟/建設/天氣/日常等不同面向。')}

${t('💬 街頭巷尾')}
${t('選一個有趣的居民互動或八卦，用對話或場景還原的方式呈現。')}

${fill('✍️ {name}手記', { name: reporter.name })}
${t('用你的個性寫一段私人感想（溫馨、毒舌、浪漫、或哲學思考都行），像在跟老朋友聊天。')}

${t('風格要求：')}
${t('- 每個段落用上述 emoji 標題開頭')}
${t('- 要有「記者人設」：根據你的性格決定語氣（毒舌就嘲諷、浪漫就抒情、務實就分析）')}
${t('- 用具體細節（「她翻了個白眼」比「她不開心」好十倍）')}
${(typeof LLM_LANG !== 'undefined') ? LLM_LANG.rule(t('- 繁體中文（台灣口語風格）'), '- Natural, colloquial English') : '- 繁體中文（台灣口語風格）'}
${t('- 不要用「本報記者」這種官腔')}`;

        const response = await world.conversationEngine.llm.chat([
            { role: 'user', content: prompt }
        ], { max_tokens: 1500 }); // v9.23.6 1200 寫中文大約 900 字就到頂,手記常寫到一半被切(線上實測 3 篇有 1 篇)

        // v9.23.6 llm.chat() 回的是字串;以前這裡只讀 .content／.choices(物件才有),AI 寫好的日報每天都被當成沒寫、改用範本
        const text = typeof response === 'string' ? response : (response?.content || response?.choices?.[0]?.message?.content || null);
        return DailyNewsEngine.tidy(text);
    }
    // AI 寫的日報收尾:沒寫完(被長度上限切斷)就收到最後一個完整句子;太短的不算數,改用範本
    static tidy(text) {
        let s = String(text == null ? '' : text).replace(/^```[a-z]*\s*|\s*```$/gi, '').trim(); if (!s) return null;
        s = s.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/^#{1,4}\s+/gm, ''); // 專欄是純文字顯示,Markdown 的粗體和標題記號會原樣露出來(英文真模型常這樣寫)
        if (!/[。！？!?….」』"”’）)~～]$/.test(s)) { const m = s.match(/^[\s\S]*[。！？!?….][」』"”’）)]?/); if (m && m[0].length >= s.length * 0.6) s = m[0].trim(); }
        return s.length >= 80 ? s : null;
    }
    // 舊報(最近 30 期以前)的 AI 專欄只留標題和頭條報導那一段:AI 寫的一篇有 900～3000 字,每天一篇全留著,一年下來存檔會多出近 1MB
    static condense(content) {
        const s = String(content || ''); if (s.length <= 700) return s;
        const i = s.search(/\n\s*(📋|💬|✍️)/); const head = (i > 40 ? s.slice(0, i) : s.slice(0, 600)).trim();
        const cross = s.indexOf('🐎'); return head + (cross > 0 ? '\n\n' + s.slice(cross).trim() : '');
    }

    _generateTemplate(reporter, events, world) {
        const catIcons = { farm:'🌾', economy:'💰', event:'⚡', relationship:'💕', politics:'🗳️',
            building:'🏗️', factory:'🏭', exploration:'🗺️', lifecycle:'👶', incident:'⚠️',
            drama:'🎭', social:'💬', town:'🏘️', industry:'⚒️' };
        const lines = [];
        lines.push(`📰 ${t('【')}${events[0]?.content || t('邊境小鎮的平凡日常')}${t('】').trim()}`);
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
        // v5.44.0 手記結尾擴充到 12 種,並依「記者+期數」決定——連續兩期、不同記者不會撞同一句
        const thoughts = [
            t('坐在廣場的長椅上寫完這篇報導，夕陽正好灑在稿紙上。'),
            t('最近鎮上的人越來越多了，每天都有新鮮事可以寫。'),
            t('希望明天也是值得記錄的一天。要是沒有新聞⋯那就寫天氣吧。'),
            t('聽說隔壁鎮的人都想來我們這裡，不知道是不是因為讀了我的日報呢？'),
            t('手都寫酸了，不過能把小鎮的故事記錄下來，這份工作還是挺值得的。'),
            t('寫到一半墨水快沒了，只好去雜貨店賒了一瓶。老闆說用報導抵帳也行。'),
            t('今天採訪時被狗追了兩條街。為了新聞，值得。'),
            t('酒館老闆說我上一期把他寫得太摳門。我考慮下期寫得更詳細一點。'),
            t('有人問我為什麼堅持寫日報。我說：因為總得有人記得這個小鎮發生過什麼。'),
            t('稿紙不夠用了。看來這個鎮的故事，比我想的還要多。'),
            t('深夜校稿時聽見窗外有人吵架。明天的頭條有了。'),
            t('把今天聽到的八卦都寫進去了⋯希望當事人看到別來找我。'),
        ];
        lines.push(`✍️ ${reporter.name}${t('手記')}`);
        let seed = (this.newspapers?.length || 0) * 7;
        for (let i = 0; i < (reporter.name || '').length; i++) seed += reporter.name.charCodeAt(i);
        lines.push(thoughts[seed % thoughts.length]);
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
        // v6.43.7 報紙一期都不刪;只是最近 30 期以前的舊報不再存「當天素材清單」(events／跨鎮專欄,只有最近幾期點開才用得到),正文、日期、記者都保留
        const keepFull = 30, n = this.newspapers.length;
        return {
            newspapers: this.newspapers.map((p, i) => (i >= n - keepFull || !p) ? p : (({ events, crossTown, ...rest }) => ({ ...rest, content: DailyNewsEngine.condense(rest.content) }))(p)),
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
