// RimTown - sim-conversation.js：從 simulation.js 拆出的 鎮民動態、八卦網、對話引擎 ConversationEngine、LLM 客戶端（v6.1.0 B14）。
// 純粹搬移頂層宣告，共用全域詞法範圍；載入順序：sim-agent → sim-conversation → sim-town → sim-economy → sim-society → simulation(World) → sim-systems（index.html／rimtown.php／sw.js 都要列）。
// --- Gossip Network ---
// --- v5.2.0 鎮民動態(小鎮朋友圈) ---
class TownFeedSystem {
    constructor() { this.posts = []; this._counter = 0; this._lastLlmPostTick = -9999; }
    addPost(world, author, text, opts = {}) {
        this._counter++;
        const post = {
            id: 'p' + this._counter, authorId: author.agentId, authorName: author.name,
            text, time: world.clock.timeStr,
            day: `${t('第')}${world.clock.year}${t('年')} ${world.clock.season} ${t('第')}${world.clock.day}${t('天')}`,
            tick: world.tickCount, likes: [], comments: opts.comments || [],
        };
        this.posts.push(post);
        if (this.posts.length > 120) this.posts = this.posts.slice(-120);
        world._feedUnread = (world._feedUnread || 0) + 1;
        return post;
    }
    serialize() { return { posts: this.posts.slice(-80), _counter: this._counter }; }
    load(d) { if (d) { this.posts = Array.isArray(d.posts) ? d.posts : []; this._counter = d._counter || 0; } }
}

class GossipNetwork {
    constructor() { this.activeGossip = []; }
    // v5.3.0 針對真實關係事件生成「有內容」的八卦(取代空泛的「八卦了全鎮的事」)
    createRelGossip(world, kind, a, b, extra) {
        const templates = {
            crush:   [`${t('欸你有沒有發現,')}${a.name}${t('看')}${b.name}${t('的眼神不太一樣...')}`,
                      `${t('我猜')}${a.name}${t('對')}${b.name}${t('有意思,不然幹嘛老是找藉口靠近!')}`],
            jealous: [`${t('聽說')}${a.name}${t('最近超針對')}${b.name}${t('的,好像是為了')}${extra || t('某個人')}${t('...')}`,
                      `${a.name}${t('跟')}${b.name}${t('之間氣氛好僵,是在吃醋吧?')}`],
            newCouple:[`${t('天大的消息!')}${a.name}${t('和')}${b.name}${t('在一起了!')}`,
                      `${a.name}${t('跟')}${b.name}${t('湊成一對了,大家都說很配!')}`],
            rivalry: [`${a.name}${t('和')}${b.name}${t('鬧翻了,見面都不講話...')}`,
                      `${t('你敢信嗎?')}${a.name}${t('跟')}${b.name}${t('現在是死對頭了。')}`],
        };
        const pool = templates[kind]; if (!pool) return null;
        const content = pickRandom(pool);
        const gossip = { about: a.name, content, source: t('鎮民'), spreadCount: 0, tickCreated: world.tickCount, isTrue: true, kind, juicy: true };
        this.activeGossip.push(gossip);
        if (this.activeGossip.length > 10000) this.activeGossip = this.activeGossip.slice(-10000);
        // 直接進八卦頭條 & 每日報
        world.logMessage('gossip', `🗞️ ${content}`, a.name, b.name);
        if (world.dailyNews) world.dailyNews.collectEvent('gossip', content, kind === 'newCouple' ? 7 : 5, [a.name, b.name]);
        return gossip;
    }
    createGossip(source, about, world) {
        const rel = source.relationships.getOrCreate(about.agentId, about.name);
        const templates = [];
        if (rel.romanticInterest > 40) templates.push(`${t('你不覺得')}${about.name}${t('挺有魅力的嗎？')}`);
        if (rel.affinity < -10) templates.push(`${t('說真的，')}${about.name}${t('最近行為很奇怪。')}`);
        if (about.mood < -20) templates.push(`${t('你有注意到')}${about.name}${t('最近看起來很低落嗎？')}`);
        if (about.mood > 50) templates.push(`${about.name}${t('最近心情超好的！')}`);
        const ri = about.relationships.getRomanticInterests();
        if (ri.length) templates.push(`${t('聽說')}${about.name}${t('好像對')}${pickRandom(ri).targetName}${t('有意思！')}`);
        const partner = about.relationships.getPartner();
        if (partner) {
            if (partner.status === 'dating') templates.push(`${about.name}${t('和')}${partner.targetName}${t('在交往呢，你知道嗎？')}`);
            if (partner.status === 'married') templates.push(`${about.name}${t('和')}${partner.targetName}${t('的婚姻生活不知道怎麼樣？')}`);
            if (partner.isCheating) templates.push(`${t('我好像看到')}${about.name}${t('背著')}${partner.targetName}${t('跟別人在一起⋯⋯')}`);
        }
        const aboutPartner = about.relationships.getPartner();
        const cheatingRels = Object.values(about.relationships.relationships).filter(r => r.isCheating);
        if (cheatingRels.length) templates.push(`${t('你聽說了嗎？')}${about.name}${t('好像在劈腿⋯⋯')}`);
        if (!templates.length) templates.push(`${t('你聽說')}${about.name}${t('昨天在做什麼嗎？')}`);
        const content = pickRandom(templates);
        const gossip = { about:about.name, content, source:source.name, spreadCount:0, tickCreated:world.tickCount, isTrue:Math.random()>0.2 };
        this.activeGossip.push(gossip);
        if (this.activeGossip.length > 10000) this.activeGossip = this.activeGossip.slice(-10000);
        return gossip;
    }
    spreadGossip(speaker, listener, world) {
        if (!this.activeGossip.length) return null;
        const eligible = this.activeGossip.filter(g => g.about !== listener.name);
        if (!eligible.length) return null;
        if (!speaker.personality.traits.includes('gossip') && Math.random() > 0.3) return null;
        const gossip = pickRandom(eligible);
        gossip.spreadCount++;
        // v5.2.0/5.3.0 傳話遊戲:謠言誇張化只做一次,不重複堆疊
        if (!gossip._mutated && gossip.spreadCount >= 2 && Math.random() < 0.4) {
            gossip._mutated = true;
            const wraps = [
                (c) => `${t('我跟你說,')}${c}${t('而且好像不只這樣...')}`,
                (c) => `${t('千真萬確!')}${c}`,
                (c) => `${c}${t('聽說整條街都知道了!')}`,
            ];
            gossip.content = pickRandom(wraps)(gossip.content);
        }
        listener.memory.add(world.tickCount, world.clock.timeStr, 'social',
            `${speaker.name}${t('告訴我：「')}${gossip.content}${t('」')}`, 4, [speaker.name, gossip.about]);
        // v5.3.0 只有「有內容」且還算新鮮(傳不到 3 手)的八卦才進頭條,避免同一則洗版
        if (gossip.juicy && gossip.spreadCount <= 3) {
            world.logMessage('gossip', `🗣️ ${speaker.name}${t('偷偷說：「')}${gossip.content}${t('」')}`, speaker.name, listener.name);
        }
        // v5.2.0 傳到第 4 手,當事人聽到了 → 對質
        if (gossip.spreadCount >= 4 && !gossip._confronted) {
            gossip._confronted = true;
            this._handleGossipReachesSubject(gossip, world);
        }
        return gossip;
    }

    // v5.2.0 謠言傳回當事人耳裡:負面/不實 → 找源頭對質;正面 → 感謝
    _handleGossipReachesSubject(gossip, world) {
        const subject = Object.values(world.agents).find(a => a.name === gossip.about);
        if (!subject || subject.isPlayer) return;
        const source = Object.values(world.agents).find(a => a.name === gossip.source);
        const negative = gossip.tone === 'diss' || !gossip.isTrue || /奇怪|劈腿|背著|懶散/.test(gossip.content);
        const positive = gossip.tone === 'praise';
        if (source && source.isPlayer) {
            // 玩家是造謠源頭!
            const relToPlayer = subject.relationships.getOrCreate(source.agentId, source.name);
            if (positive) {
                relToPlayer.modifyAffinity(6);
                subject.addThought('praised', world, source.agentId, source.name); // v5.15.0 被公開稱讚
                subject.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('聽說')}${source.name}${t('到處誇我,真開心!')}`, 6, [source.name]);
                source.chatHistory?.push?.({ speaker: subject.name, target: source.name, text: t('欸,我聽說你到處跟人誇我?哈哈,謝啦,請你喝一杯!'), time: world.clock.timeStr });
                world.logMessage('gossip', `💐 ${subject.name}${t('聽到了')}${playerTitle(world)}${t('的美言,好感大增!')}`, subject.name);
            } else if (negative) {
                relToPlayer.modifyAffinity(-12); relToPlayer.modifyTrust(-10);
                subject.addThought('slandered', world, source.agentId, source.name); // v5.15.0 被說壞話
                subject.memory.add(world.tickCount, world.clock.timeStr, 'social', `${t('居然是')}${source.name}${t('在背後說我壞話...太過分了。')}`, 8, [source.name]);
                source.chatHistory?.push?.({ speaker: subject.name, target: source.name, text: t('我都聽說了。你在背後那樣說我?虧我還這麼信任你。'), time: world.clock.timeStr });
                world.logMessage('gossip', `💢 ${subject.name}${t('發現')}${source.name}${t('在背後說他壞話,關係惡化!')}`, subject.name);
            }
            if (world.conversationEngine?.onNpcMessage) world.conversationEngine.onNpcMessage(subject.agentId);
        } else if (source && negative && source !== subject) {
            const relA = subject.relationships.getOrCreate(source.agentId, source.name);
            const relB = source.relationships.getOrCreate(subject.agentId, subject.name);
            relA.modifyAffinity(-12); relB.modifyAffinity(-8);
            world.logMessage('gossip', `💢 ${subject.name}${t('聽到了')}${source.name}${t('散布的謠言,當面對質!兩人關係惡化')}`, subject.name, source.name);
            if (world.dailyNews) world.dailyNews.collectEvent('drama', `${subject.name}${t('為了謠言找')}${source.name}${t('對質!')}`, 7, [subject.name, source.name]);
            // 當事人在鎮民動態發文澄清
            world.townFeed?.addPost(world, subject, pickRandom([
                `${t('最近聽到一些關於我的傳言。清者自清,懶得解釋。')}`,
                `${t('有些人嘴巴可以積點德嗎?')}`,
                `${t('謠言止於智者。就這樣。')}`,
            ]));
        }
        // v5.2.0 亂點鴛鴦:紅娘謠言讓兩位當事人開始注意彼此
        if (gossip.tone === 'ship' && gossip.shipWith) {
            const other = Object.values(world.agents).find(a => a.name === gossip.shipWith);
            if (other && !subject.isPlayer && !other.isPlayer && !subject.relationships.getPartner() && !other.relationships.getPartner()) {
                subject.relationships.getOrCreate(other.agentId, other.name).modifyRomantic(randInt(3, 6));
                other.relationships.getOrCreate(subject.agentId, subject.name).modifyRomantic(randInt(3, 6));
                world.logMessage('gossip', `💘 ${t('被大家起鬨之後,')}${subject.name}${t('和')}${gossip.shipWith}${t('好像真的開始注意彼此了...')}`, subject.name);
            }
        }
    }

    // v5.2.0 玩家放話:把八卦丟進謠言網路
    playerSeedGossip(world, player, listener, about, tone, shipWith) {
        const templates = {
            praise: [`${about.name}${t('最近超罩的,大家都該學學!')}`, `${t('我覺得')}${about.name}${t('是鎮上最可靠的人。')}`],
            diss: [`${about.name}${t('最近很懶散,大家小心點...')}`, `${t('說真的,')}${about.name}${t('私底下跟表面不太一樣喔...')}`],
            ship: [`${about.name}${t('和')}${shipWith || ''}${t('是不是有什麼?我看他們常常眉來眼去...')}`],
        };
        const content = pickRandom(templates[tone] || templates.praise);
        const gossip = {
            about: about.name, content, source: player.name, spreadCount: 1,
            tickCreated: world.tickCount, isTrue: tone === 'praise', tone,
            shipWith: shipWith || null,
        };
        this.activeGossip.push(gossip);
        if (this.activeGossip.length > 10000) this.activeGossip = this.activeGossip.slice(-10000);
        listener.memory.add(world.tickCount, world.clock.timeStr, 'social', `${player.name}${t('偷偷跟我說:「')}${content}${t('」')}`, 5, [player.name, about.name]);
        world.logMessage('gossip', `🗣️ ${playerTitle(world)}${t('偷偷向')}${listener.name}${t('爆料了')}${about.name}${t('的事...')}`, player.name, listener.name);
        return gossip;
    }
}

// --- Conversation Engine (Personality-Driven + LLM) ---
class ConversationEngine {
    constructor(llmClient = null) {
        this.llm = llmClient;
        this.npcConversationLog = [];
        this._lastNpcLlmTick = 0;
        this._npcLlmCooldownTicks = 8; // Minimum ticks between NPC LLM calls
        this.onConversation = null; // Callback: (agentAId, agentBId, agentAName, agentBName, textA, textB) => {}
        this._lastNpcMsgTick = 0;
        this._npcMsgCooldownTicks = 30; // ~1 minute between proactive NPC messages
        this.onNpcMessage = null; // Callback: (npcId) => {} — notify UI of incoming message
        // v5.29.0 混合成本控制:app.js 注入「該 NPC 是否在玩家附近」的判定(8 格內)
        this.isNearPlayer = null; // (agentId) => bool
        // v5.37.0 全鎮 LLM 行程:每天為每位村民排隊生成「近況+分解式行程」,一次一位避免瞬間打爆 API
        this._planQueue = [];
        this._planBusy = false;
    }

    // v5.29.0 NPC↔NPC 對話每日 LLM 額度(可在設定頁調整;玩家聊天/劇情名場面不受限)
    // v5.37.0 預設改為無上限(金鑰是使用者自己的);想控費可在設定頁填數字,填 0 = 關閉 NPC 對話 LLM
    npcLlmDailyBudget() {
        try {
            const raw = localStorage.getItem('rimtown_npc_llm_budget');
            if (raw === null || raw === '') return Infinity;
            const v = parseInt(raw, 10);
            if (Number.isFinite(v) && v >= 0) return v;
        } catch (e) {}
        return Infinity;
    }

    // NPC↔NPC 對話是否允許用 LLM:雙方任一在玩家附近 + 今日額度未用完
    _npcLlmAllowed(world, agentA, agentB) {
        if ((world.npcLlmUsedToday || 0) >= this.npcLlmDailyBudget()) return false;
        if (this.isNearPlayer) {
            return this.isNearPlayer(agentA.agentId) || this.isNearPlayer(agentB.agentId);
        }
        // 沒有地圖座標時退回「跟玩家同地點」判定
        const player = world.agents['player'];
        return !!player && (agentA.currentLocation === player.currentLocation || agentB.currentLocation === player.currentLocation);
    }

    _countNpcLlmUse(world) { world.npcLlmUsedToday = (world.npcLlmUsedToday || 0) + 1; }

    // v5.37.0 全鎮 LLM 行程(移植 generative_agents plan.py 的階層式規劃):
    // 每天清晨把所有村民排進隊伍,每個 tick 生成一位的「近況修訂 + 今日行程(含子步驟分解)」。
    // 玩家附近/劇情相關的村民優先,額度用完的村民保留規則式行程,不會空白。
    queueDailyPlans(world) {
        // v5.39.1 只排「今天還沒有 AI 行程」的村民:讀檔/開頁中途補生成時不會重做已完成的人
        const todayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead && a.currentLocation !== 'exploration'
            && !(a.dailyPlan?.llm && a.dailyPlan.key === todayKey));
        // 優先序:玩家附近 > 昨日記憶精彩(重要度總分高) > 其餘
        const TICKS_PER_DAY = 96;
        const since = world.tickCount - TICKS_PER_DAY;
        const scoreOf = (a) => {
            let s = a.memory.entries.filter(e => e.tick >= since).reduce((sum, e) => sum + (e.importance || 3), 0);
            if (this.isNearPlayer && this.isNearPlayer(a.agentId)) s += 1000;
            return s;
        };
        this._planQueue = npcs.sort((a, b) => scoreOf(b) - scoreOf(a)).map(a => a.agentId);
    }

    async tickPlanQueue(world) {
        if (this._planBusy || !this._planQueue.length) return;
        if (!this.llm || !this.llm._canMakeRequest(false)) return;
        if ((world.npcLlmUsedToday || 0) >= this.npcLlmDailyBudget()) { this._planQueue = []; return; }
        // v5.39.0 批次生成:一次呼叫規劃 3 位,省下每次重複的規則/格式前綴(輸入省約三成;輸出內容不變)
        const batch = [];
        while (batch.length < 3 && this._planQueue.length) {
            const npc = world.agents[this._planQueue.shift()];
            if (npc && !npc.isDead && !npc.isPlayer) batch.push(npc);
        }
        if (!batch.length) return;
        this._planBusy = true;
        try {
            this._countNpcLlmUse(world);
            await this._generatePlansBatchLLM(batch, world);
        } catch (e) { console.warn('[RimTown] plan LLM failed:', e); }
        finally { this._planBusy = false; }
    }

    // v5.39.0 批次行程生成:共用「環境+任務+格式」前綴,逐人附上素材;逐人容錯套用
    async _generatePlansBatchLLM(npcs, world) {
        const TICKS_PER_DAY = 96;
        const since = world.tickCount - TICKS_PER_DAY;
        const fest = world.festivals?.activeFestival;
        const ctx = [];
        if (fest) ctx.push(`${t('今天是')}${fest.name}${t('：')}${fest.description}`);
        if (world.election?.phase && world.election.phase !== 'none') ctx.push(t('鎮長選舉正在進行,鎮上都在討論。'));
        const wType = world.weather?.current;
        if (wType?.name) ctx.push(`${t('天氣：')}${wType.name}`);
        const sections = npcs.map((npc, i) => {
            const p = this._buildCharacterProfile(npc);
            const memos = npc.memory.entries.filter(e => e.category === 'plan' && e.tick >= since).slice(-3).map(m => `- ${m.content}`).join('\n');
            const topMem = npc.memory.entries.filter(e => e.tick >= since && e.category !== 'plan')
                .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 4).map(m => `- ${m.content}`).join('\n');
            const thought = npc.memory.getThoughts(1)[0]?.content || '';
            const prevCurrently = npc.currently || npc.getPersonaStatus(world);
            return `=== ${t('居民')} ${i + 1}${t('：')}${p.name} ===
${p.age}${t('歲')}${p.job}${t('，性格')}${p.traits}${t('。')}${p.status}
${t('【作息】')}${npc.getLifestyleText()}
${t('【目前近況】')}${prevCurrently}
${memos ? `${t('【昨天的約定/待辦】')}\n${memos}` : ''}
${topMem ? `${t('【昨天印象最深的事】')}\n${topMem}` : ''}
${thought ? `${t('【心裡的體悟】')}- ${thought}` : ''}`;
        }).join('\n\n');
        const prompt = `${t('你在為模擬小鎮「邊境鎮」的居民規劃真實的一天。像寫小說一樣,讓行程反映每個人的性格、人際與心事。')}
${ctx.length ? `${t('【今日環境】')}${ctx.join(t('；'))}` : ''}

${sections}

${t('【任務】為上面每一位居民:')}
1. ${t('根據昨天發生的事,把「近況」改寫成一句 40 字內的人生此刻主線(第三人稱,像「正在存錢想開自己的麵包店,最近和XX走得很近」)。')}
2. ${t('生成今天的行程:5-6 個時段,每個時段 2-3 個具體的小動作(像「揉麵團」「跟熟客閒聊兩句」,不要抽象標籤)。行程要呼應約定、心事與性格,工作時段要符合作息。')}
${LLM_LANG.rule(t('【規則】繁體中文(台灣用語)。只輸出 JSON,不要其他文字：'), '[Rules] Write all text in natural English. Output JSON only, nothing else:')}
{"plans": [{"name": "${t('居民姓名')}", "currently": "...", "plan": [{"time": "06:00", "text": "${t('時段在做什麼')}", "steps": ["${t('小動作1')}", "${t('小動作2')}"]}]}]}`;
        const response = await this.llm.generate(prompt, 450 * npcs.length + 100, 0.85, false);
        if (!response || response === '__ERROR__' || response === '__RATE_LIMITED__') return;
        let data = null;
        try {
            const js = response.indexOf('{'), je = response.lastIndexOf('}') + 1;
            if (js >= 0 && je > js) data = JSON.parse(response.slice(js, je));
        } catch (e) {}
        if (!data) {
            // 截斷救援:砍到最後一個完整的人再閉合陣列,至少救回前幾位
            try {
                const js = response.indexOf('{');
                const cut = response.lastIndexOf('}]}');
                if (js >= 0 && cut > js) data = JSON.parse(response.slice(js, cut + 3) + ']}');
            } catch (e) { return; }
        }
        if (!data) return;
        const plans = Array.isArray(data.plans) ? data.plans : (Array.isArray(data.plan) ? [data] : []);
        for (const entry of plans) {
            const name = String(entry?.name || '').trim();
            let npc = npcs.find(n => n.name === name);
            if (!npc && plans.length === 1 && npcs.length === 1) npc = npcs[0];
            if (npc) this._applyPlanData(npc, entry, world);
        }
    }

    // v5.41.0 即時重規劃(移植 generative_agents 的 react/replan):
    // 白天碰到夠重大的事(約定/強烈情緒的對話、耳語、劇情名場面)時,當場改寫「現在之後」的行程。
    // 節流:每位村民每天最多 2 次、共用每日額度、21:00 後不再改(剩沒幾個時段)。
    _canReplan(npc, world) {
        const dayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        if (npc._replanDay !== dayKey) { npc._replanDay = dayKey; npc._replanCount = 0; }
        if ((npc._replanCount || 0) >= 2) return false;
        if (world.clock.hour >= 21 || world.clock.hour < 5) return false;
        if (!this.llm || !this.llm._canMakeRequest(false)) return false;
        if ((world.npcLlmUsedToday || 0) >= this.npcLlmDailyBudget()) return false;
        return true;
    }

    async replanRestOfDay(npc, world, reason) {
        try {
            if (!npc || npc.isPlayer || npc.isDead) return;
            if (!this._canReplan(npc, world)) return;
            npc._replanCount = (npc._replanCount || 0) + 1;
            this._countNpcLlmUse(world);
            const toMin = (s) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; };
            const nowMin = world.clock.hour * 60 + world.clock.minute;
            const nowStr = `${String(world.clock.hour).padStart(2, '0')}:${String(world.clock.minute).padStart(2, '0')}`;
            const blocks = npc.dailyPlan?.blocks || [];
            const past = blocks.filter(b => { const s = toMin(b.time); return s != null && s <= nowMin; });
            const p = this._buildCharacterProfile(npc);
            const planText = blocks.length ? blocks.map(b => `${b.time} ${b.text}`).join(t('；')) : (npc.dailyPlan?.goals || []).join(t('；'));
            const shortReason = String(reason || '').slice(0, 80);
            const prompt = `${t('你在為模擬小鎮「邊境鎮」的居民「即時調整」今天的行程——他剛遇到一件事,接下來的安排要跟著變。')}
${t('【居民】')}${p.name}${t('，')}${p.age}${t('歲')}${p.job}${t('，性格')}${p.traits}${t('。')}${p.status}
${t('【現在時刻】')}${nowStr}
${planText ? `${t('【今天原本的安排】')}${planText}` : ''}
${t('【剛剛發生的事】')}${shortReason}

${t('【任務】依這件事改寫「現在之後」的行程:2-4 個時段(時間必須晚於現在),每時段 1-3 個小動作。若約好了時間/地點務必排進去;沒被影響的原安排可以保留;睡覺時間照舊。')}
${LLM_LANG.rule(t('【規則】繁體中文(台灣用語)。只輸出 JSON,不要其他文字：'), '[Rules] Write all text in natural English. Output JSON only, nothing else:')}
{"plan": [{"time": "HH:MM", "text": "${t('時段在做什麼')}", "steps": ["${t('小動作1')}"]}]}`;
            const response = await this.llm.generate(prompt, 350, 0.85, false);
            if (!response || response === '__ERROR__' || response === '__RATE_LIMITED__') return;
            let data = null;
            try {
                const js = response.indexOf('{'), je = response.lastIndexOf('}') + 1;
                if (js >= 0 && je > js) data = JSON.parse(response.slice(js, je));
            } catch (e) { return; }
            const fresh = (Array.isArray(data?.plan) ? data.plan : []).filter(b => b && b.text && (toMin(b.time) || 0) > nowMin)
                .slice(0, 5).map(b => ({
                    time: String(b.time || '').slice(0, 5),
                    text: String(b.text).slice(0, 60),
                    steps: (Array.isArray(b.steps) ? b.steps : []).filter(Boolean).slice(0, 3).map(s => String(s).slice(0, 40)),
                }));
            if (!fresh.length) return;
            const key = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
            const merged = [...past, ...fresh];
            npc.dailyPlan = { key, goals: merged.map(b => `${b.time} ${b.text}`), blocks: merged, llm: true, replanned: true };
            npc.memory.add(world.tickCount, world.clock.timeStr, 'plan', `${t('因為「')}${shortReason.slice(0, 40)}${t('」,我改變了今天接下來的安排。')}`, 5, []);
            world.logMessage('thought', `📝 ${npc.name}${t('臨時改變了今天的安排')}`, npc.name);
        } catch (e) { console.warn('[RimTown] replan failed:', e); }
    }

    _applyPlanData(npc, data, world) {
        if (!data || !Array.isArray(data.plan) || !data.plan.length) return;
        const blocks = data.plan.filter(b => b && b.text).slice(0, 8).map(b => ({
            time: String(b.time || '').slice(0, 5),
            text: String(b.text).slice(0, 60),
            steps: (Array.isArray(b.steps) ? b.steps : []).filter(Boolean).slice(0, 3).map(s => String(s).slice(0, 40)),
        }));
        if (!blocks.length) return;
        const key = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
        npc.dailyPlan = { key, goals: blocks.map(b => `${b.time} ${b.text}`), blocks, llm: true };
        if (typeof data.currently === 'string' && data.currently.trim()) {
            npc.currently = data.currently.trim().slice(0, 80);
        }
    }

    // v5.29.0 每日反思(移植 generative_agents reflect),v5.35.0 豐富化:
    // 1) 規則式(零成本):每位村民每天合成 1-2 條想法(人際 + 生活/夢想/事件) + 1 條昨日印象觀察
    // 2) LLM 深度反思:每天最多 3 位(挑昨日記憶重要度最高者),生成內心體悟
    async dailyReflection(world) {
        const TICKS_PER_DAY = 96;
        const since = world.tickCount - TICKS_PER_DAY;
        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead);
        const scored = [];
        for (const npc of npcs) {
            const recent = npc.memory.entries.filter(e => e.tick >= since && e.category !== 'reflection' && e.category !== 'observation');
            // 規則式想法 1:昨天跟誰互動最多 → 依好感方向合成
            const counts = {};
            recent.forEach(e => (e.relatedAgents || []).forEach(nm => { if (nm && nm !== npc.name) counts[nm] = (counts[nm] || 0) + 1; }));
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            if (top && top[1] >= 3) {
                const [topName] = top;
                const rel = Object.values(npc.relationships.relationships).find(r => r.targetName === topName);
                const aff = rel ? rel.affinity : 0;
                let text;
                if (rel && (rel.status === 'dating' || rel.status === 'married')) text = pickRandom([`${t('最近和')}${topName}${t('的感情越來越深了。')}`, `${t('有')}${topName}${t('在身邊的日子,連工作都不覺得累。')}`]);
                else if (aff > 40) text = pickRandom([`${t('我最近跟')}${topName}${t('走得很近，有這樣的朋友真好。')}`, `${topName}${t('這個人,值得深交。')}`]);
                else if (aff < -20) text = pickRandom([`${topName}${t('最近老是跟我過不去，想到就煩。')}`, `${t('再讓')}${topName}${t('這樣下去,我遲早要跟他攤牌。')}`]);
                else text = `${t('最近常碰到')}${topName}${t('，這人比我想的有意思。')}`;
                const dup = npc.memory.entries.some(e => e.category === 'reflection' && e.tick >= since && e.relatedAgents.includes(topName));
                if (!dup) npc.memory.add(world.tickCount, world.clock.timeStr, 'reflection', text, 6, [topName]);
            }
            // v5.35.0 規則式想法 2:生活面(夢想/暗戀/需求/天氣/祭典),每天最多一條
            try {
                const lifePool = [];
                const goal = world.lifeGoals?.getGoal?.(npc.agentId);
                const def = goal && !goal.done && typeof LIFE_GOALS !== 'undefined' ? LIFE_GOALS[goal.goalId] : null;
                if (def) lifePool.push(`${t('離「')}${def.name}${t('」還有多遠呢...但我不會停下來的。')}`, `${t('夜裡想起我的夢想:')}${def.stages[goal.stage] || ''}${t('。明天再往前一步吧。')}`);
                const crush = npc.relationships.getRomanticInterests().filter(r => !r.status)[0];
                if (crush) lifePool.push(`${t('今天又想起')}${crush.targetName}${t('...我到底在期待什麼呢。')}`, `${t('要是能跟')}${crush.targetName}${t('多說上幾句話就好了。')}`);
                if (npc.needs.social < 35) lifePool.push(t('好久沒跟人好好說話了,心裡悶悶的。'));
                if (world.weather?.current?.type === 'rain' || world.weather?.current?.type === 'storm') lifePool.push(t('聽著雨聲,思緒飄得很遠。'));
                if (world.festivals?.activeFestival) lifePool.push(`${world.festivals.activeFestival.name}${t('的熱鬧還在耳邊,好日子總是過得快。')}`);
                if (npc.personality.traits.includes('gossip')) lifePool.push(t('今天聽到的八卦,不知道是真是假...明天再打聽打聽。'));
                if (lifePool.length && Math.random() < 0.5) {
                    npc.memory.add(world.tickCount, world.clock.timeStr, 'reflection', pickRandom(lifePool), 4, []);
                }
            } catch (e) {}
            // v5.35.0 昨日印象:一條低重要度的觀察記憶,讓今日足跡/檢索有生活質感
            try {
                const wType = world.weather?.current?.type || 'clear';
                const obsPool = [
                    `${t('在')}${(npc.job?.workplace || npc.homeLocation).replace(/_/g, ' ')}${t('忙了一整天,手都酸了。')}`,
                    wType === 'rain' ? t('昨天雨下個不停,路上都是泥。') : wType === 'snow' ? t('昨天雪景很美,屋簷都白了。') : t('昨天天色不錯,鎮上人來人往。'),
                    `${t('路過廣場時聞到烤麵包的香味,肚子咕嚕叫了。')}`,
                    `${t('聽見酒館傳來笑聲,小鎮的日子就是這樣熱熱鬧鬧的。')}`,
                ];
                npc.memory.add(world.tickCount, world.clock.timeStr, 'observation', pickRandom(obsPool), 2, []);
            } catch (e) {}
            const score = recent.reduce((s, e) => s + (e.importance || 5), 0);
            if (score >= 40) scored.push({ npc, recent, score });
        }
        // LLM 深度反思:每天最多 3 位,吃 NPC LLM 額度;挑昨日最精彩的村民
        scored.sort((a, b) => b.score - a.score);
        for (const { npc, recent } of scored.slice(0, 3)) {
            if (!this.llm || !this.llm._canMakeRequest(false)) break;
            if ((world.npcLlmUsedToday || 0) >= this.npcLlmDailyBudget()) break;
            try {
                const topMem = recent.slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 6)
                    .map(m => `- ${m.content}`).join('\n');
                const pN = this._buildCharacterProfile(npc);
                const prompt = `${t('你正在扮演「')}${pN.name}${t('」——')}${pN.age}${t('歲的')}${pN.job}${t('，性格')}${pN.traits}${t('。')}
${t('夜深了，你回想今天發生的事：')}
${topMem}

${t('【任務】寫下你今晚睡前心裡最深的一個體悟——關於某個人、某段關係、或你自己的處境。')}
${LLM_LANG.rule(t('【規則】繁體中文（台灣用語），只寫一句話，第一人稱，有情感、有觀點，不要流水帳。不要加引號或其他文字。'), '[Rules] Natural English, one sentence only, first person, with feeling and a point of view, not a log. No quotes or other text.')}`;
                this._countNpcLlmUse(world);
                const response = await this.llm.generate(prompt, 120, 0.9, false);
                if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                    const text = response.trim().replace(/^["「『]|["」』]$/g, '').replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                    if (text) {
                        const related = [...new Set(recent.flatMap(m => m.relatedAgents || []))].slice(0, 3);
                        npc.memory.add(world.tickCount, world.clock.timeStr, 'reflection', text, 8, related);
                        world.logMessage('thought', `💭 ${npc.name}${t('的內心：')}${text}`, npc.name);
                    }
                }
            } catch (e) { console.error('[RimTown] dailyReflection LLM failed:', e); }
        }
    }

    // v5.35.0 耳語植入(移植 generative_agents whisper):把玩家的一句話轉寫成
    // NPC 第一人稱的內心念頭,寫入記憶流——他會當成自己的想法,影響之後的對話與反思
    async plantWhisper(player, npc, text, world) {
        let thought = '', fx = {};
        if (this.llm) {
            try {
                const pN = this._buildCharacterProfile(npc);
                const prompt = `${t('你在為模擬遊戲處理「耳語植入」：玩家在村民耳邊低語,這句話會化成村民自己的內心念頭。')}
${t('村民：')}${pN.name}${t('，')}${pN.age}${t('歲')}${pN.job}${t('，性格')}${pN.traits}${t('。')}
${t('玩家的耳語：「')}${text}${t('」')}

${t('【任務】把耳語轉寫成這位村民會相信的「第一人稱內心念頭」——像是他自己冒出的想法,符合他的性格與口吻。')}
${LLM_LANG.rule(t('【規則】繁體中文（台灣用語），只寫一句話。多疑或與他認知矛盾時可以寫成半信半疑的念頭。不要引號。'), '[Rules] Natural English, one sentence only. If suspicious or contradictory to what they know, write it as a half-believed thought. No quotes.')}
${t('最後一行：')}EFFECTS: {"target": "${t('若念頭涉及某位村民寫其姓名,否則空字串')}", "affinity_change": ${t('數字')}(-8${t('到')}8), "romantic_change": ${t('數字')}(0${t('到')}8)}`;
                const response = await this.llm.generate(prompt, 250, 0.9, true);
                if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                    const lines = response.trim().split('\n').filter(Boolean);
                    const fxLine = lines.find(l => l.includes('EFFECTS:'));
                    if (fxLine) { try { const js = fxLine.indexOf('{'); fx = JSON.parse(fxLine.slice(js)); } catch (e) {} }
                    thought = lines.filter(l => !l.includes('EFFECTS:')).join(' ').replace(/^["「『]|["」』]$/g, '').trim();
                }
            } catch (e) { console.error('[RimTown] whisper LLM failed:', e); }
        }
        if (!thought) thought = text; // 沒有 LLM 就原文植入
        const targets = [];
        // 念頭涉及的村民:LLM 給的 target,或直接掃描文字中出現的村民名
        const targetName = typeof fx.target === 'string' ? fx.target.trim() : '';
        for (const a of Object.values(world.agents)) {
            if (a.isPlayer || a.isDead || a.agentId === npc.agentId) continue;
            if (a.name === targetName || thought.includes(a.name)) targets.push(a.name);
        }
        npc.memory.add(world.tickCount, world.clock.timeStr, 'whisper', thought, 8, targets.slice(0, 2));
        // v5.41.0 耳語會即時改變他今天的安排——慫恿的效果看得到
        this.replanRestOfDay(npc, world, `${t('心裡突然冒出一個念頭：')}${thought}`).catch(() => {});
        // 機械後果:對被提及村民的好感/浪漫漂移
        const tgt = Object.values(world.agents).find(a => !a.isPlayer && !a.isDead && a.name === (targetName || targets[0]));
        if (tgt) {
            const rel = npc.relationships.getOrCreate(tgt.agentId, tgt.name);
            const affD = Math.max(-8, Math.min(8, Math.round(fx.affinity_change || 0)));
            const romD = Math.max(0, Math.min(8, Math.round(fx.romantic_change || 0)));
            rel.modifyAffinity(affD); rel.modifyRomantic(romD);
        }
        // v5.45.0 蝴蝶效應:記錄耳語+對第三者的態度快照(機械漂移後),隔天回響告訴你「後續」發酵了什麼
        world.recordPlayerAction?.('whisper', thought, npc, tgt || null);
        world.logMessage('whisper', `🤫 ${t('你在')}${npc.name}${t('耳邊低語...一個念頭在他心裡生根了。')}`, player?.name, npc.name);
        return { thought };
    }

    /**
     * Called every world tick. Occasionally has an NPC send a proactive message to the player.
     */
    async tickProactiveMessages(world) {
        const player = world.agents['player'];
        if (!player) return;
        const ticksSince = world.tickCount - this._lastNpcMsgTick;
        if (ticksSince < this._npcMsgCooldownTicks) return;
        // ~5% chance per tick after cooldown
        if (Math.random() > 0.05) return;

        const npcs = Object.values(world.agents).filter(a => !a.isPlayer && a.activity !== 'sleeping');
        if (!npcs.length) return;

        // Pick NPC — prefer higher affinity NPCs
        const weighted = npcs.map(npc => {
            const rel = npc.relationships.getOrCreate(player.agentId, player.name);
            return { npc, weight: Math.max(1, (rel.affinity || 0) + 10) };
        });
        const totalW = weighted.reduce((s, w) => s + w.weight, 0);
        let r = Math.random() * totalW;
        let picked = weighted[0].npc;
        for (const w of weighted) { r -= w.weight; if (r <= 0) { picked = w.npc; break; } }

        this._lastNpcMsgTick = world.tickCount;

        // Generate proactive message
        const npc = picked;
        const relNpc = npc.relationships.getOrCreate(player.agentId, player.name);
        const relPlayer = player.relationships.getOrCreate(npc.agentId, npc.name);

        let npcText = '';
        if (this.llm && this.llm._canMakeRequest(false)) {
            try {
                const pN = this._buildCharacterProfile(npc);
                const recentChat = player.chatHistory.filter(c => c.target === npc.name || c.speaker === npc.name)
                    .slice(-5).map(c => `${c.speaker}: ${c.text}`).join('\n');
                // v5.29.0 記憶流:主動傳訊也帶著對玩家的記憶
                const memNpc = npc.memory.retrieve(player.name, [player.name], 3, world.tickCount);

                const scenarios = [
                    t('你想跟旅人分享今天工作的趣事'),
                    t('你想約旅人一起去做某件事'),
                    t('你突然想到一個問題想問旅人'),
                    t('你發現了一件有趣的事想告訴旅人'),
                    t('你想關心旅人最近過得如何'),
                    t('你想跟旅人聊聊最近鎮上的八卦'),
                ];
                // v5.0.0 祭典期間:NPC 更想邀玩家一起逛祭典
                const pFest = world.festivals?.activeFestival;
                if (pFest) {
                    scenarios.push(
                        `${t('今天是')}${pFest.name}${t('!你想邀旅人一起去')}${pickRandom(pFest.activities)}`,
                        t('你在祭典會場看到超有趣的東西,想趕快告訴旅人'),
                        `${t('你想約旅人在祭典結束前一起去')}${pickRandom(pFest.activities)}`,
                    );
                }
                const scenario = pickRandom(scenarios);

                const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的居民。你想主動傳一則訊息給')}${player.name}${t('。')}
${t('情境：')}${scenario}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}
${t('你現在在')}${npc.currentLocation.replace(/_/g,' ')}${t('，正在')}${npc.activity}${t('。')}
${this._buildRelContext(relNpc, player.name)}
${memNpc.length ? `${t('你記得：')}${memNpc.map(m=>m.content).join(t('；'))}` : ''}

${recentChat ? `${t('【最近對話】')}\n${recentChat}` : ''}

${t('【規則】')}
${LLM_LANG.rule(t('- 繁體中文（台灣用語），1-2句就好，像傳LINE訊息那樣自然'), '- Natural English, 1-2 sentences, casual like a text message')}
${t('- 不要加任何前綴、名字標籤、引號')}
${t('- 直接寫訊息內容就好')}`;

                const response = await this.llm.generate(prompt, 150, 0.9, false);
                if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                    npcText = response.trim().replace(/^["「『]|["」』]$/g, '').trim();
                    // Strip any name prefix
                    npcText = npcText.replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                }
            } catch(e) { console.error('[RimTown] Proactive NPC message LLM failed:', e); }
        }

        // Fallback if no LLM or LLM failed
        if (!npcText) {
            const fallbacks = [
                `${t('欸')}${player.name}${t('，今天有空嗎？')}`,
                `${t('嘿！你最近在忙什麼啊？')}`,
                `${t('你有聽說嗎？今天鎮上發生了一件事...')}`,
                `${t('唉，工作好累，想找人聊聊')}`,
                `${t('欸欸，等一下要不要一起去逛逛？')}`,
                `${player.name}${t('！好久沒聊了，最近好嗎？')}`,
                `${t('我剛剛看到一個超好笑的事想跟你說哈哈')}`,
            ];
            npcText = pickRandom(fallbacks);
        }

        // Record in chat history
        player.chatHistory.push({ speaker: npc.name, target: player.name, text: npcText, time: world.clock.timeStr });
        // Record in memory
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('主動傳訊息給')}${player.name}${t('：')}${npcText}`, 3, [player.name]);
        // Log
        world.logMessage('player_chat', `${npc.name} → ${player.name}: ${npcText}`, npc.name, player.name);
        // Notify UI
        if (this.onNpcMessage) this.onNpcMessage(npc.agentId);
    }

    // v5.4.0: 人生里程碑敘事 — NPC 達成夢想的某階段時,發鎮民動態 + 進頭條 + 記憶
    async narrateLifeMilestone(world, npc, def, goal, isDone) {
        try {
            const stageName = isDone ? def.stages[def.stages.length - 1] : def.stages[goal.stage];
            let text = '';
            if (this.llm && this.llm._canMakeRequest(false) &&
                world.tickCount - (world.townFeed?._lastLlmPostTick || -9999) > 150) {
                try {
                    const pN = this._buildCharacterProfile(npc);
                    const prompt = `${t('你在為小鎮社群「鎮民動態」寫一則貼文。')}
${t('發文者:')}${pN.name}${t('，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}
${t('他的人生夢想是「')}${def.name}${t('」,現在剛剛達成了一個階段:「')}${stageName}${t('」。')}${isDone ? t('這是他夢想的最終實現!') : ''}
${LLM_LANG.rule(t('【格式】只寫一句貼文,表達此刻的心情與這個里程碑,口語、真摯、可加表情符號。繁體中文,不要有其他文字。'), '[Format] Write one post only, expressing the mood of this moment and this milestone; casual, sincere, emoji allowed. Natural English, no other text.')}`;
                    const response = await this.llm.generate(prompt, 120, 0.9, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        text = response.trim().replace(/^["「『]|["」』]$/g, '').replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                        if (world.townFeed) world.townFeed._lastLlmPostTick = world.tickCount;
                    }
                } catch (e) { console.error('[RimTown] life milestone LLM failed:', e); }
            }
            if (!text) {
                text = isDone
                    ? pickRandom([`${def.icon} ${t('我做到了!「')}${def.name}${t('」——這一路走來,值得了。')}`, `${def.icon} ${t('夢想成真的這一刻,我會記得一輩子。')}${stageName}!`])
                    : pickRandom([`${def.icon} ${t('離夢想又近了一步:')}${stageName}。${t('繼續加油!')}`, `${t('今天達成了「')}${stageName}${t('」,朝著')}${def.name}${t('前進中 💪')}`]);
            }
            npc.addThought(isDone ? 'dream_achieved' : 'dream_progress', world); // v5.15.0 夢想推進的喜悅
            if (world.townFeed) world.townFeed.addPost(world, npc, text);
            npc.memory.add(world.tickCount, world.clock.timeStr, 'milestone', `${t('人生里程碑:')}${stageName}(${def.name})`, isDone ? 10 : 7, []);
            world.logMessage('milestone', `${def.icon} ${npc.name}${t('的夢想「')}${def.name}${t('」邁入:')}${stageName}${isDone ? t('(達成!)') : ''}`, npc.name);
            if (world.dailyNews) world.dailyNews.collectEvent('milestone', `${npc.name}${isDone ? t('實現了畢生夢想「') : t('朝夢想邁進:「')}${isDone ? def.name : stageName}${t('」')}`, isDone ? 8 : 5, [npc.name]);
            if (isDone) {
                Object.values(world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + 4; });
                world._pendingMilestones = world._pendingMilestones || [];
                world._pendingMilestones.push({ npcId: npc.agentId, npcName: npc.name, icon: def.icon, goalName: def.name, text });
            }
        } catch (e) { console.error('[RimTown] narrateLifeMilestone failed:', e); }
    }

    // v5.2.0: 鎮民動態發文 — AI 寫一則動態+朋友留言,或用模板
    async generateFeedPost(world, author, tryLlm) {
        try {
            if (!world.townFeed) return;
            let text = '', comments = [];
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead && a.agentId !== author.agentId);
            // 挑留言者:一個朋友 + (可能)一個對頭
            const relOf = (x) => author.relationships.relationships[x.agentId];
            const friends = npcs.filter(x => (relOf(x)?.affinity || 0) > 20);
            const rivals = npcs.filter(x => (relOf(x)?.affinity || 0) < -15);
            const commenters = [];
            if (friends.length) commenters.push(pickRandom(friends));
            if (rivals.length && Math.random() < 0.5) commenters.push(pickRandom(rivals));
            else if (npcs.length && commenters.length < 2 && Math.random() < 0.6) commenters.push(pickRandom(npcs));

            if (tryLlm && this.llm && this.llm._canMakeRequest(false) &&
                world.tickCount - (world.townFeed._lastLlmPostTick || -9999) > 200) {
                try {
                    const pN = this._buildCharacterProfile(author);
                    const names = commenters.map(c => c.name);
                    const prompt = `${t('你在為小鎮社群「鎮民動態」寫貼文(像臉書/IG動態)。')}
${t('發文者:')}${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}
${pN.thought ? `${t('最近在想：')}${pN.thought}` : ''}
${t('現在在')}${author.currentLocation.replace(/_/g, ' ')}${t('，正在')}${author.activity}${t('。')}

${t('【格式】第一行寫貼文內容(1-2句,口語、有梗、可加表情符號)。')}
${names.length ? `${t('接著每行寫一則留言,格式「名字: 留言」,留言者依序是:')}${names.join(t('、'))}` : ''}
${LLM_LANG.rule(t('繁體中文(台灣用語),不要有其他任何文字。'), 'Natural English, no other text at all.')}`;
                    const response = await this.llm.generate(prompt, 250, 0.95, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        const lines = response.trim().split('\n').map(s => s.trim()).filter(Boolean);
                        if (lines.length) {
                            text = lines[0].replace(/^["「『]|["」』]$/g, '').replace(new RegExp(`^${author.name}[：:]\\s*`), '').trim();
                            for (const l of lines.slice(1)) {
                                const idx = l.search(/[:：]/);
                                if (idx > 0 && idx <= 12) comments.push({ speaker: l.slice(0, idx).trim(), text: l.slice(idx + 1).trim() });
                            }
                            comments = comments.slice(0, 2);
                            world.townFeed._lastLlmPostTick = world.tickCount;
                        }
                    }
                } catch (e) { console.error('[RimTown] feed post LLM failed:', e); }
            }
            if (!text) {
                const mood = author.mood ?? 0;
                const partner = author.relationships.getPartner();
                const pool = [
                    `${t('今天的')}${author.currentLocation.includes('farm') ? t('田') : t('工作')}${t('也太累了吧...誰要請我喝一杯 🍺')}`,
                    `${t('剛剛在路上看到超好笑的事,笑到肚子痛 😂')}`,
                    t('天氣真好,適合偷懶(才怪,還有一堆活要幹)'),
                    t('突然好想吃烤魚。就這樣。'),
                    mood > 30 ? t('最近的日子真不錯,感恩 🙏') : t('唉,不想說話。懂的都懂。'),
                ];
                if (partner) pool.push(`${t('有個人在等我回家吃飯,幸福大概就是這樣 ❤️')}`);
                if (author.personality.traits.includes('gossip')) pool.push(t('我知道一個大八卦,但我就不說 🤐 問就是不說'));
                if (author.personality.traits.includes('lazy')) pool.push(t('今日進度:0。明天的我加油 💪'));
                text = pickRandom(pool);
                comments = commenters.slice(0, 2).map(c => {
                    const aff = relOf(c)?.affinity || 0;
                    const linesPool = aff < -15
                        ? [t('呵。'), t('有些人真的很閒。'), t('然後呢?')]
                        : [t('哈哈哈笑死'), t('+1!'), t('晚上老地方見?'), t('你還好嗎?抱抱'), t('這就是你摸魚的藉口?😏')];
                    return { speaker: c.name, text: pickRandom(linesPool) };
                });
            }
            world.townFeed.addPost(world, author, text, { comments });
        } catch (e) { console.error('[RimTown] generateFeedPost failed:', e); }
    }

    // v5.1.0: 名場面 — 為 NPC 感情大事件生成 4-6 句對話劇(LLM 或罐頭劇本)
    async generateDramaScene(world, kind, meta, a, b, thirdName) {
        try {
            let lines = [];
            if (this.llm && this.llm._canMakeRequest(false)) {
                try {
                    const pA = this._buildCharacterProfile(a);
                    const pB = this._buildCharacterProfile(b);
                    const sceneDesc = {
                        confession: `${a.name}${t('鼓起勇氣向')}${b.name}${t('告白,對方答應了,兩人正式在一起')}`,
                        wedding: `${a.name}${t('和')}${b.name}${t('的婚禮現場,兩人交換誓言,賓客起鬨')}`,
                        busted: `${a.name}${t('當場發現')}${b.name}${t('和')}${thirdName || t('某人')}${t('的秘密關係,情緒爆發對質')}`,
                        breakup: `${a.name}${t('和')}${b.name}${t('走到感情盡頭,決定分手')}`,
                        divorce: `${a.name}${t('和')}${b.name}${t('的婚姻破裂,攤牌離婚')}`,
                        feud: `${a.name}${t('和')}${b.name}${t('這對積怨已久的死對頭在大庭廣眾下狹路相逢,當場吵了起來,句句帶刺誰也不讓誰,圍觀的鎮民議論紛紛')}`,
                        severance: `${a.name}${t('和')}${b.name}${t('的積怨徹底爆發,當眾撂下重話,正式絕交')}`,
                        reconcile: `${t('在')}${thirdName || t('旅人')}${t('的奔走調解下,')}${a.name}${t('和')}${b.name}${t('終於放下多年心結,當眾握手言和,圍觀的鎮民鼓掌')}`,
                    }[kind];
                    const prompt = `${t('你是一位才華橫溢的小說家，正在為奇幻小鎮「邊境鎮」寫一場關鍵感情戲。')}
${t('場面：')}${sceneDesc}${t('。')}

${t('【')}${pA.name}${t('】')}${pA.age}${t('歲')}${pA.job}${t('，性格')}${pA.traits}
${t('【')}${pB.name}${t('】')}${pB.age}${t('歲')}${pB.job}${t('，性格')}${pB.traits}

${t('【規則】')}
${LLM_LANG.rule(t('- 必須使用繁體中文（台灣用語），不可使用簡體中文'), '- Write only in natural English; do not use Chinese')}
${t('- 寫4-6句有張力、有情緒的對話,像戲劇高潮的名場面')}
${t('- 每個人的說話風格要符合性格')}
${t('- 格式：每行「名字: 對話內容」,不要有其他任何東西')}`;
                    // v5.39.0 劇情名場面走 chat lane(Groq 免費優先)
                    const response = await this.llm.generate(prompt, 500, 0.95, true);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        for (const raw of response.trim().split('\n')) {
                            const s = raw.trim();
                            if (!s || !s.includes(':') && !s.includes('：')) continue;
                            const idx = s.search(/[:：]/);
                            const speaker = s.slice(0, idx).replace(/\*/g, '').trim();
                            const text = s.slice(idx + 1).trim();
                            if (speaker && text && speaker.length <= 12) lines.push({ speaker, text });
                        }
                        lines = lines.slice(0, 6);
                    }
                } catch (e) { console.error('[RimTown] drama scene LLM failed:', e); }
            }
            if (lines.length < 2) {
                const FB = {
                    confession: [
                        { speaker: a.name, text: t('那個...我練習了好多次,還是好緊張。我喜歡你,很久了。') },
                        { speaker: b.name, text: t('笨蛋...我等這句話等好久了。') },
                        { speaker: a.name, text: t('所以...你願意跟我在一起嗎?') },
                        { speaker: b.name, text: t('願意啦!要說幾次你才聽得懂!') },
                    ],
                    wedding: [
                        { speaker: a.name, text: t('從今以後,不管豐收還是荒年,我都會在你身邊。') },
                        { speaker: b.name, text: t('說好了喔,一輩子。') },
                        { speaker: t('賓客'), text: t('親一個!親一個!') },
                    ],
                    busted: [
                        { speaker: a.name, text: `${t('你們兩個...在這裡做什麼?')}` },
                        { speaker: b.name, text: t('等等,你聽我解釋,不是你想的那樣——') },
                        { speaker: a.name, text: `${t('我都看到了!')}${thirdName || t('某人')}${t(',虧我還把你當朋友!')}` },
                        { speaker: b.name, text: t('對不起...是我對不起你。') },
                    ],
                    breakup: [
                        { speaker: a.name, text: t('我們...好像回不去了,對吧。') },
                        { speaker: b.name, text: t('嗯。與其這樣互相消磨,不如就到這裡吧。') },
                        { speaker: a.name, text: t('謝謝你陪我走過這一段。祝你幸福。') },
                    ],
                    divorce: [
                        { speaker: a.name, text: t('這些年,我們都累了。簽了吧。') },
                        { speaker: b.name, text: t('...好。至少我們曾經真心愛過。') },
                        { speaker: a.name, text: t('保重。') },
                    ],
                    feud: [
                        { speaker: a.name, text: t('喲,這不是最會做表面功夫的那位嗎?') },
                        { speaker: b.name, text: t('總比某些人背後嚼舌根來得光明磊落。') },
                        { speaker: a.name, text: t('你再說一次試試看?大家都在,正好評評理!') },
                        { speaker: b.name, text: t('評就評!我還怕你不成?') },
                    ],
                    severance: [
                        { speaker: a.name, text: t('夠了。這些年我忍你很久了。') },
                        { speaker: b.name, text: t('忍?說得好像只有你在忍一樣。') },
                        { speaker: a.name, text: t('那正好。從今天起,你走你的路,我過我的橋。') },
                        { speaker: b.name, text: t('求之不得。絕交!') },
                    ],
                    reconcile: [
                        { speaker: a.name, text: `${t('那個...聽說你前陣子過得不容易。')}` },
                        { speaker: b.name, text: t('彼此彼此。其實...當年那件事,我也有不對。') },
                        { speaker: a.name, text: t('都過去了。有人苦口婆心勸了我好幾回,我才想通——為那點事賭一輩子的氣,不值得。') },
                        { speaker: b.name, text: t('嗯。回頭請那位和事佬喝一杯吧,算我們倆的。') },
                    ],
                }[kind] || [];
                lines = FB;
            }
            if (!lines.length) return;
            const scene = { kind, icon: meta.icon, title: meta.title, aName: a.name, bName: b.name, lines };
            world._pendingDramaScenes = world._pendingDramaScenes || [];
            world._pendingDramaScenes.push(scene);
            // v5.21.0 小鎮劇場:名場面存進可回顧的檔案,加上時間戳
            world.dramaArchive = world.dramaArchive || [];
            world.dramaArchive.push({ ...scene, year: world.clock.year, season: world.clock.season, day: world.clock.day, tick: world.tickCount });
            if (world.dramaArchive.length > 40) world.dramaArchive = world.dramaArchive.slice(-40);
            // v5.41.0 劇情名場面(告白/婚禮/抓姦/分手/離婚)後,當事人即時改寫今天剩餘行程
            try {
                this.replanRestOfDay(a, world, `${meta.title}${t('——這件事把今天整個打亂了')}`).catch(() => {});
                this.replanRestOfDay(b, world, `${meta.title}${t('——這件事把今天整個打亂了')}`).catch(() => {});
            } catch (e) {}
            // v5.2.0 大事件後當事人發鎮民動態
            if (world.townFeed) {
                const feedPools = {
                    confession: { who: b, texts: [t('今天是個好日子 💕'), t('原來被喜歡的人喜歡,是這種感覺。')] },
                    wedding: { who: a, texts: [t('我!結!婚!啦!🎉 感謝大家的祝福!'), t('執子之手,與子偕老。❤️')] },
                    busted: { who: a, texts: [t('識人不清,是我活該。'), t('有些人,不點名。祝你們幸福,呵。')] },
                    breakup: { who: a, texts: [t('恢復單身。別問,問就是不合適。'), t('刪掉了很多東西。包括回憶。')] },
                    divorce: { who: b, texts: [t('一段路走完了。往前看。'), t('簽完字,天還是藍的。挺好。')] },
                    feud: { who: a, texts: [t('有些人真的很會踩人底線。不點名。'), t('今天話說重了?不,我只後悔沒早點說。')] },
                    severance: { who: a, texts: [t('道不同不相為謀。就到這裡吧。'), t('刪掉了一個人。心裡反而輕鬆了。')] },
                    reconcile: { who: b, texts: [t('冰釋前嫌的感覺,真好。🕊️'), t('謝謝那位替我們兩個奔走的人。改天請你喝一杯!')] },
                };
                const fp = feedPools[kind];
                if (fp) world.townFeed.addPost(world, fp.who, pickRandom(fp.texts));
            }
        } catch (e) { console.error('[RimTown] generateDramaScene failed:', e); }
    }

    // v5.0.0: 心動事件 — NPC 用 AI 生成專屬真心話,並排入互動卡等玩家回應
    async fireHeartEvent(world, npc, ev) {
        try {
            const player = Object.values(world.agents).find(a => a.isPlayer);
            if (!player) return;
            const rel = npc.relationships.getOrCreate(player.agentId, player.name);
            let text = '';
            // v5.47.0 BUG-03:心動事件是關鍵玩家導向內容,改走玩家聊天限流(較寬鬆+Groq 分流),不再被背景額度擠掉
            if (this.llm && this.llm._canMakeRequest(true)) {
                try {
                    const pN = this._buildCharacterProfile(npc);
                    const mems = (rel.sharedMemories || []).slice(-3).join(t('；'));
                    const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的居民。這是一個重要的感情時刻。')}
${t('情境：')}${ev.scenario}${t('。對象是')}${player.name}${t('。')}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。背景：')}${pN.background}${t('。')}
${mems ? `${t('你們的共同回憶：')}${mems}` : ''}

${t('【規則】')}
${LLM_LANG.rule(t('- 繁體中文（台灣用語），2-4句，要真摯、有溫度，符合你的性格'), '- Natural English, 2-4 sentences, sincere and warm, true to your personality')}
${t('- 可以提到具體的共同回憶或小鎮生活細節')}
${t('- 不要加任何前綴、名字標籤、引號')}`;
                    // v5.39.0 心動事件走 chat lane(Groq 免費優先)
                    const response = await this.llm.generate(prompt, 250, 0.9, true);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        text = response.trim().replace(/^["「『]|["」』]$/g, '').trim();
                        text = text.replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                    }
                } catch (e) { console.error('[RimTown] heart event LLM failed:', e); }
            }
            if (!text) {
                // v5.47.0 BUG-03:備援真心話擴充+依性格/職業輕量填充,跨村民不再一字不差
                const jobName = npc.job?.title || t('日子');
                const traits = npc.personality?.traits || [];
                const fb = ev.romance ? [
                    t('那個...我最近發現,只要看到你走過來,我就會不自覺地笑。你...應該懂我的意思吧?'),
                    t('跟你說話的時候,時間總是過得特別快。我想...我大概是喜歡上你了。'),
                    `${t('昨晚忙完')}${jobName}${t('的事,躺下來滿腦子都是你。這樣下去不行,我得說出來——我喜歡你。')}`,
                    t('鎮上的人都說我最近怪怪的。也對,遇見你之後,我就不太像原本的自己了。'),
                    t('我練習了好多次要怎麼開口...結果一看到你全忘了。總之,我心裡有你,很久了。'),
                    t('如果哪天你要離開這個鎮,能不能...帶上我?'),
                ] : [
                    `${t('欸,認真說,自從你來了之後,我覺得這個鎮都不一樣了。有你這個朋友真好。')}`,
                    `${t('我不太會說這種話,但...謝謝你一直願意聽我說話。這對我來說很重要。')}`,
                    `${t('做')}${jobName}${t('這行,平常沒什麼人真的關心我。你不一樣。這句話我想當面說。')}`,
                    t('昨天想了想,要是你當初沒來這個鎮,我大概還是一個人悶著。謝了,真的。'),
                    t('別笑我肉麻——在這鎮上,我最信得過的人就是你。'),
                    t('我這人朋友不多,但質都很高。比如說,你。'),
                ];
                // 性格輕量加味:害羞的人吞吞吐吐,毒舌的人嘴硬
                text = pickRandom(fb);
                if (traits.includes('shy')) text = `${t('那個...')}${text}`;
                else if (traits.includes('abrasive')) text = `${text}${t('...講完了,不准笑。')}`;
            }
            player.chatHistory.push({ speaker: npc.name, target: player.name, text, time: world.clock.timeStr });
            npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('我對')}${player.name}${t('說出了真心話：')}${text}`, 9, [player.name]);
            rel.addSharedMemory(`${ev.name}${t('：')}${text}`);
            world.logMessage('player_chat', `${ev.icon} ${npc.name} → ${player.name}: ${text}`, npc.name, player.name);
            if (this.onNpcMessage) this.onNpcMessage(npc.agentId);
            world._pendingHeartEvents = world._pendingHeartEvents || [];
            world._pendingHeartEvents.push({ npcId: npc.agentId, npcName: npc.name, icon: ev.icon, evName: ev.name, text, romance: !!ev.romance });
        } catch (e) { console.error('[RimTown] fireHeartEvent failed:', e); }
    }

    // v4.9.0: 建築完工/組合發現時,挑一位相關 NPC 用 AI 對玩家發表評論
    async sendEventComment(world, eventText, preferJobs = [], preferIds = [], fallbackLines = null) {
        try {
            const player = Object.values(world.agents).find(a => a.isPlayer);
            if (!player) return;
            const npcs = Object.values(world.agents).filter(a => !a.isPlayer && !a.isDead);
            if (!npcs.length) return;
            let pool = preferIds.length ? npcs.filter(a => preferIds.includes(a.agentId)) : [];
            if (!pool.length && preferJobs.length) pool = npcs.filter(a => preferJobs.includes(a.job?.key));
            if (!pool.length) pool = npcs;
            const npc = pool[Math.floor(Math.random() * pool.length)];
            let text = '';
            if (this.llm && this.llm._canMakeRequest(false)) {
                try {
                    const pN = this._buildCharacterProfile(npc);
                    const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的居民。剛剛發生了一件事：')}${eventText}${t('。你想傳一則訊息給')}${playerTitle(world)}${player.name}${t('聊聊這件事。')}${playerTitle(world) === t('旅人') ? t('（他是旅人，不是鎮長，別叫他鎮長。）') : ''}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。性格：')}${pN.traits}${t('。')}

${t('【規則】')}
${LLM_LANG.rule(t('- 繁體中文（台灣用語），1-2句就好，像傳LINE訊息那樣自然'), '- Natural English, 1-2 sentences, casual like a text message')}
${t('- 從你的職業和性格出發評論這件事（開心、期待、或吐槽都行）')}
${t('- 不要加任何前綴、名字標籤、引號')}`;
                    const response = await this.llm.generate(prompt, 150, 0.9, false);
                    if (response && response !== '__ERROR__' && response !== '__RATE_LIMITED__') {
                        text = response.trim().replace(/^["「『]|["」』]$/g, '').trim();
                        text = text.replace(new RegExp(`^${npc.name}[：:]\\s*`), '').trim();
                    }
                } catch (e) { console.error('[RimTown] sendEventComment LLM failed:', e); }
            }
            if (!text) {
                const fallbacks = fallbackLines || [
                    `${eventText}${t('，太棒了吧！')}`,
                    `${t('你看到了嗎？')}${eventText}${t('！鎮上越來越有樣子了')}`,
                    `${eventText}${t('！')}${playerTitle(world)}${t('真有眼光')}`,
                ];
                text = pickRandom(fallbacks);
            }
            player.chatHistory.push({ speaker: npc.name, target: player.name, text, time: world.clock.timeStr });
            npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('跟')}${player.name}${t('聊到：')}${text}`, 3, [player.name]);
            world.logMessage('player_chat', `${npc.name} → ${player.name}: ${text}`, npc.name, player.name);
            if (this.onNpcMessage) this.onNpcMessage(npc.agentId);
        } catch (e) { console.error('[RimTown] sendEventComment failed:', e); }
    }

    _buildCharacterProfile(agent) {
        const traitLabels = agent.personality.traits.map(t => TRAIT_POOL[t]?.label || t);
        const partner = agent.relationships.getPartner();
        let statusStr = t('單身');
        if (partner) {
            if (partner.status === 'married') statusStr = `${t('已與')}${partner.targetName}${t('結婚')}`;
            else if (partner.status === 'dating') statusStr = `${t('正在與')}${partner.targetName}${t('交往')}`;
        }
        const needsStr = [];
        if (agent.needs.hunger < 30) needsStr.push(t('肚子很餓'));
        if (agent.needs.rest < 30) needsStr.push(t('很疲倦'));
        if (agent.needs.social < 30) needsStr.push(t('渴望社交'));
        if (agent.needs.recreation < 20) needsStr.push(t('需要娛樂'));
        return {
            name: agent.name, age: agent.age,
            job: agent.job?.title || t('無業'),
            traits: traitLabels.join(t('、')),
            background: agent.personality.background || t('普通居民'),
            values: agent.personality.values.join(t('、')),
            mood: agent.moodLabel,
            status: statusStr,
            needs: needsStr.join(t('、')) || t('狀態良好'),
            thought: agent.currentThought || '',
            bestSkill: agent.skills.bestSkill.category,
        };
    }

    _buildRelContext(rel, otherName) {
        let s = `${t('與')}${otherName}${t('的關係：')}${rel.type}${t('（好感度')}${rel.affinity}`;
        if (rel.romanticInterest > 0) s += `${t('，浪漫')}${rel.romanticInterest}`;
        s += `${t('，互動')}${rel.interactionCount}${t('次）')}`;
        if (rel.status) s += `${t('【')}${rel.statusLabel}${t('】')}`;
        if (rel.isCheating) s += t('【秘密關係】');
        if (rel.sharedMemories.length) s += `\n${t('共同回憶：')}${rel.sharedMemories.slice(-3).join(t('；'))}`;
        return s;
    }

    _buildEconomicContext(world) {
        const parts = [];
        // Prosperity
        if (world.prosperity) {
            parts.push(`${t('繁榮度：')}${world.prosperity.prosperity}${t('（')}${world.prosperity.level}${t('）')}`);
        }
        // Town level & industries
        if (world.industry) {
            parts.push(`${t('城鎮等級：')}${world.industry.townLevelName || t('荒村')}`);
            const indNames = Object.keys(world.industry.industries).map(k => {
                const def = typeof INDUSTRIES !== 'undefined' ? INDUSTRIES[k] : null;
                const ind = world.industry.industries[k];
                return def ? `${def.icon}${def.name}Lv${ind.level}` : k;
            });
            if (indNames.length) parts.push(`${t('產業：')}${indNames.join(t('、'))}`);
        }
        // Farm highlights
        if (world.farm && world.farm.plots.length > 0) {
            const growing = world.farm.plots.filter(p => p.state === 'growing').length;
            const ready = world.farm.plots.filter(p => p.state === 'ready').length;
            if (growing || ready) parts.push(`${t('農場：')}${growing}${t('塊生長中')}${ready ? t('、')+ready+t('塊可收穫') : ''}`);
            const lastHarvest = world.farm.harvestLog.slice(-1)[0];
            if (lastHarvest) parts.push(`${t('最近收穫：')}${lastHarvest.cropName}×${lastHarvest.amount}`);
        }
        // Factory highlights
        if (world.processing) {
            const active = Object.entries(world.processing.builtFactories)
                .filter(([, f]) => f.status === 'active')
                .map(([k]) => { const d = typeof FACTORIES !== 'undefined' ? FACTORIES[k] : null; return d ? `${d.icon}${d.name}` : k; });
            if (active.length) parts.push(`${t('工廠：')}${active.join(t('、'))}`);
        }
        return parts.length ? parts.join(t('。')) : '';
    }

    _buildQuestContext(world, npc, relToPlayer) {
        if (!world.questSystem) return '';
        const parts = [];
        // Active quest context
        const questCtx = world.questSystem.getActiveQuestContext();
        if (questCtx) parts.push(questCtx);
        // Crisis context
        const crisisCtx = world.questSystem.getCrisisContext();
        if (crisisCtx) parts.push(`${t('【危機】')}${crisisCtx}`);
        // NPC-specific quest hints (only if affinity is high enough)
        const affinity = relToPlayer?.affinity || 0;
        const hints = world.questSystem.getQuestHintsForNPC(npc.agentId, affinity);
        if (hints.length > 0) {
            const hintText = hints.map(h => `${t('關於「')}${h.questTitle}${t('」，你可以自然地提到：')}${h.hint}`).join('\n');
            parts.push(`${t('【你可以給的提示（只在話題相關時自然帶出，不要硬塞）】')}\n${hintText}`);
        }
        // NPC personal quest hints (個人故事線)
        if (world.npcQuests) {
            const personalHints = world.npcQuests.getPersonalQuestHints(npc.agentId, affinity);
            if (personalHints.length > 0) {
                const personalText = personalHints.map(h => {
                    if (h.type === 'active') return `${t('你的心願：')}${h.hint}`;
                    if (h.type === 'tease') return `${t('（如果話題相關）')}${h.hint}`;
                    return `${t('你聽說：')}${h.hint}`;
                }).join('\n');
                parts.push(`${t('【個人心願】')}\n${personalText}`);
            }
        }
        if (parts.length === 0) return '';
        return '\n' + t('【任務相關】') + '\n' + parts.join('\n') + '\n';
    }

    async generateConversation(agentA, agentB, world) {
        const relA = agentA.relationships.getOrCreate(agentB.agentId, agentB.name);
        const relB = agentB.relationships.getOrCreate(agentA.agentId, agentA.name);

        if (this.llm) {
            // Throttle NPC LLM calls to avoid burning through API quota
            const ticksSinceLast = world.tickCount - this._lastNpcLlmTick;
            // v5.29.0 混合模式:只有玩家附近的對話用 LLM,且受每日額度限制;其餘走規則式(照樣寫入記憶流)
            if (ticksSinceLast >= this._npcLlmCooldownTicks && this._npcLlmAllowed(world, agentA, agentB) && this.llm._canMakeRequest(false)) {
                try {
                    this._lastNpcLlmTick = world.tickCount;
                    this._countNpcLlmUse(world);
                    return await this._llmConversation(agentA, agentB, world, relA, relB);
                } catch(e) { console.error('LLM conversation failed:', e); }
            }
        }
        return this._fallbackConversation(agentA, agentB, world, relA, relB);
    }

    async _llmConversation(agentA, agentB, world, relA, relB) {
        const gossip = world.events.getGossipTopics ? world.events.getGossipTopics() : [];
        const gossipStr = gossip.slice(-3).join(t('、')) || t('沒有特別的事');
        // v5.29.0 記憶流檢索:以對方+近況為焦點,撈出「該記得的事」(不只限於跟對方直接相關)
        const focalA = `${agentB.name} ${agentB.activity} ${agentB.currentLocation} ${gossipStr}`;
        const focalB = `${agentA.name} ${agentA.activity} ${agentA.currentLocation} ${gossipStr}`;
        const memA = agentA.memory.retrieve(focalA, [agentB.name], 4, world.tickCount);
        const memB = agentB.memory.retrieve(focalB, [agentA.name], 4, world.tickCount);
        const thoughtsA = agentA.memory.getThoughts(2);
        const thoughtsB = agentB.memory.getThoughts(2);
        const pA = this._buildCharacterProfile(agentA);
        const pB = this._buildCharacterProfile(agentB);

        // Pick a random conversation scenario to add variety
        const scenarios = [
            t('兩人剛好在路上遇到，隨意閒聊起來'),
            t('一個人正在忙，另一個人過來搭話'),
            t('兩人一起吃東西或喝茶時的聊天'),
            t('一個人看到另一個人心情不好，主動關心'),
            t('分享一個有趣的發現或八卦'),
            t('討論最近發生的事情或計劃'),
            t('回憶過去的某件事'),
            t('為了一件小事開玩笑或互相吐槽'),
        ];
        let scenario = pickRandom(scenarios);
        // v5.0.0 祭典期間:一半機率改用祭典場景,並注入祭典氣氛
        const fest = world.festivals?.activeFestival;
        if (fest && Math.random() < 0.5) {
            scenario = pickRandom([
                `${t('兩人在')}${fest.name}${t('會場遇到,聊起眼前的')}${pickRandom(fest.activities)}`,
                `${t('兩人一起參加')}${pickRandom(fest.activities)}${t(',邊玩邊聊')}`,
                `${t('祭典的熱鬧中,一人拉著另一人去看')}${pickRandom(fest.activities)}`,
            ]);
        }
        const festCtx = fest ? `${t('【今天是')}${fest.name}${t('!】')}${fest.description}${t('鎮上到處都是祭典活動:')}${fest.activities.join(t('、'))}${t('。對話請自然融入祭典氣氛。')}\n` : '';

        const prompt = `${t('你是一位才華橫溢的小說家，正在為奇幻小鎮「邊境鎮」寫角色對話劇本。')}
${t('這是兩位小鎮居民偶然碰面的場景。請寫出生動、自然、有溫度的對話——就像真實的鄰居閒聊一樣。')}

${t('【重要規則】')}
${LLM_LANG.rule(t('- 必須使用繁體中文（台灣用語），不可使用簡體中文'), '- Write only in natural English; do not use Chinese')}
${t('- 絕對不要讓角色報告自己的狀態（不要說「我好餓」「我好累」「我心情不好」這種話）')}
${t('- 對話要像真人——談論具體的事、講故事、開玩笑、分享感受、抱怨、八卦')}
${t('- 每個人的說話風格要明顯不同（用詞、語氣、句子長短都要有差異）')}
${t('- 加入生活細節：提到具體的食物、地點、天氣感受、小鎮裡的人和事')}
${t('- 可以有幽默、諷刺、調侃、撒嬌、關心、爭吵等豐富的情感表達')}

${festCtx}${t('場景：')}${scenario}
${t('時間：')}${world.clock.timeStr}
${t('地點：')}${agentA.currentLocation.replace(/_/g,' ')}

${t('【')}${pA.name}${t('】')}${pA.age}${t('歲')}${pA.job}${t('，性格')}${pA.traits}${t('，')}${pA.status}
${pA.thought ? `${t('最近在想：')}${pA.thought}` : ''}${pA.needs !== t('狀態良好') ? `${t('（有點')}${pA.needs}${t('）')}` : ''}
${this._buildRelContext(relA, agentB.name)}
${memA.length ? `${t('記得：')}${memA.map(m=>`[${m.timeStr}] ${m.content}`).join(t('；'))}` : ''}
${thoughtsA.length ? `${t('心裡的體悟：')}${thoughtsA.map(m=>m.content).join(t('；'))}` : ''}

${t('【')}${pB.name}${t('】')}${pB.age}${t('歲')}${pB.job}${t('，性格')}${pB.traits}${t('，')}${pB.status}
${pB.thought ? `${t('最近在想：')}${pB.thought}` : ''}${pB.needs !== t('狀態良好') ? `${t('（有點')}${pB.needs}${t('）')}` : ''}
${this._buildRelContext(relB, agentA.name)}
${memB.length ? `${t('記得：')}${memB.map(m=>`[${m.timeStr}] ${m.content}`).join(t('；'))}` : ''}
${thoughtsB.length ? `${t('心裡的體悟：')}${thoughtsB.map(m=>m.content).join(t('；'))}` : ''}
${t('如果「記得」的事跟話題有關，讓角色自然地提起或延續它——這是他們真實的共同過去。')}

${t('小鎮近況：')}${gossipStr}
${this._buildEconomicContext(world)}

${t('請寫3-4句自然對話。範例風格：')}
${t('- 好友："欸你昨天有看到老王在河邊釣到一條超大的魚嗎？笑死我了他差點掉下去！"')}
${t('- 害羞的人："嗯...那個...你今天做的麵包聞起來好香..."')}
${t('- 毒舌的人："又在偷懶？你那個田再不管，雜草都要比你高了。"')}
${t('- 情侶："你怎麼又沒穿外套？天都涼了...過來，把這個披上。"')}

${t('格式：每行「名字: 對話內容」')}
${t('最後一行：')}EFFECTS: {"affinity_change_a": ${t('數字')}(-3${t('到')}5), "affinity_change_b": ${t('數字')}(-3${t('到')}5), "romantic_change_a": ${t('數字')}(0${t('到')}5), "romantic_change_b": ${t('數字')}(0${t('到')}5), "summary": "${t('用一句生動的話總結發生了什麼')}", "memory_a": "${pA.name}${t('會記住的一句話（以他的視角與感受）')}", "memory_b": "${pB.name}${t('會記住的一句話（以他的視角與感受）')}", "plan_a": "${t('若對話中有約定或待辦,寫')}${pA.name}${t('的一句「接下來要…」備忘,否則空字串')}", "plan_b": "${t('同上,')}${pB.name}${t('的備忘或空字串')}"}
${t('提示：romantic_change 代表心動程度的變化。只有明確的曖昧、調情、深層情感連結才給 1-2。普通友好聊天應該給 0。大部分對話 romantic_change 應該是 0。')}`;

        // v5.39.0 輸出上限 800→500:NPC 背景對話 3-4 句就夠,輸出 token 是成本大頭
        const response = await this.llm.generate(prompt, 500);
        return this._parseConversation(response, agentA, agentB, world, relA, relB);
    }

    _parseConversation(response, agentA, agentB, world, relA, relB) {
        const lines = response.trim().split('\n');
        const dialogue = []; let effects = {};
        for (const line of lines) {
            const trimmed = line.trim(); if (!trimmed) continue;
            if (trimmed.startsWith('EFFECTS:')) {
                try {
                    const rest = lines.slice(lines.indexOf(line)).join('\n');
                    const js = rest.indexOf('{'), je = rest.lastIndexOf('}')+1;
                    if (js>=0 && je>js) effects = JSON.parse(rest.slice(js,je));
                } catch(e) {}
                break;
            } else if (trimmed.includes(':')) {
                const [speaker, ...textParts] = trimmed.split(':');
                const text = textParts.join(':').trim();
                if (speaker && text) dialogue.push({speaker: speaker.replace(/\*/g,'').trim(), text});
            }
        }
        // Apply personality compatibility multiplier to affinity gains
        const compat = Personality.compatibility(agentA.personality.traits, agentB.personality.traits);
        let affA = effects.affinity_change_a ?? randInt(-2,5);
        let affB = effects.affinity_change_b ?? randInt(-2,5);
        if (affA > 0) affA = Math.round(affA * compat);
        if (affB > 0) affB = Math.round(affB * compat);
        // Default romantic growth: only grow on strongly positive conversations
        const romA = effects.romantic_change_a ?? (affA >= 3 ? randInt(0,1) : 0);
        const romB = effects.romantic_change_b ?? (affB >= 3 ? randInt(0,1) : 0);
        const summary = effects.summary || `${agentA.name}${t('和')}${agentB.name}${t('聊了天。')}`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        // v5.29.0 主觀記憶回寫:LLM 為兩人各寫一句「他會記住的話」,沒有就退回客觀摘要
        const memTextA = (typeof effects.memory_a === 'string' && effects.memory_a.trim()) ? effects.memory_a.trim() : `${t('與')}${agentB.name}${t('交談：')}${summary}`;
        const memTextB = (typeof effects.memory_b === 'string' && effects.memory_b.trim()) ? effects.memory_b.trim() : `${t('與')}${agentA.name}${t('交談：')}${summary}`;
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', memTextA, Math.min(8,4+Math.abs(affA)+romA), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', memTextB, Math.min(8,4+Math.abs(affB)+romB), [agentA.name]);
        // v5.37.0 計畫思考(移植 generative_agents 對話後的 planning thought):
        // 對話裡的約定/待辦寫成 'plan' 記憶,隔天生成行程時會被撈出來——「星期三見」真的會出現在星期三
        if (typeof effects.plan_a === 'string' && effects.plan_a.trim()) {
            agentA.memory.add(world.tickCount, world.clock.timeStr, 'plan', effects.plan_a.trim(), 6, [agentB.name]);
        }
        if (typeof effects.plan_b === 'string' && effects.plan_b.trim()) {
            agentB.memory.add(world.tickCount, world.clock.timeStr, 'plan', effects.plan_b.trim(), 6, [agentA.name]);
        }
        // v5.41.0 即時重規劃:對話裡有約定、或情緒波動夠大 → 當事人當場改寫今天剩餘行程
        try {
            const planA = (typeof effects.plan_a === 'string' && effects.plan_a.trim()) || '';
            const planB = (typeof effects.plan_b === 'string' && effects.plan_b.trim()) || '';
            if (planA || Math.abs(affA) >= 4 || romA >= 2) this.replanRestOfDay(agentA, world, planA || summary).catch(() => {});
            if (planB || Math.abs(affB) >= 4 || romB >= 2) this.replanRestOfDay(agentB, world, planB || summary).catch(() => {});
        } catch (e) {}
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        // Collect notable conversations for daily news
        if (world.dailyNews && (Math.abs(affA) >= 4 || Math.abs(affB) >= 4 || romA >= 2 || romB >= 2)) {
            world.dailyNews.collectEvent('social', summary, 4, [agentA.name, agentB.name]);
        }
        // Store NPC conversation for sidebar viewing
        if (dialogue.length) {
            this.npcConversationLog.push({ time:world.clock.timeStr, dayTag:`${world.clock.year}-${world.clock.season}-${world.clock.day}`, location:agentA.currentLocation, dialogue, summary, agentA:agentA.name, agentB:agentB.name, agentAId:agentA.agentId, agentBId:agentB.agentId, llm:true });
            if (this.npcConversationLog.length > 400) this.npcConversationLog = this.npcConversationLog.slice(-400); // v5.99.0 B12
            // Notify UI for map speech bubbles
            if (this.onConversation) {
                const textA = dialogue[0]?.text || summary;
                const textB = dialogue[1]?.text || '';
                this.onConversation(agentA.agentId, agentB.agentId, agentA.name, agentB.name, textA, textB);
            }
        }
        return { dialogue, summary, effects:{affinity_a:affA,affinity_b:affB,romantic_a:romA,romantic_b:romB} };
    }

    _fallbackConversation(agentA, agentB, world, relA, relB) {
        const dialogue = this._generatePersonalityDialogue(agentA, agentB, world, relA, relB);
        const compatFb = Personality.compatibility(agentA.personality.traits, agentB.personality.traits);
        let affA = dialogue._affA ?? randInt(-1,4);
        let affB = dialogue._affB ?? randInt(-1,4);
        if (affA > 0) affA = Math.round(affA * compatFb);
        if (affB > 0) affB = Math.round(affB * compatFb);
        const romA = dialogue._romA ?? 0;
        const romB = dialogue._romB ?? 0;
        const summary = dialogue._summary || `${agentA.name}${t('和')}${agentB.name}${t('聊了天。')}`;
        relA.modifyAffinity(affA); relA.modifyRomantic(romA); relA.recordInteraction(world.tickCount, summary);
        relB.modifyAffinity(affB); relB.modifyRomantic(romB); relB.recordInteraction(world.tickCount, summary);
        agentA.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${agentB.name}${t('交談：')}${summary}`, Math.min(6,3+Math.abs(affA)), [agentB.name]);
        agentB.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${agentA.name}${t('交談：')}${summary}`, Math.min(6,3+Math.abs(affB)), [agentA.name]);
        world.logMessage('conversation', summary, agentA.name, agentB.name);
        if (world.dailyNews && (Math.abs(affA) >= 4 || Math.abs(affB) >= 4)) {
            world.dailyNews.collectEvent('social', summary, 4, [agentA.name, agentB.name]);
        }
        const lines = dialogue.lines;
        if (lines.length) {
            this.npcConversationLog.push({ time:world.clock.timeStr, dayTag:`${world.clock.year}-${world.clock.season}-${world.clock.day}`, location:agentA.currentLocation, dialogue:lines, summary, agentA:agentA.name, agentB:agentB.name, agentAId:agentA.agentId, agentBId:agentB.agentId });
            if (this.npcConversationLog.length > 400) this.npcConversationLog = this.npcConversationLog.slice(-400); // v5.99.0 B12
            if (this.onConversation) {
                const textA = lines[0]?.text || summary;
                const textB = lines[1]?.text || '';
                this.onConversation(agentA.agentId, agentB.agentId, agentA.name, agentB.name, textA, textB);
            }
        }
        return { dialogue:lines, summary, effects:{affinity_a:affA,affinity_b:affB,romantic_a:romA,romantic_b:romB} };
    }

    _generatePersonalityDialogue(agentA, agentB, world, relA, relB) {
        const tA = agentA.personality.traits;
        const tB = agentB.personality.traits;
        const jobA = agentA.job?.title || t('無業');
        const jobB = agentB.job?.title || t('無業');
        const loc = agentA.currentLocation.replace(/_/g,' ');
        const timeOfDay = world.clock.timeOfDay;
        const season = world.clock.season;
        const lines = [];
        let affA = 0, affB = 0, romA = 0, romB = 0;
        let summary = '';

        // --- Rich detail pools for vivid dialogue ---
        const foods = { '春季':[t('野菜煎餅'),t('花瓣蜜茶'),t('春筍燉肉'),t('桂花糕'),t('薺菜餛飩')], '夏季':[t('冰鎮酸梅湯'),t('西瓜'),t('涼拌黃瓜'),t('綠豆湯'),t('荷葉飯')], '秋季':[t('烤地瓜'),t('桂花釀'),t('栗子燒雞'),t('蘋果派'),t('南瓜濃湯')], '冬季':[t('薑母茶'),t('熱騰騰的羊肉鍋'),t('烤紅薯'),t('熱奶酒'),t('麻辣火鍋')] };
        const scenery = { '春季':[t('櫻花飄落的小徑'),t('河邊盛開的野花'),t('清晨帶著露水的草地')], '夏季':[t('星空下的河流'),t('螢火蟲飛舞的夜晚'),t('午後蟬鳴的樹蔭下')], '秋季':[t('金黃落葉鋪滿的石板路'),t('楓紅染遍山頭的景色'),t('豐收後堆滿穀物的倉庫')], '冬季':[t('白雪覆蓋的屋頂'),t('壁爐旁搖曳的火光'),t('冬夜裡遠處傳來的狼嚎')] };
        const gifts = [t('一束剛採的野花'),t('自己做的手工餅乾'),t('一瓶私藏的好酒'),t('昨天釣到的魚做成的魚乾'),t('一條手織的圍巾'),t('用漂亮石頭做的小飾品')];
        const rumors = [`${t('聽說')}${pickRandom([t('雜貨店'),t('酒館'),t('鎮公所')])}${t('昨晚有人看到奇怪的光')}`,`${t('據說最近森林裡出現了')}${pickRandom([t('罕見的白鹿'),t('神秘的遺跡'),t('一群外來的旅人')])}`,`${t('有人說')}${pickRandom([t('河邊'),t('山洞'),t('舊礦坑')])}${t('藏著寶藏')}`,`${t('聽說隔壁的商隊帶來了')}${pickRandom([t('稀有香料'),t('遠方的書信'),t('神秘的藥草')])}`];
        const food = pickRandom(foods[season] || foods['春季']);
        const scene = pickRandom(scenery[season] || scenery['春季']);

        const isCouple = relA.status === 'dating' || relA.status === 'married';
        const isCrush = relA.romanticInterest > 50 || relB.romanticInterest > 50;
        const isRival = relA.affinity < -20 || relB.affinity < -20;
        const isCloseFriend = relA.affinity > 50 && relB.affinity > 50;
        const isStranger = relA.interactionCount < 3;

        const greetA = this._personalityGreeting(agentA, agentB, relA);
        const greetB = this._personalityGreeting(agentB, agentA, relB);

        if (isCouple) {
            const coupleTopics = [
                () => {
                    lines.push({speaker:agentA.name, text:`${t('你今天做的')}${food}${t('真的太好吃了，我到現在嘴裡還有那個味道！')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?`${t('真...真的嗎？其實我怕做得不夠好，特地多加了點')}${pickRandom([t('蜂蜜'),t('香料'),t('秘方')])}...`:`${t('那當然！這可是我花了一整個下午的心血，為了某個人。')}`});
                    lines.push({speaker:agentA.name, text:t('下次讓我也給你做一頓，雖然我的手藝可能會讓你後悔...')});
                    lines.push({speaker:agentB.name, text:tB.includes('romantic')?t('你做什麼我都喜歡，因為是你做的。'):t('哈哈，那我先準備好腸胃藥！')});
                    lines.push({speaker:agentA.name, text:t('你！過分！...不過我真的很幸福。')});
                    affA = randInt(3,6); affB = randInt(3,6); romA = randInt(2,4); romB = randInt(2,4);
                    summary = `${loc}${t('裡，')}${agentA.name}${t('讚美了')}${agentB.name}${t('親手做的')}${food}${t('，兩人甜蜜地打鬧著，笑聲讓路過的人都忍不住微笑。')}`;
                },
                () => {
                    const jealousA = tA.includes('jealous');
                    const jealousB = tB.includes('jealous');
                    if (jealousA || jealousB) {
                        const j = jealousA ? agentA : agentB;
                        const o = jealousA ? agentB : agentA;
                        lines.push({speaker:j.name, text:t('我剛剛看到你跟那個人聊了好久，你們在說什麼悄悄話？')});
                        lines.push({speaker:o.name, text:`${t('就是在討論')}${pickRandom([t('工作的事'),t('鎮上活動'),t('建材價格')])}${t('啊，你又胡思亂想了。')}`});
                        lines.push({speaker:j.name, text:t('...你笑得那麼開心，我在旁邊看著心裡很不是滋味。')});
                        lines.push({speaker:o.name, text:o.personality.traits.includes('kind')?t('傻瓜，我心裡只有你一個人啊。來，把手給我。'):t('你能不能信任我一點？每次都這樣我也很累的。')});
                        lines.push({speaker:j.name, text:t('...對不起。我就是太害怕失去你了。')});
                        affA = randInt(-1,2); affB = randInt(-1,2); romA = randInt(0,1); romB = randInt(0,1);
                        summary = `${j.name}${t('因為看到')}${o.name}${t('和別人說笑而醋意大發，兩人經歷了一場小風波，最終在')}${loc}${t('和好。')}`;
                    } else {
                        lines.push({speaker:agentA.name, text:`${t(season)}${t('的夜晚真美...你看那邊，')}${scene}${t('。要不要一起去走走？')}`});
                        lines.push({speaker:agentB.name, text:tB.includes('shy')?t('好...牽著我的手好嗎？'):t('走啊！我還想帶你去看一個秘密地點，保證你沒去過！')});
                        lines.push({speaker:agentA.name, text:t('和你在一起的時候，覺得這個小鎮是全世界最美的地方。')});
                        lines.push({speaker:agentB.name, text:t('笨蛋...突然說這種話，我都不知道該怎麼回了。')});
                        affA = randInt(3,5); affB = randInt(3,5); romA = randInt(2,4); romB = randInt(2,4);
                        summary = `${t(season)}${t('的')}${loc}${t('裡，')}${agentA.name}${t('和')}${agentB.name}${t('手牽手散步，分享著')}${scene}${t('的浪漫景色，氣氛溫馨而甜蜜。')}`;
                    }
                },
                () => {
                    const gift = pickRandom(gifts);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，閉上眼睛，我有東西要給你！')}`});
                    lines.push({speaker:agentB.name, text:t('又在搞什麼鬼？...好啦好啦，閉上了。')});
                    lines.push({speaker:agentA.name, text:`${t('好了，睜開！噹噹——')}${gift}${t('！看到的時候就想到你了。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('......謝謝。我會好好珍藏的。'):t('天啊！這也太可愛了吧！你怎麼知道我一直想要這個？！')});
                    affA = randInt(3,6); affB = randInt(4,7); romA = randInt(2,3); romB = randInt(2,4);
                    summary = `${agentA.name}${t('在')}${loc}${t('送了')}${agentB.name}${gift}${t('作為驚喜，')}${agentB.name}${tB.includes('stoic')?t('雖然表面平靜但眼眶微紅'):t('感動得差點飛撲上去')}${t('，兩人的感情更加深厚了。')}`;
                },
            ];
            pickRandom(coupleTopics)();
        } else if (isRival) {
            const hostileTemplates = [
                () => {
                    lines.push({speaker:agentA.name, text:`${t('哦？')}${agentB.name}${t('也在')}${loc}${t('啊，我還以為你早就被鎮上的人趕走了呢。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('abrasive')?t('你少在那邊冷嘲熱諷，有本事當面說清楚！'):t('......你講話可以再難聽一點，我都習慣了。')});
                    lines.push({speaker:agentA.name, text:`${t('別裝可憐了，你做過什麼你自己心裡清楚。上次')}${pickRandom([t('倉庫的事'),t('選舉那件事'),t('你在背後說的那些話')])}${t('，全鎮都知道。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('信不信由你。我問心無愧。'):t('你！——好，你記住今天說的話。遲早你會後悔的。')});
                    affA = randInt(-5,-2); affB = randInt(-5,-2);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('正面交鋒，針鋒相對的言語讓空氣彷彿凝結，周圍的居民紛紛側目。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${t('聽說你最近又在到處說我')}${pickRandom([t('壞話'),t('是非'),t('不是')])}${t('？有種當面說啊。')}`});
                    lines.push({speaker:agentB.name, text:`${t('我說的都是事實。你那個')}${jobA}${t('做成什麼樣子，大家有目共睹。')}`});
                    lines.push({speaker:agentA.name, text:tA.includes('neurotic')?t('你——！我在這個鎮上付出了多少你知道嗎！？'):t('笑話。等你做到我一半再來批評吧。')});
                    lines.push({speaker:agentB.name, text:tB.includes('charismatic')?t('好了，我不想在這種地方吵。但你最好反省一下自己。'):t('哼，走著瞧。')});
                    lines.push({speaker:agentA.name, text:t('你才該好好反省！')});
                    affA = randInt(-6,-3); affB = randInt(-6,-3);
                    summary = `${agentA.name}${t('當面質問')}${agentB.name}${t('散播流言蜚語的事，兩人在')}${loc}${t('爆發了激烈口角，怒氣沖天，場面一度失控。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，我們需要談談。不是為了吵架，是為了把話說開。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('......好吧。我也不想一直這樣下去。'):t('你覺得有什麼好談的？')});
                    lines.push({speaker:agentA.name, text:t('我知道我們之間有很多誤會，但至少在鎮上要做到基本的尊重，你說呢？')});
                    lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('......我會考慮的。'):t('尊重是互相的。你先做到再來要求我。')});
                    affA = randInt(-2,1); affB = randInt(-2,1);
                    summary = `${agentA.name}${t('在')}${loc}${t('試圖與')}${agentB.name}${t('和解，但雙方仍帶著心結，氣氛雖有緩和卻依然充滿張力。')}`;
                },
            ];
            pickRandom(hostileTemplates)();
        } else if (isCrush) {
            const crushA = relA.romanticInterest > 50;
            const crushB = relB.romanticInterest > 50;
            const crushTopics = [
                () => {
                    lines.push({speaker:agentA.name, text: crushA ? `${agentB.name}${t('！你、你頭上有片落葉——我幫你拿掉！')}` : greetA});
                    lines.push({speaker:agentB.name, text: crushB ? t('啊，謝...謝謝...（心跳好快）你的手好溫暖。') : t('哦，謝謝你啊。')});
                    lines.push({speaker:agentA.name, text: crushA ? `${t('抱歉！我是不是太靠近了...不，我只是...你今天')}${pickRandom([t('聞起來好香'),t('看起來好好看'),t('笑容好好看')])}${t('。')}` : `${t('不客氣！')}${t(season)}${t('嘛，到處都是落葉。')}`});
                    if (crushB) lines.push({speaker:agentB.name, text:tB.includes('shy')?t('你...你也是...（聲音越來越小）'):`${t('哈哈，被你這麼一說我都不好意思了！那改天一起去喝杯')}${food}${t('好嗎？')}`});
                    romA = crushA ? randInt(3,6) : randInt(0,2); romB = crushB ? randInt(3,6) : randInt(0,2);
                    affA = randInt(2,5); affB = randInt(2,5);
                    const who = (crushA && crushB) ? t('兩人') : (crushA ? agentA.name : agentB.name);
                    summary = `${agentA.name}${t('幫')}${agentB.name}${t('拿掉頭上的落葉時兩人靠得很近，')}${who}${t('的臉頰微微泛紅，')}${loc}${t('的空氣中瀰漫著微妙的心動氣息。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，你知道嗎？我昨晚看到了')}${scene}${t('，第一個想到的人就是你。')}`});
                    lines.push({speaker:agentB.name, text: crushB ? t('真的嗎...其實我也常常想著——啊不，我是說，那一定很美！') : t('哦？聽起來很美呢。')});
                    lines.push({speaker:agentA.name, text:t('下次一定要帶你去看。跟你在一起的時候，什麼風景都會更美。')});
                    lines.push({speaker:agentB.name, text: crushB ? t('...好。一定要說到做到哦。') : tB.includes('kind')?t('你真會說話！好啊，到時候再說。'):t('嗯...好啊。')});
                    romA = crushA ? randInt(2,5) : randInt(1,2); romB = crushB ? randInt(2,5) : randInt(1,2);
                    affA = randInt(2,5); affB = randInt(2,4);
                    summary = `${agentA.name}${t('在')}${loc}${t('和')}${agentB.name}${t('分享了')}${scene}${t('的美景，話語間暗藏著告白的勇氣，')}${agentB.name}${crushB?t('也悄悄地紅了耳朵'):t('禮貌地微笑回應')}${t('。')}`;
                },
            ];
            pickRandom(crushTopics)();
        } else if (isCloseFriend) {
            const friendTopics = [
                () => {
                    const rumor = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('！你一定不相信我剛聽到什麼——')}${rumor}${t('！')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('什麼！？快跟我說清楚！細節呢！？'):t('真的假的？你確定不是誰在胡說八道？')});
                    lines.push({speaker:agentA.name, text:`${t('千真萬確！好幾個人都這麼說。要不要找個時間一起去')}${pickRandom([t('看看'),t('調查'),t('確認')])}${t('？')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('嗯...小心為上，但如果是真的就太刺激了！'):`${t('走啊！怕什麼！帶上')}${food}${t('我們來場冒險！')}`});
                    affA = randInt(3,5); affB = randInt(3,5);
                    summary = `${agentA.name}${t('興沖沖地在')}${loc}${t('和摯友')}${agentB.name}${t('分享了一個驚天八卦，兩人越聊越起勁，甚至約好了一起去探個究竟，氣氛既神秘又興奮。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${t('唉...')}${agentB.name}${t('，你能不能幫我出出主意？最近')}${pickRandom([`${jobA}${t('的工作壓力大到快喘不過氣')}`,t('跟隔壁的鄰居鬧了點不愉快'),t('一直在做同一個奇怪的夢')])}...`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?`${t('怎麼了？慢慢說，我聽著呢。先喝口')}${food}${t('暖暖。')}`:`${t('又怎麼了？你最近也太多煩惱了吧——不過說吧，反正你也憋不住。')}`});
                    lines.push({speaker:agentA.name, text:t('你真的是全鎮最了解我的人...每次跟你聊完心裡就踏實多了。')});
                    lines.push({speaker:agentB.name, text:`${t('別肉麻了！不過...有你當朋友我也很慶幸啦。來，我請你吃')}${pickRandom([t('剛烤好的麵包'),t('酒館的招牌菜'),t('剛摘的水果')])}${t('。')}`});
                    affA = randInt(3,6); affB = randInt(3,5);
                    summary = `${agentA.name}${t('在')}${loc}${t('向摯友')}${agentB.name}${t('傾訴了最近的煩惱，')}${agentB.name}${t('耐心傾聽並貼心地準備了')}${food}${t('，兩人之間的友誼更加堅定了。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，還記得我們剛來邊境鎮那天嗎？什麼都沒有，就兩個人站在空蕩蕩的廣場上。')}`});
                    lines.push({speaker:agentB.name, text:t('記得啊！那時候你還摔了一跤，臉都栽進泥巴裡哈哈哈哈！')});
                    lines.push({speaker:agentA.name, text:t('你就記這個！？那你還不是迷路了三次才找到酒館！')});
                    lines.push({speaker:agentB.name, text:t('好了好了，我們扯平。不過認真的...能跟你一起在這裡打拼，我覺得這輩子值了。')});
                    lines.push({speaker:agentA.name, text:t('...你今天不準再說催淚的話了，我眼眶已經紅了。')});
                    affA = randInt(4,7); affB = randInt(4,7);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('回憶起初來邊境鎮的趣事，笑淚交織之間，深厚的友情讓旁人都為之動容。')}`;
                },
            ];
            pickRandom(friendTopics)();
        } else if (isStranger) {
            const strangerTopics = [
                () => {
                    lines.push({speaker:agentA.name, text:tA.includes('charismatic')?`${t('嘿！你是新面孔吧？我是')}${agentA.name}${t('，在這邊做')}${jobA}${t('的。歡迎來到邊境鎮！')}`:`${t('你好...我好像沒見過你？')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?`${t('嗯...我是')}${agentB.name}...${t('你好。這裡的')}${food}${t('看起來好好吃...')}`:`${t('哈囉！我叫')}${agentB.name}${t('！剛到這邊不久，請多指教！這裡比我想像中熱鬧多了。')}`});
                    lines.push({speaker:agentA.name, text:`${loc}${t('是鎮上最')}${pickRandom([t('熱鬧'),t('有意思'),t('舒服')])}${t('的地方！對了，如果你想吃好料的，推薦你去試試酒館的')}${food}${t('，絕對不會後悔。')}`});
                    lines.push({speaker:agentB.name, text:`${t('真的嗎！那我一定要去試試。謝謝你，')}${agentA.name}${t('！')}`});
                    affA = randInt(2,5); affB = randInt(2,5);
                    summary = `${agentA.name}${t('在')}${loc}${t('熱情地招呼了新來的')}${agentB.name}${t('，推薦了鎮上的美食')}${food}${t('，給')}${agentB.name}${t('留下了溫暖的第一印象。')}`;
                },
                () => {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('對吧？我聽說你是做')}${jobB}${t('的——正好，我一直想認識做這行的人！')}`});
                    lines.push({speaker:agentB.name, text:`${t('你認識我？啊，果然小鎮消息傳得快...對，我是')}${jobB}${t('。你是')}${agentA.name}${t('？')}`});
                    lines.push({speaker:agentA.name, text:`${t('哈哈，邊境鎮就是這樣，新人來的消息半天就全鎮都知道了。改天聊聊')}${pickRandom([t('工作心得'),t('鎮上的事'),t('生活經驗')])}${t('吧？')}`});
                    lines.push({speaker:agentB.name, text:t('好啊！期待跟你多認識。')});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('初次交談，兩人相談甚歡，約好了改天再深入聊聊，邊境鎮又多了一段新的緣分。')}`;
                },
                // v5.13.0 更多樣的初次見面:尷尬的、八卦的、被東西吸引的、毒舌的、一見如故的
                () => { // 尷尬撞見
                    lines.push({speaker:agentA.name, text:tA.includes('shy')?t('啊,抱歉!我不是故意擋路的...'):t('喔喔,不好意思,差點撞到你。')});
                    lines.push({speaker:agentB.name, text:`${t('沒事沒事,是我在發呆。你是...')}${agentA.name}${t('?我常在')}${loc}${t('看到你。')}`});
                    lines.push({speaker:agentA.name, text:t('對啊,我幾乎天天來這。你也是這一帶的人?')});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?t('嗯...算是吧。那個...改天見。'):t('是啊,以後常會碰到,多多關照囉!')});
                    affA = randInt(1,3); affB = randInt(1,3);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('不小心撞在一起,尷尬又好笑地認識了彼此。')}`;
                },
                () => { // 被八卦拉近
                    const r = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`${t('欸,你有沒有聽說?')}${r}${t('!')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('什麼!快跟我說詳細的!我最愛聽這種了!'):t('咦?我還真沒聽過,你消息真靈通。')});
                    lines.push({speaker:agentA.name, text:t('哈哈,我就是喜歡到處打聽。對了,我還沒問你叫什麼名字呢?')});
                    lines.push({speaker:agentB.name, text:`${t('我是')}${agentB.name}${t('。看來以後鎮上有什麼風吹草動,找你就對了!')}`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('用一則八卦成功勾起')}${agentB.name}${t('的興趣,兩人在')}${loc}${t('越聊越起勁。')}`;
                },
                () => { // 被手上的東西吸引
                    const item = pickRandom(gifts);
                    lines.push({speaker:agentB.name, text:`${t('欸,你手上那個是')}${item}${t('嗎?看起來好特別。')}`});
                    lines.push({speaker:agentA.name, text:tA.includes('creative')?t('對啊!我自己弄的,還在研究怎麼做得更好。你有興趣?'):t('喔這個啊,隨手弄的。你喜歡的話...改天送你一個?')});
                    lines.push({speaker:agentB.name, text:t('真的可以嗎!那我就不客氣了。我還不知道你名字呢。')});
                    lines.push({speaker:agentA.name, text:`${t('我叫')}${agentA.name}${t('。以後想要就來找我,別客氣。')}`});
                    affA = randInt(2,4); affB = randInt(3,5);
                    summary = `${agentB.name}${t('被')}${agentA.name}${t('手上的')}${item}${t('吸引,兩人就這麼聊開了,約好改天再見。')}`;
                },
                () => { // 毒舌/慢熱的初遇
                    const grump = tA.includes('abrasive') || tA.includes('pessimist') ? agentA : (tB.includes('abrasive') || tB.includes('pessimist') ? agentB : agentA);
                    const other = grump === agentA ? agentB : agentA;
                    lines.push({speaker:grump.name, text:t('新來的?這鎮上沒什麼好的,別抱太大期望。')});
                    lines.push({speaker:other.name, text:tB.includes('optimist')||tA.includes('optimist')?t('哈哈,你這人真直接!不過我倒覺得這裡挺有意思的。'):t('喔...好吧,謝謝提醒。')});
                    lines.push({speaker:grump.name, text:`${t('...算了,你要真遇到麻煩,來找我。我叫')}${grump.name}${t('。')}`});
                    lines.push({speaker:other.name, text:t('嘴硬心軟嘛,我懂。多謝啦!')});
                    affA = randInt(0,3); affB = randInt(0,3);
                    summary = `${grump.name}${t('嘴上潑冷水,卻還是對新認識的')}${other.name}${t('伸出了援手,反差讓人莞爾。')}`;
                },
                () => { // 一見如故
                    lines.push({speaker:agentA.name, text:`${t('奇怪,我總覺得跟你特別聊得來,明明才剛認識。')}`});
                    lines.push({speaker:agentB.name, text:t('我也有這種感覺!是不是上輩子就認識了哈哈。')});
                    lines.push({speaker:agentA.name, text:`${t('那以後要常一起')}${pickRandom([t('喝一杯'),t('散步'),t('看星星'),t('吃飯')])}${t('啊!')}`});
                    lines.push({speaker:agentB.name, text:t('一言為定!能認識你真好。')});
                    affA = randInt(3,6); affB = randInt(3,6);
                    if (Personality.compatibility(tA, tB) > 1) { romA = randInt(0,2); romB = randInt(0,2); }
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('一見如故,相談甚歡,彷彿認識了很久的老友。')}`;
                },
            ];
            pickRandom(strangerTopics)();
        } else {
            // --- Normal acquaintance conversation — vivid and story-driven ---
            const normalTopics = [
                // Sharing discoveries
                () => {
                    const discovery = pickRandom([
                        `${t('你知道嗎？我昨天在河邊發現了一種從沒見過的')}${pickRandom([t('發光的石頭'),t('藍色的蘑菇'),t('奇怪的腳印')])}`,
                        `${t('我昨晚在')}${pickRandom([t('圖書館'),t('禮拜堂'),t('山丘上')])}${t('看到了')}${pickRandom([t('神秘的光'),t('一隻從沒見過的鳥'),t('天上有兩個月亮')])}`,
                        `${t('今天早上我去')}${pickRandom([t('井邊打水'),t('田裡幹活'),t('林子裡散步')])}${t('的時候，聽到了')}${pickRandom([t('很美的歌聲'),t('奇怪的低語'),t('遠方傳來的鐘聲')])}`,
                    ]);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('！')}${discovery}${t('！')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('creative')?t('什麼！？太神奇了！你帶我去看好不好！'):t('真的假的？該不會是你看花眼了吧？')});
                    lines.push({speaker:agentA.name, text:t('我騙你幹嘛！千真萬確，下次遇到我馬上叫你！')});
                    lines.push({speaker:agentB.name, text:tB.includes('pessimist')?t('好吧好吧...不過要是什麼危險的東西你可要負責。'):`${t('一言為定！記得帶上')}${food}${t('，探險可不能餓肚子！')}`});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('興奮地和')}${agentB.name}${t('分享了一個神奇的發現，兩人在')}${loc}${t('聊得眉飛色舞，約好下次一起去探索。')}`;
                },
                // Season + food + life detail
                () => {
                    lines.push({speaker:agentA.name, text:`${t(season)}${t('最棒的就是')}${food}${t('了！我剛從酒館帶了一份，要不要嚐嚐？')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('哇！好香！你也太貼心了吧——等等，你該不會有什麼事要拜託我？'):`${t('還行吧，不過我比較想吃')}${pickRandom(foods[season]||foods['春季'])}${t('。')}`});
                    lines.push({speaker:agentA.name, text:`${t('被你看穿了！其實是想問你')}${pickRandom([t('鎮上最近有什麼新鮮事'),t('知不知道哪裡可以買到好木材'),t('有沒有認識會修屋頂的人')])}${t('。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('charismatic')?t('哈哈！先吃東西再說正事！來來來，坐下聊。'):t('嗯...讓我想想，我好像聽說過一些消息。')});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('帶了')}${food}${t('到')}${loc}${t('和')}${agentB.name}${t('邊吃邊聊，')}${t(season)}${t('的暖意讓兩人的對話格外愜意。')}`;
                },
                // Work + dramatic story
                () => {
                    const workStory = pickRandom([
                        {a:`${t('你不知道！今天')}${jobA}${t('的時候差點出大事——')}${pickRandom([t('一塊巨石突然滾下來'),t('工具斷了差點傷到人'),t('發現了一條密道')])}${t('！')}`, sum:t('分享了工作中驚險的一幕')},
                        {a:`${t('告訴你一個祕密，')}${pickRandom([t('倉庫裡藏了一批沒人知道的好東西'),t('鎮公所的地下室好像有奇怪的聲音'),t('雜貨店老闆其實以前是個冒險家')])}${t('！')}`, sum:t('悄悄透露了鎮上的一個祕密')},
                        {a:`${t('我今天在')}${pickRandom([t('工作的時候'),t('路上'),t('吃飯的時候')])}${t('碰到一件超搞笑的事——')}${pickRandom([t('有人把一桶水潑在鎮長身上'),t('一隻雞追著守衛跑了三圈'),t('有個旅人居然帶了一頭熊進酒館')])}${t('！')}`, sum:t('分享了一件讓人笑到肚子痛的趣事')},
                    ]);
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('！')}${workStory.a}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('不會吧！？然後呢然後呢！？快說！'):t('哈哈哈你認真的嗎！？這也太誇張了！')});
                    lines.push({speaker:agentA.name, text:t('我發誓是真的！當場所有人都傻眼了！')});
                    lines.push({speaker:agentB.name, text:t('這件事我要跟全鎮的人說！太精彩了！')});
                    affA = randInt(2,5); affB = randInt(2,5);
                    summary = `${agentA.name}${t('在')}${loc}${t('向')}${agentB.name}${workStory.sum}${t('，兩人笑得前仰後合，')}${loc}${t('裡充滿了歡樂的氣氛。')}`;
                },
                // Gift giving
                () => {
                    const gift = pickRandom(gifts);
                    lines.push({speaker:agentA.name, text:`${t('對了')}${agentB.name}${t('，這個給你——')}${gift}${t('，上次你幫了我大忙，一直想謝謝你。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('shy')?t('欸...這也太...我只是舉手之勞啊，你不用這麼客氣的...'):t('你也太有心了吧！我只是做了該做的事而已！不過...我超喜歡的，謝謝！')});
                    lines.push({speaker:agentA.name, text:t('喜歡就好！以後有什麼需要幫忙的儘管開口。')});
                    lines.push({speaker:agentB.name, text:t('一定！你也是！...今天真的心情變好了。')});
                    affA = randInt(3,5); affB = randInt(4,6);
                    summary = `${agentA.name}${t('在')}${loc}${t('送了')}${agentB.name}${gift}${t('作為感謝，')}${agentB.name}${t('感動之餘兩人的友誼又更進了一步，')}${t(season)}${t('的空氣裡充滿了溫暖。')}`;
                },
                // Rumors and gossip
                () => {
                    const rumor = pickRandom(rumors);
                    lines.push({speaker:agentA.name, text:`${t('嘿')}${agentB.name}${t('，你有聽說嗎？')}${rumor}${t('。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('gossip')?t('真的！？我的天，這也太刺激了！你從哪裡聯來的？'):t('嗯？聽起來不太靠譜...不過如果是真的就有意思了。')});
                    lines.push({speaker:agentA.name, text:`${t('好幾個人都這麼說呢！而且昨天夜裡好像真的有人看到')}${pickRandom([t('可疑的影子'),t('奇怪的燈火'),t('一群穿斗篷的人')])}${t('。')}`});
                    lines.push({speaker:agentB.name, text:tB.includes('kind')?t('嗯...希望不是什麼壞事。不過有你一起我就安心多了。'):t('哼，我倒要看看到底是怎麼回事。明天一起去打聽！')});
                    affA = randInt(2,4); affB = randInt(2,4);
                    summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('低聲討論著鎮上的神秘傳聞，越聊越覺得事情不簡單，兩人的表情既好奇又緊張。')}`;
                },
                // Mood-driven dramatic scene
                () => {
                    if (agentA.mood < 20) {
                        lines.push({speaker:agentB.name, text:`${agentA.name}...${t('你怎麼一個人坐在')}${loc}${t('發呆？你的眼眶是不是紅紅的...')}`});
                        lines.push({speaker:agentA.name, text:tA.includes('stoic')?t('...我沒事。只是在想一些事情。'):t('...最近什麼事都不順利，我有時候在想，我來邊境鎮到底對不對。')});
                        lines.push({speaker:agentB.name, text:tB.includes('kind')?`${t('你聽我說——你是這個鎮上不可或缺的人。我們都需要你。來，先喝口')}${food}${t('暖暖身子。')}`:`${t('你少來了，沒有你誰來做')}${jobA}${t('？鎮上離了你可不行。')}`});
                        lines.push({speaker:agentA.name, text:`${t('......謝謝你，')}${agentB.name}${t('。有你在真好。')}`});
                        affA = randInt(3,6); affB = randInt(2,4);
                        summary = `${agentB.name}${t('在')}${loc}${t('發現了獨自落寞的')}${agentA.name}${t('，溫柔地遞上一杯')}${food}${t('，用真摯的話語驅散了陰霾，')}${agentA.name}${t('眼眶泛紅地笑了。')}`;
                    } else if (agentA.mood > 70) {
                        lines.push({speaker:agentA.name, text:`${agentB.name}${t('！你猜怎麼著！今天是我這輩子最好的一天——')}${pickRandom([t('工作順利到不可思議'),t('發現了一個超棒的地方'),t('有人跟我說了一句讓我開心到飛起來的話')])}${t('！')}`});
                        lines.push({speaker:agentB.name, text:tB.includes('pessimist')?t('你也太浮誇了...不過看你這麼開心我也忍不住笑了。'):`${t('太好了！快跟我說！今天我請你喝')}${food}${t('慶祝！')}`});
                        lines.push({speaker:agentA.name, text:`${t('我現在覺得什麼困難都打不倒我！連')}${t(season)}${t('的天氣都特別配合！')}`});
                        lines.push({speaker:agentB.name, text:t('哈哈哈，你也太誇張了！不過...你開心我也開心，畢竟你笑起來真的很有感染力。')});
                        affA = randInt(2,5); affB = randInt(2,5);
                        summary = `${t('心情大好的')}${agentA.name}${t('在')}${loc}${t('拉著')}${agentB.name}${t('分享喜悅，開懷大笑的聲音感染了整個')}${loc}${t('，連路過的人都忍不住嘴角上揚。')}`;
                    } else {
                        lines.push({speaker:agentA.name, text:`${agentB.name}${t('，你有沒有想過...如果當初沒來邊境鎮，現在會在哪裡？')}`});
                        lines.push({speaker:agentB.name, text:tB.includes('creative')?`${t('我有時候會想呢。也許在某個大城市裡迷失方向吧...但這裡有')}${scene}${t('，有你們這些朋友，我不後悔。')}`:`${t('想那麼多幹嘛？現在過得不錯就好了。走，去弄點')}${food}${t('來吃。')}`});
                        lines.push({speaker:agentA.name, text:t('說得也是。有時候覺得命運把我們送到這裡，一定有它的道理。')});
                        lines.push({speaker:agentB.name, text:`${t('少在那邊感慨了！')}${food}${t('可不等人，走走走！')}`});
                        affA = randInt(2,4); affB = randInt(2,4);
                        summary = `${agentA.name}${t('和')}${agentB.name}${t('在')}${loc}${t('感慨起命運的安排，聊起了')}${scene}${t('的美好，最後被')}${food}${t('的香氣拉回了現實，氣氛輕鬆溫馨。')}`;
                    }
                },
            ];
            pickRandom(normalTopics)();

            if (Math.random() < 0.12) {
                this._addConflictEscalation(lines, agentA, agentB, world, tA, tB);
                affA = Math.min(affA, randInt(-4, -1));
                affB = Math.min(affB, randInt(-4, -1));
                summary += t('但後來氣氛突然變得微妙，兩人不歡而散。');
            }
        }

        // Romantic sparks — only when affinity is already decent
        if (!isCouple && !isRival && affA >= 3 && affB >= 3 && relA.affinity > 20 && relB.affinity > 20) {
            const hasRomanticTrait = tA.includes('romantic') || tB.includes('romantic');
            const hasChemistry = (tA.includes('shy') && tB.includes('charismatic')) ||
                                 (tB.includes('shy') && tA.includes('charismatic')) ||
                                 (tA.includes('creative') && tB.includes('creative'));
            const sparkChance = hasRomanticTrait ? 0.3 : hasChemistry ? 0.2 : 0.1;
            if (Math.random() < sparkChance) {
                const spark = randInt(1, hasRomanticTrait ? 3 : hasChemistry ? 2 : 2);
                romA += spark; romB += Math.max(0, spark - randInt(0,1));
            }
        }

        return { lines, _affA:affA, _affB:affB, _romA:romA, _romB:romB, _summary:summary };
    }

    _personalityGreeting(agent, other, rel) {
        const tr = agent.personality.traits;
        const name = other.name;
        if (rel.status === 'dating' || rel.status === 'married') return pickRandom([`${t('親愛的')}${name}${t('。')}`,`${name}~`,`${t('嘿，')}${name}${t('。')}`]);
        if (tr.includes('charismatic')) return pickRandom([`${t('嘿！')}${name}${t('！')}`,`${t('哈囉')}${name}${t('，真高興見到你！')}`,`${name}${t('！好久不見！')}`]);
        if (tr.includes('shy')) return pickRandom([`${t('啊...')}${name}...${t('你好。')}`,t('嗯...你好。'),t('...嗨。')]);
        if (tr.includes('abrasive')) return pickRandom([`${t('喔，')}${name}${t('啊。')}`,t('怎麼又是你。'),`${name}${t('。')}`]);
        if (tr.includes('optimist')) return pickRandom([`${name}${t('！今天也是美好的一天！')}`,`${t('嗨')}${name}${t('，你看起來很有精神！')}`]);
        if (tr.includes('pessimist')) return pickRandom([`${name}...${t('唉。')}`,`${t('嗯...')}${name}${t('。')}`]);
        return pickRandom([`${t('嘿，')}${name}${t('。')}`,`${t('你好啊，')}${name}${t('。')}`,`${t('哈囉，')}${name}${t('！')}`,`${name}${t('，好久不見。')}`]);
    }

    _addConflictEscalation(lines, agentA, agentB, world, tA, tB) {
        const conflictTypes = [
            // Bad joke that offends
            () => {
                const jokes = [
                    `${t('哈哈，你知道嗎，你做的')}${agentB.job?.title||t('事')}${t('讓我想到一個笑話——')}`,
                    t('說真的，你那個表情也太好笑了吧？'),
                    `${t('你是不是又')}${pickRandom([t('偷懶'),t('搞砸'),t('遲到')])}${t('了？我開玩笑的啦。')}`,
                ];
                lines.push({speaker:agentA.name, text:pickRandom(jokes)});
                lines.push({speaker:agentB.name, text:tB.includes('stoic')?t('......這一點都不好笑。'):tB.includes('neurotic')?t('你這什麼意思！？'):t('呵，你覺得很幽默嗎？')});
                lines.push({speaker:agentA.name, text:tA.includes('kind')?t('抱歉抱歉，我不是那個意思...'):t('開不起玩笑啊？')});
            },
            // Value clash
            () => {
                const vA = agentA.personality.values[0] || '自由';
                const vB = agentB.personality.values[0] || '秩序';
                if (vA !== vB) {
                    lines.push({speaker:agentA.name, text:`${t('我覺得')}${vA}${t('才是最重要的，你不覺得嗎？')}`});
                    lines.push({speaker:agentB.name, text:`${t('我倒覺得')}${vB}${t('比較重要。你那種想法太天真了。')}`});
                    lines.push({speaker:agentA.name, text:tA.includes('stoic')?t('看法不同而已。'):t('哼，你不懂。')});
                } else {
                    lines.push({speaker:agentA.name, text:`${agentB.name}${t('，你最近做的那件事，我覺得不太好。')}`});
                    lines.push({speaker:agentB.name, text:t('你管太多了吧？')});
                }
            },
            // Passive-aggressive remark
            () => {
                const remarks = [
                    `${t('嗯...')}${agentB.name}${t('你最近是不是胖了？')}`,
                    t('有些人啊，就是不知道自己幾斤幾兩。'),
                    t('哦對了，上次的事你還記得吧？算了，不提了。'),
                    t('我不是在說你啦，不過有人最近做事真的很馬虎。'),
                ];
                lines.push({speaker:agentA.name, text:pickRandom(remarks)});
                lines.push({speaker:agentB.name, text:tB.includes('abrasive')?t('你在暗示什麼？有話直說！'):tB.includes('shy')?'......':tB.includes('neurotic')?t('你是不是在說我！？'):t('...你今天怎麼了？')});
            },
            // Gossip about the other behind their back gets revealed
            () => {
                lines.push({speaker:agentB.name, text:`${agentA.name}${t('，我聽說你跟別人說我')}${pickRandom([t('壞話'),t('是非'),t('閒話')])}${t('？')}`});
                lines.push({speaker:agentA.name, text:tA.includes('gossip')?t('啊...那個...不是你想的那樣。'):tA.includes('abrasive')?t('我說的都是事實。'):t('什麼？我沒有啊！')});
                lines.push({speaker:agentB.name, text:tB.includes('kind')?t('我希望以後別這樣了。'):t('我會記住的。')});
            },
            // Annoying behavior
            () => {
                const annoyances = [
                    {act:t('一直不停地說話'), resp:t('你能不能安靜一會兒...')},
                    {act:t('吃東西的聲音超大'), resp:t('拜託，能不能注意一下？')},
                    {act:t('不請自來地給建議'), resp:t('我沒有問你的意見。')},
                    {act:`${t('打斷')}${agentB.name}${t('說話')}`, resp:t('你能讓我把話說完嗎！？')},
                ];
                const a = pickRandom(annoyances);
                lines.push({speaker:agentA.name, text:tA.includes('charismatic')?t('對了對了，我跟你說——'):t('嗯，我覺得你應該——')});
                lines.push({speaker:agentB.name, text:a.resp});
                lines.push({speaker:agentA.name, text:tA.includes('kind')?t('...對不起。'):t('切，好心沒好報。')});
            },
        ];
        pickRandom(conflictTypes)();
    }

    async generatePlayerReply(player, npc, playerMessage, world) {
        const relNpc = npc.relationships.getOrCreate(player.agentId, player.name);
        const relPlayer = player.relationships.getOrCreate(npc.agentId, npc.name);

        if (this.llm) {
            console.log('[RimTown] Using LLM for player chat with', npc.name, '| provider:', this.llm.provider);
            try {
                const recentChat = player.chatHistory.filter(c => c.target === npc.name || c.speaker === npc.name)
                    .slice(-10).map(c => `${c.speaker}: ${c.text}`).join('\n');
                // v5.29.0 記憶流檢索:以玩家這句話為焦點,撈出最相關的記憶(而非只看最近 5 則)
                const memNpc = npc.memory.retrieve(`${player.name} ${playerMessage}`, [player.name], 5, world.tickCount);
                const npcThoughts = npc.memory.getThoughts(2);
                const pN = this._buildCharacterProfile(npc);
                const prompt = `${t('你正在扮演「')}${npc.name}${t('」——邊境鎮的一位真實居民。有個叫')}${player.name}${t('的人正在跟你說話。')}${playerTitle(world) === t('鎮長') ? t('他是現任鎮長。') : `${t('他是來到鎮上的旅人，不是鎮長，不要叫他鎮長。')}${mayorNameOf(world) ? `${t('現任鎮長是')}${mayorNameOf(world)}${t('。')}` : ''}`}
${t('你要完全入戲，像真人一樣自然地回應。')}

${t('【你是誰】')}
${pN.name}${t('，')}${pN.age}${t('歲，')}${pN.job}${t('。')}
${t('性格：')}${pN.traits}${t('。背景：')}${pN.background}${t('。')}
${t('在意的事：')}${pN.values}${t('。感情狀態：')}${pN.status}${t('。')}
${pN.thought ? `${t('你最近在想：')}${pN.thought}` : ''}
${this._buildRelContext(relNpc, player.name)}
${memNpc.length ? `${t('你記得的事（跟話題相關就自然提起）：')}${memNpc.map(m=>`[${m.timeStr}] ${m.content}`).join(t('；'))}` : `${t('你跟')}${player.name}${t('還不太熟。')}`}
${npcThoughts.length ? `${t('你心裡的體悟：')}${npcThoughts.map(m=>m.content).join(t('；'))}` : ''}

${world.festivals?.activeFestival ? `${t('【今天是')}${world.festivals.activeFestival.name}${t('!】')}${world.festivals.activeFestival.description}${t('聊天時可以自然提到祭典。')}` : ''}
${t('【小鎮經濟】')}
${this._buildEconomicContext(world)}
${this._buildQuestContext(world, npc, relNpc)}
${t('【對話記錄】')}
${recentChat || t('（剛開始聊）')}
${player.name}: ${playerMessage}

${t('【回覆規則】')}
${LLM_LANG.rule(t('- 必須使用繁體中文（台灣用語），不可使用簡體中文。1-3句話'), '- Write only in natural English; do not use Chinese. 1-3 sentences')}
${t('- 像真人說話，不要文縐縐的。可以用語助詞（啊、啦、嘛、欸、喔、哈）')}
${t('- 根據你的性格回應：')}${pN.traits.includes(t('害羞')) ? t('你會說話結巴、簡短') : pN.traits.includes(t('健談')) ? t('你很愛聊天，會主動延伸話題') : pN.traits.includes(t('刻薄')) ? t('你說話帶刺但可能是關心的方式') : t('用你自己的方式說話')}
${t('- 不要直接說「我很累」「我心情不好」這種報告式的話。如果你累了，可能會打哈欠或說「唉今天腰都快斷了」')}
${t('- 對話要有來有往——回應對方說的話，也可以反問或岔開新話題')}
${t('- 如果聊到你在意的事（')}${pN.values}${t('），你會特別有感觸')}

${t('【輸出格式】嚴格遵守！')}
${t('- 第一行開始就直接寫')}${npc.name}${t('的對話內容，不要加任何分析、思考過程、或前言')}
${t('- 不要寫「讓我分析」「根據設定」「需要考慮」等分析文字')}
${t('- 不要加名字前綴')}
${t('- 最後另起一行寫：')}EFFECTS: {"affinity_change": ${t('數字')}(-3${t('到')}5), "romantic_change": ${t('數字')}(0${t('到')}3), "summary": "${t('一句話總結')}"}
${t('- 整個回覆只有對話內容和EFFECTS行，不要有其他任何東西')}`;

                // v5.44.0 400→600:中文回覆容易撞上限被砍半句(「呃…最近我在算一個關於」),放寬並配合句尾收斂
                const response = await this.llm.generate(prompt, 600, 0.9, true);
                console.log('[RimTown] LLM response length:', response?.length, 'preview:', response?.slice(0, 80));
                return this._parsePlayerReply(response, player, npc, world, playerMessage, relPlayer, relNpc);
            } catch(e) { console.error('[RimTown] LLM player reply failed:', e); }
        } else {
            console.log('[RimTown] No LLM client — using fallback for player chat');
        }
        return this._fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc);
    }

    _parsePlayerReply(response, player, npc, world, playerMessage, relPlayer, relNpc) {
        if (!response || !response.trim()) {
            // LLM returned empty → use fallback
            return this._fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc);
        }
        // Strip any reasoning/analysis blocks the LLM may have emitted
        let cleaned = response.trim();
        // Remove markdown-style thinking blocks
        cleaned = cleaned.replace(/```(?:thinking|analysis|reasoning)[\s\S]*?```/gi, '');
        // Remove lines that look like LLM internal analysis (common patterns)
        cleaned = cleaned.replace(/^[\s\S]*?(?=\n[^需要根据首先接下来分析让我])/m, (match) => {
            // Only strip if it looks like extended reasoning (>100 chars before first dialogue line)
            return match.length > 100 && /(?:需要|根据|分析|首先|接下来|让我|用户|角色|设定|背景|规则)/.test(match) ? '' : match;
        });

        const lines = cleaned.trim().split('\n');
        const replyLines = []; let effects = {};
        let foundEffects = false;
        for (const line of lines) {
            const s = line.trim(); if (!s) continue;
            if (s.startsWith('EFFECTS:') || s.startsWith('effects:') || s.startsWith('Effects:')) {
                try {
                    const rest = lines.slice(lines.indexOf(line)).join('\n');
                    const js=rest.indexOf('{'), je=rest.lastIndexOf('}')+1;
                    if(js>=0&&je>js) effects=JSON.parse(rest.slice(js,je));
                } catch(e){}
                foundEffects = true;
                break;
            } else {
                let text = s;
                // Strip various prefixes: "Name:", "**Name:**", "Name：", etc.
                const prefixPatterns = [
                    new RegExp(`^\\*{0,2}${npc.name}\\*{0,2}[${t('：')}:]\\s*`),
                    /^\*{0,2}[\w\u4e00-\u9fff]+\*{0,2}[：:]\s*/,
                ];
                for (const pat of prefixPatterns) {
                    if (pat.test(text)) { text = text.replace(pat, '').trim(); break; }
                }
                // Skip lines that look like stage directions or system text
                if (text.startsWith('(') && text.endsWith(')')) continue;
                if (text.startsWith(t('（')) && text.endsWith(t('）'))) {
                    // Keep emotional descriptions in parentheses
                    replyLines.push(text);
                    continue;
                }
                // Skip lines that look like LLM reasoning/analysis (not actual dialogue)
                if (/^(?:需要|根据|根據|首先|接下来|接下來|让我|讓我|分析|用户|用戶|角色|设定|設定|背景|规则|規則|考虑|考慮|这个|這個|所以|因此|综上|綜上|最后|最後按照|输出|輸出)/.test(text)) continue;
                // Skip lines with meta-commentary markers
                if (/(?:affinity_change|romantic_change|summary|好感度变化|好感度變化)/.test(text) && !foundEffects) continue;
                if (text) replyLines.push(text);
            }
        }
        let npcReply = replyLines.join(' ').trim();
        // v5.44.0 截斷防護:回覆被 max_tokens 砍斷時,收斂到最後一個完整句子,不再出現半句話
        if (npcReply && !/[。！？!?…～~」』)）]$/.test(npcReply)) {
            const m = npcReply.match(/^[\s\S]*[。！？!?…～~」』)）]/);
            if (m && m[0].length >= 8) npcReply = m[0];
        }
        if (!npcReply) {
            // Parsing yielded nothing → use fallback
            return this._fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc);
        }
        const affChange = effects.affinity_change ?? randInt(0,2);
        const romChange = effects.romantic_change ?? 0;
        const summary = effects.summary || `${npc.name}${t('回應了')}${player.name}${t('。')}`;
        relNpc.modifyAffinity(affChange); relNpc.modifyRomantic(romChange); relNpc.recordInteraction(world.tickCount, summary);
        relPlayer.modifyAffinity(Math.max(0, affChange-1)); relPlayer.recordInteraction(world.tickCount, summary);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name}${t('說：「')}${playerMessage}${t('」— ')}${summary}`, 5, [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${npc.name}${t('交談：')}${summary}`, 4, [npc.name]);
        // Only push NPC reply (player message already added by playerSendMessage)
        // 去重不比對時間戳:AI 回覆期間遊戲時間會前進,舊檢查因時間不同而重複寫入玩家訊息(重複留言 bug)
        if (!player.chatHistory.slice(-6).some(m => m.speaker === player.name && m.target === npc.name && m.text === playerMessage)) {
            player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        }
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        player._recentChatTick = world.tickCount; // Mark for social need recovery
        world.logMessage('player_chat', `${player.name} → ${npc.name}: ${summary}`, player.name, npc.name);
        // v5.41.0 跟玩家聊出強烈反應(好感大變/心動) → NPC 即時改寫今天剩餘行程
        if (Math.abs(affChange) >= 4 || romChange >= 2) {
            this.replanRestOfDay(npc, world, `${t('和')}${player.name}${t('聊了之後：')}${summary}`).catch(() => {});
        }
        world.checkHeartEvents?.(); // v5.0.0 聊天後檢查心動事件
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:affChange,romantic_change:romChange}, summary };
    }

    _fallbackPlayerReply(player, npc, world, playerMessage, relPlayer, relNpc) {
        const tr = npc.personality.traits;
        const aff = relNpc.affinity;
        const isCouple = relNpc.status === 'dating' || relNpc.status === 'married';
        const msg = playerMessage.toLowerCase();
        const jobTitle = npc.job?.title || t('居民');
        const jobKey = npc.job?.key || '';
        const loc = npc.currentLocation.replace(/_/g,' ');
        const season = world.clock.season;
        const timeOfDay = world.clock.timeOfDay;
        const isNight = timeOfDay === 'night' || timeOfDay === 'evening';

        let npcReply = '';
        let affChange = 0;
        let romChange = 0;
        let summary = '';

        // Detect message intent via keyword matching
        const isGreeting = /你好|嗨|哈囉|hello|hi|早安|晚安|嘿/.test(msg);
        const isAskName = /名字|你叫|你是誰|認識/.test(msg);
        const isAskJob = /工作|職業|做什麼|你在幹|忙什麼/.test(msg);
        const isAskMood = /心情|怎麼了|還好嗎|你好嗎|開心|難過|不好/.test(msg);
        const isAskLove = /喜歡|愛|暗戀|對象|交往|結婚|單身|感情/.test(msg);
        const isFlirt = /好看|漂亮|帥|可愛|迷人|約會|陪我/.test(msg);
        const isAskTown = /鎮上|小鎮|這裡|消息|八卦|新聞|最近/.test(msg);
        const isAskFood = /吃|餓|食物|餐|飯|料理|好吃/.test(msg);
        const isCompliment = /厲害|佩服|好棒|真強|了不起|手藝|技術/.test(msg);
        const isInsult = /笨|蠢|醜|差|爛|廢|討厭|滾/.test(msg);
        const isFarewell = /再見|掰|拜|走了|先走|告辭/.test(msg);
        const isAskHelp = /幫忙|幫我|拜託|求你|需要/.test(msg);
        const isAskStory = /故事|過去|以前|經歷|怎麼來|家鄉/.test(msg);
        const isAskWeather = /天氣|天空|冷|熱|下雨|季節|星星/.test(msg);

        // Personality-flavored response builder
        const shy = tr.includes('shy');
        const kind = tr.includes('kind');
        const abrasive = tr.includes('abrasive');
        const charismatic = tr.includes('charismatic');
        const gossip = tr.includes('gossip');
        const romantic = tr.includes('romantic');
        const pessimist = tr.includes('pessimist');
        const optimist = tr.includes('optimist');
        const lazy = tr.includes('lazy');

        if (isInsult) {
            // Player is being mean
            if (abrasive) npcReply = pickRandom([t('你說什麼！？你自己才是吧！'),t('哼，你也好不到哪去。'),t('你這嘴巴欠教訓。')]);
            else if (shy) npcReply = pickRandom([t('...你、你怎麼能這樣說...'),'......',t('我做錯什麼了嗎...')]);
            else if (kind) npcReply = pickRandom([t('這樣說話很傷人的...'),t('你是不是心情不好？不然怎麼會這樣。'),t('我...不知道你為什麼要這樣。')]);
            else npcReply = pickRandom([t('你這話說得太過分了。'),t('......我沒必要跟你計較。'),t('你認真的嗎？')]);
            affChange = randInt(-6,-3);
            summary = `${player.name}${t('言語冒犯了')}${npc.name}${t('。')}`;
        } else if (isFlirt) {
            if (isCouple) {
                npcReply = pickRandom([t('你啊...每次都這樣，不過我就是吃這套。'),t('哈哈，老夫老妻了還這麼會講。'),t('你真的很會撩人，我都不好意思了。')]);
                affChange = randInt(2,4); romChange = randInt(1,3);
            } else if (romantic && aff > 10) {
                npcReply = shy ? pickRandom([t('你、你在說什麼啦...（臉紅）'),t('別、別突然這樣講...'),t('...謝謝...（小聲）')])
                    : pickRandom([t('哈哈，你還挺會說話的嘛。'),t('嗯？你是在跟我告白嗎？'),t('你這話讓人心跳加速呢。')]);
                affChange = randInt(1,4); romChange = randInt(2,5);
            } else if (aff < -10) {
                npcReply = pickRandom([t('...你在開什麼玩笑。'),t('拜託，省省吧。'),t('你是不是搞錯了什麼？')]);
                affChange = randInt(-2,0);
            } else {
                npcReply = shy ? t('...什麼？（不知所措）') : pickRandom([t('哈？你認真的嗎？'),t('嗯...謝謝？'),t('你還挺有趣的。')]);
                affChange = randInt(0,2); romChange = randInt(0,2);
            }
            summary = `${player.name}${t('對')}${npc.name}${t('說了甜言蜜語。')}`;
        } else if (isGreeting) {
            if (isCouple) npcReply = pickRandom([`${t('嗨親愛的，我一直在等你呢。')}`,`${t('你來了！好想你。')}`,`${t('嘿~今天怎麼這麼晚來找我？')}`]);
            else if (aff > 50) npcReply = charismatic ? `${player.name}${t('！太好了你來了！')}`
                : shy ? `${t('啊...')}${player.name}...${t('你好。（微笑）')}`
                : `${t('嘿！好久不見，最近好嗎？')}`;
            else if (aff > 10) npcReply = pickRandom([`${t('你好啊！有什麼事嗎？')}`,`${t('嗨！今天')}${loc}${t('挺熱鬧的。')}`,`${t('哈囉，正好遇到你了。')}`]);
            else if (aff > -10) npcReply = abrasive ? t('嗯？怎麼了。') : pickRandom([`${t('嗯，你好。')}`,`${t('哦，是你啊。')}`,`${t('哈囉。')}`]);
            else npcReply = pickRandom([`...${t('有事嗎？')}`,`${t('你又來了。')}`,`${t('嗯。')}`]);
            affChange = aff > -10 ? randInt(0,2) : randInt(-1,0);
            summary = `${player.name}${t('和')}${npc.name}${t('打了招呼。')}`;
        } else if (isAskName) {
            npcReply = pickRandom([
                `${t('我叫')}${npc.name}${t('，')}${npc.age}${t('歲，在鎮上當')}${jobTitle}。`,
                `${npc.name}${t('啊，怎麼？你忘了我嗎？')}`,
                shy ? `${t('我...我叫')}${npc.name}...` : `${t('我是')}${npc.name}${t('，認識一下！')}`,
            ]);
            affChange = randInt(0,2);
            summary = `${npc.name}${t('自我介紹了。')}`;
        } else if (isAskJob) {
            const jobReplies = {
                farmer: [`${t('我是農夫啊，每天日出就到田裡去了。')}${season}${t('是')}${pickRandom([t('播種'),t('收穫'),t('準備'),t('整地')])}${t('的季節。')}`,`${t('種田很辛苦，但看到作物長大就很有成就感。')}`],
                miner: [`${t('挖礦啊，每天鑽到山裡去。最近挖到了一些不錯的')}${pickRandom([t('鐵礦'),t('石頭'),t('稀有礦石')])}${t('。')}`,`${t('礦坑裡又暗又悶，但能找到好東西的時候特別開心。')}`],
                cook: [`${t('我在酒館煮飯！最近在研究新')}${pickRandom([t('菜色'),t('食譜'),t('料理')])}${t('。')}`,`${t('煮飯給大家吃是我的樂趣，你要不要嚐嚐？')}`],
                blacksmith: [`${t('我是鐵匠，每天跟鐵和火打交道。')}${shy?t('...比跟人打交道容易多了。'):t('最近在打造一把新的工具。')}`,`${t('敲打金屬的感覺很療癒，每一件作品都是獨一無二的。')}`],
                doctor: [`${t('我是醫生，')}${lazy?t('...雖然有時候很懶得看診。'):t('負責照顧鎮上所有人的健康。')}${t('有什麼不舒服嗎？')}`,`${t('行醫是一份責任很重的工作，但能治好人的時候很開心。')}`],
                researcher: [`${t('我在圖書館做研究，最近在研究')}${pickRandom([t('古代遺跡'),t('草藥學'),t('天文現象'),t('歷史文獻')])}${t('。')}`,`${t('學問的世界無窮無盡，每天都有新發現。')}`],
                trader: [`${t('我做買賣的，跟外面的商隊有聯繫。')}${charismatic?t('要買什麼跟我說，我給你打折！'):t('最近市場不太穩定。')}`,`${t('當商人最重要的是眼光和人脈。')}`],
                guard: [`${t('我是守衛，負責鎮上的安全。')}${pessimist?t('這年頭什麼事都可能發生。'):t('還好最近挺太平的。')}`,`${t('守衛的工作就是讓大家能安心過日子。')}`],
                carpenter: [`${t('我是木匠，蓋房子修東西。')}${lazy?t('...雖然有時候偷懶。'):t('最近在趕工，忙得很。')}`,`${t('木工的手藝越老越精，每塊木頭都有它的個性。')}`],
                tailor: [`${t('我是裁縫，做衣服的。')}${shy?t('...你要訂做什麼嗎？'):t('最近在設計新款式呢！')}`,`${t('一針一線都是心血，我對品質很要求的。')}`],
                priest: [`${t('我在禮拜堂服務，照顧大家的心靈。')}${kind?t('如果有煩惱，可以來找我聊聊。'):t('也會幫忙主持各種儀式。')}`,`${t('能為鎮民帶來平靜和希望，就是我最大的滿足。')}`],
                mayor: [`${t('我是鎮長，管理鎮上大小事務。')}${optimist?t('我對這個鎮的未來很有信心！'):t('責任很重，但這是我的使命。')}`,`${t('治理一個鎮子不容易，但看到大家過得好就值了。')}`],
            };
            const pool = jobReplies[jobKey] || [`${t('我在鎮上當')}${jobTitle}${t('，還過得去吧。')}`,`${jobTitle}${t('的工作有好有壞，但至少有事做。')}`];
            npcReply = pickRandom(pool);
            affChange = randInt(0,2);
            summary = `${npc.name}${t('聊了自己的工作。')}`;
        } else if (isAskMood) {
            if (npc.mood > 60) npcReply = pickRandom([`${t('我很好啊！')}${optimist?t('今天特別開心！'):t('最近一切都挺順利的。')}`,`${t('心情不錯！有什麼好事就是會開心嘛。')}`,`${t('挺好的，謝謝你關心。')}`]);
            else if (npc.mood > 30) npcReply = pickRandom([`${t('還行吧，普普通通。')}`,`${t('馬馬虎虎，')}${pessimist?t('不過總覺得少了什麼。'):t('就是平常的日子。')}`,`${t('沒什麼特別的，過一天算一天。')}`]);
            else npcReply = pickRandom([
                `${t('唉...說實話不太好。')}${kind?t('不過沒關係，撐得住。'):t('別問了。')}`,
                `${t('最近有點')}${pickRandom([t('煩'),t('累'),t('低落'),t('壓力大')])}...${shy?'...':t('你真的想聽嗎？')}`,
                pessimist ? t('一如既往地糟。') : t('有點不順，但會過去的。'),
            ]);
            affChange = randInt(1,3);
            summary = `${npc.name}${t('分享了自己的心情。')}`;
        } else if (isAskLove) {
            if (isCouple) {
                const partnerName = relNpc.status === 'married' ? t('老公/老婆') : t('對象');
                npcReply = pickRandom([`${t('我跟')}${player.name}${t('在一起啊，你忘了嗎？')}`,`${t('哈哈，感情的事...有你就夠了。')}`,`${t('你是在試探我嗎？我只有你啊。')}`]);
                romChange = randInt(1,3);
            } else if (relNpc.romanticInterest > 50) {
                npcReply = shy ? `${t('感、感情的事...我不太想說...（臉紅）')}` :
                    pickRandom([`${t('嗯...其實有一個在意的人啦...不告訴你是誰。')}`,`${t('你為什麼突然問這個？難道你...？')}`,`${t('哈，秘密。')}`]);
                romChange = randInt(0,2);
            } else {
                npcReply = romantic ? pickRandom([`${t('還沒遇到對的人呢...不過我相信緣分。')}`,`${t('我是很期待愛情的，只是...唉。')}`])
                    : pickRandom([`${t('這種事順其自然吧。')}`,`${t('目前沒什麼想法，工作比較重要。')}`,abrasive?t('關你什麼事。'):t('哈哈，你怎麼突然問這個？')]);
            }
            affChange = randInt(0,2);
            summary = `${player.name}${t('問了')}${npc.name}${t('感情的事。')}`;
        } else if (isAskStory) {
            npcReply = pickRandom([
                `${t('我的故事啊...')}${npc.personality.background}`,
                `${t('以前的事嗎？')}${shy?t('...有點不好意思說。'):t('坐下來，我慢慢跟你講。')} ${npc.personality.background}`,
                `${t('你想知道我的過去？好吧...')}${npc.personality.background.slice(0,50)}`,
            ]);
            affChange = randInt(1,4);
            summary = `${npc.name}${t('分享了自己的故事。')}`;
        } else if (isAskTown) {
            const gossipTopics = world.events?.conversationTopics || [];
            const gossip_s = world.gossipNetwork?.activeGossip || [];
            if (gossip && gossip_s.length) {
                const g = pickRandom(gossip_s);
                npcReply = `${t('你想知道最近的八卦？')}${g.content} ${t('這可是獨家消息喔！')}`;
            } else if (gossipTopics.length) {
                npcReply = `${t('最近鎮上在聊')}${pickRandom(gossipTopics)}${t('的事，你聽說了嗎？')}`;
            } else {
                npcReply = pickRandom([
                    `${t('鎮上最近')}${optimist?t('挺太平的，大家都過得不錯。'):t('也沒什麼特別的事。')}`,
                    `${season}${t('嘛，')}${pickRandom([t('農忙的季節'),t('大家都挺忙的'),t('日子就這樣過')])}${t('。')}`,
                    pessimist ? t('最近總覺得要出什麼事...') : `${t('邊境鎮就是這樣，每天都有小故事。')}`,
                ]);
            }
            affChange = randInt(0,3);
            summary = `${npc.name}${t('跟')}${player.name}${t('聊了鎮上的近況。')}`;
        } else if (isAskFood) {
            if (jobKey === 'cook') npcReply = pickRandom([`${t('你來對人了！我最近做了')}${pickRandom([t('燉肉'),t('烤魚'),t('蔬菜湯'),t('肉包子')])}${t('，要不要嚐嚐？')}`,`${t('吃的是我的專業！等著，我去給你弄點好吃的。')}`]);
            else if (npc.needs.hunger < 30) npcReply = `${t('別說了，我自己都快餓死了...一起去酒館吧？')}`;
            else npcReply = pickRandom([`${t('酒館的飯菜不錯，推薦你去試試。')}`,`${t('王麗煮的菜最好吃了，你應該去嚐嚐。')}`,`${t('肚子餓了嗎？吃飽了心情才會好。')}`]);
            affChange = randInt(0,2);
            summary = `${player.name}${t('和')}${npc.name}${t('聊了吃的。')}`;
        } else if (isAskWeather) {
            const weatherMap = {'春季':t('春天暖洋洋的'),'夏季':t('夏天好熱'),'秋季':t('秋天涼爽'),'冬季':t('冬天好冷')};
            if (isNight) npcReply = pickRandom([`${t('今晚的')}${pickRandom([t('星空'),t('月色'),t('夜風')])}${t('真不錯。')}`,`${t('夜裡出來')}${pickRandom([t('看星星'),t('散步'),t('吹風')])}${t('？我也覺得很舒服。')}`,tr.includes('night_owl')?t('夜晚最棒了，安安靜靜的。'):t('這麼晚了，小心著涼。')]);
            else npcReply = pickRandom([`${weatherMap[season]||t('天氣還好')}${t('，')}${optimist?t('不過我很享受！'):t('希望別變天。')}`,`${season}${t('到了，')}${pickRandom([t('時間過得真快'),t('又是新的季節'),t('風景挺美的')])}${t('。')}`]);
            affChange = randInt(0,2);
            summary = `${player.name}${t('和')}${npc.name}${t('聊了天氣。')}`;
        } else if (isCompliment) {
            if (shy) npcReply = pickRandom([`${t('啊...謝、謝謝你...（臉紅）')}`,`${t('不、不會啦...你過獎了。')}`,`...${t('真的嗎？（開心但不好意思）')}`]);
            else if (abrasive) npcReply = pickRandom([`${t('哼，不用奉承我。')}`,`...${t('你有什麼目的？')}`,`${t('嗯，我知道。')}`]);
            else npcReply = pickRandom([`${t('哈哈，謝謝！你這麼說我很開心。')}`,`${t('你真會說話！')}`,`${t('被你這樣誇，有點不好意思呢。')}`]);
            affChange = randInt(2,5);
            if (romantic) romChange = randInt(0,2);
            summary = `${player.name}${t('讚美了')}${npc.name}。`;
        } else if (isAskHelp) {
            if (kind) npcReply = pickRandom([`${t('需要幫忙嗎？儘管說！')}`,`${t('我能做的一定幫！你說吧。')}`,`${t('別客氣，鄰居互相幫忙是應該的。')}`]);
            else if (lazy) npcReply = pickRandom([`${t('嗯...看是什麼事吧。我今天有點懶...')}`,`${t('幫忙可以，但別太累的。')}`]);
            else if (abrasive) npcReply = pickRandom([`${t('看什麼事吧。')}`,`${t('我不是慈善機構。')}`,`${t('你自己不能解決嗎？')}`]);
            else npcReply = pickRandom([`${t('什麼事？看我能不能幫上忙。')}`,`${t('好吧，你說說看。')}`,`${t('我盡量吧。')}`]);
            affChange = kind ? randInt(1,3) : randInt(-1,2);
            summary = `${player.name}${t('向')}${npc.name}${t('求助。')}`;
        } else if (isFarewell) {
            if (isCouple) npcReply = pickRandom([`${t('這麼快就走？路上小心。想你。')}`,`${t('嗯...早點回來。')}`,`${t('下次再來找我。')}`]);
            else if (aff > 30) npcReply = pickRandom([`${t('再見！下次再聊！')}`,`${t('掰掰，保重啊！')}`,`${t('好的，有空再來找我！')}`]);
            else npcReply = pickRandom([`${t('嗯，再見。')}`,`${t('好的。')}`,abrasive?t('終於要走了。'):t('拜拜。')]);
            affChange = randInt(0,1);
            summary = `${player.name}${t('和')}${npc.name}${t('道別了。')}`;
        } else {
            // Detect if player is asking a question
            const isQuestion = /[？?]/.test(msg) || /嗎$|呢$|吧$/.test(msg.trim()) || /^(誰|什麼|哪|為什麼|怎麼|有沒有|是不是|知不知|你知道|你覺得|你認為|你有|可以|能不能|會不會|要不要)/.test(msg);
            const isAboutSomeone = /誰|某人|有人|大家|他們|別人|其他人/.test(msg);
            const isAboutOpinion = /覺得|認為|看法|意見|怎麼看|怎麼想/.test(msg);
            const isAboutKnowledge = /知道|聽說|有沒有|是不是|真的|假的/.test(msg);

            if (isQuestion && isAboutSomeone) {
                // Question about other people
                const gossip_s = world.gossipNetwork?.activeGossip || [];
                if (gossip && gossip_s.length) {
                    const g = pickRandom(gossip_s);
                    npcReply = pickRandom([`${t('嗯...我聽說')}${g.content}`,`${t('你問這個啊？我倒是有聽到一些...')}${g.content}`,`${shy?t('呃...我不太確定，但...'):t('我跟你說喔，')}${g.content}`]);
                } else {
                    npcReply = pickRandom([
                        `${shy?t('嗯...我不太清楚...'):t('這個嘛...')}${t('我平常不太注意別人的事。')}`,
                        `${abrasive?t('我怎麼會知道這種事。'):t('我沒聽說過耶。')}${t('你要不要去問問別人？')}`,
                        `${gossip?t('欸我有聽到一點風聲，但不確定是不是真的...'):t('這個我真的不知道。')}`,
                        `${charismatic?t('哈哈，你還挺八卦的嘛！'):t('嗯...')}${t('我對這些不太了解欸。')}`,
                    ]);
                }
                affChange = randInt(0,2);
                summary = `${player.name}${t('問了')}${npc.name}${t('關於其他人的事。')}`;
            } else if (isQuestion && isAboutOpinion) {
                // Asking for NPC's opinion
                npcReply = pickRandom([
                    `${shy?t('呃...我的想法嗎...'):t('嗯，讓我想想。')}${t('我覺得')}${pickRandom([t('每個人有每個人的想法吧'),t('很難說，要看情況'),t('這種事沒有標準答案')])}${t('。')}`,
                    `${abrasive?t('你問我？'):t('好問題。')}${pessimist?t('反正不管怎樣結果都差不多。'):optimist?t('我覺得往好的方面想就對了！'):t('這要看怎麼看吧。')}`,
                    `${charismatic?t('哦？你想聽我的看法？'):t('嗯...')}${pickRandom([t('我個人是覺得還好啦。'),t('說真的，我也沒什麼特別的想法。'),t('這個嘛...要我說的話...算了，我也不太確定。')])}`,
                ]);
                affChange = randInt(0,3);
                summary = `${player.name}${t('詢問了')}${npc.name}${t('的看法。')}`;
            } else if (isQuestion && isAboutKnowledge) {
                // Asking if NPC knows something
                npcReply = pickRandom([
                    `${shy?t('呃...'):t('嗯，')}${pickRandom([t('我不太確定耶...'),t('這個我沒聽過。'),t('好像有聽說過，但記不太清了。')])}`,
                    `${gossip?t('欸你這麼一說我好像有印象...不過我也不確定是不是真的。'):t('這個嘛...我真的不知道欸。')}`,
                    `${abrasive?t('你覺得我什麼都知道嗎？'):t('哈，')}${t('你可以去問問鎮上其他人，搞不好他們知道。')}`,
                    `${charismatic?t('有趣的問題！'):t('嗯...')}${pickRandom([t('讓我想想...不，我真的不知道。'),t('我也想知道呢。'),t('你去圖書館查查看？')])}`,
                ]);
                affChange = randInt(0,2);
                summary = `${player.name}${t('問了')}${npc.name}${t('一些事。')}`;
            } else if (isQuestion) {
                // Generic question
                npcReply = pickRandom([
                    `${shy?t('嗯...這個嘛...'):t('')}${pickRandom([t('我想想喔...'),t('好問題...'),t('你突然這樣問我...')])}${pickRandom([t('我也不太確定。'),t('可能吧？'),t('要看情況。'),t('我沒想過這個問題欸。')])}`,
                    `${abrasive?t('這種事你自己不知道嗎？'):charismatic?t('哈哈，你真的很好奇欸！'):t('嗯...')}${pickRandom([t('說實話我不太清楚。'),t('我回去想想再告訴你。'),t('你為什麼會想問這個？')])}`,
                    `${optimist?t('嗯，我覺得答案應該是正面的！'):pessimist?t('我不確定，但大概不會太好吧...'):t('我沒有什麼特別的想法欸。')}`,
                ]);
                affChange = randInt(0,2);
                summary = `${player.name}${t('問了')}${npc.name}${t('一個問題。')}`;
            } else {
                // Statement / generic chat — respond based on relationship
                if (isCouple) npcReply = pickRandom([`${t('嗯嗯，我在聽。你繼續說。')}`,`${t('你說的我都聽進去了。')}`,`${t('是嗎？跟我說更多。')}`]);
                else if (aff > 50) npcReply = pickRandom([`${t('嗯嗯！然後呢？')}`,`${t('哈哈，你說的我懂。')}`,`${t('是嗎？有意思！跟我說更多。')}`,`${t('我也有同感！')}`]);
                else if (aff > 20) npcReply = pickRandom([`${t('嗯，你說的有道理。')}`,`${t('原來如此，我沒想過這件事。')}`,`${t('哈，你還挺有想法的嘛。')}`,`${t('是喔？有趣。')}`]);
                else if (aff > -10) npcReply = pickRandom([`${t('嗯...是嗎。')}`,`${t('哦，我知道了。')}`,`${t('你這人還挺愛聊的。')}`,shy?t('嗯嗯...'):abrasive?t('所以呢？'):t('好吧。')]);
                else npcReply = pickRandom([`...${t('隨便你怎麼說吧。')}`,`${t('嗯哼。')}`,`${t('我不太感興趣。')}`,`${t('你說完了嗎？')}`]);
                affChange = aff > 0 ? randInt(0,2) : randInt(-1,1);
            }
            summary = summary || `${player.name}${t('和')}${npc.name}${t('聊了天。')}`;
        }

        // Add context-sensitive follow-up based on NPC state (natural phrasing)
        if (npc.needs.hunger < 20 && Math.random() < 0.3) npcReply += pickRandom([t(' ...（肚子咕嚕叫）啊，不好意思。'),t(' 話說酒館現在有什麼吃的嗎？我都沒吃午飯。'),t(' 哎，跟你聊著聊著都忘了吃飯了。')]);
        if (npc.needs.rest < 20 && Math.random() < 0.3) npcReply += pickRandom([t(' （打了個哈欠）抱歉...昨晚沒睡好。'),t(' 唉，今天腰都快斷了，幹了一整天活。'),t(' 不好意思，我眼皮有點撐不住了...')]);
        if (isNight && !tr.includes('night_owl') && Math.random() < 0.2) npcReply += pickRandom([t(' 好了，夜深了，明天再聊吧。'),t(' 啊，都這個時間了？我得回去了。')]);
        if (npc.activity === 'stargazing' && Math.random() < 0.3) npcReply += pickRandom([t(' 欸你看！那邊那顆星特別亮！'),t(' 今晚的星空真美，你不覺得嗎？')]);

        relNpc.modifyAffinity(affChange); relNpc.modifyRomantic(romChange); relNpc.recordInteraction(world.tickCount, summary);
        relPlayer.modifyAffinity(Math.max(-3,affChange-1)); relPlayer.recordInteraction(world.tickCount, summary);
        npc.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${player.name}${t('說：「')}${playerMessage.slice(0,30)}${t('」— ')}${summary}`, 4+Math.abs(affChange), [player.name]);
        player.memory.add(world.tickCount, world.clock.timeStr, 'conversation', `${t('與')}${npc.name}${t('：')}${summary}`, 3+Math.abs(affChange), [npc.name]);
        // Only push NPC reply (player message already added by playerSendMessage)
        // 去重不比對時間戳:AI 回覆期間遊戲時間會前進,舊檢查因時間不同而重複寫入玩家訊息(重複留言 bug)
        if (!player.chatHistory.slice(-6).some(m => m.speaker === player.name && m.target === npc.name && m.text === playerMessage)) {
            player.chatHistory.push({speaker:player.name, target:npc.name, text:playerMessage, time:world.clock.timeStr});
        }
        player.chatHistory.push({speaker:npc.name, target:player.name, text:npcReply, time:world.clock.timeStr});
        player._recentChatTick = world.tickCount; // Mark for social need recovery
        world.logMessage('player_chat', summary, player.name, npc.name);
        world.checkHeartEvents?.(); // v5.0.0 聊天後檢查心動事件
        return { npc_name:npc.name, npc_reply:npcReply, player_message:playerMessage, effects:{affinity_change:affChange,romantic_change:romChange}, summary };
    }
}

// --- LLM Client ---
// v5.73.0 AI 對話語言:玩家在設定裡選「跟隨介面/繁體中文/English」,決定 AI 生成台詞、行程、反思、日報用的語言。
// 介面語言與對話語言分開;提示詞本身維持中文,只切換語言規則、系統指示與人名(送出前中→英,回來後英→中,存檔仍是中文名)。
const LLM_LANG = {
    get() {
        let v = null; try { v = localStorage.getItem('rimtown_dialogue_lang'); } catch (e) {}
        if (v === 'zh' || v === 'en') return v;
        return (typeof I18N !== 'undefined' && I18N.getLang() === 'en') ? 'en' : 'zh';
    },
    isEn() { return this.get() === 'en'; },
    rule(zh, en) { return this.get() === 'en' ? en : zh; },
};
if (typeof window !== 'undefined') window.LLM_LANG = LLM_LANG;

class LLMClient {
    constructor(provider, apiKey, model) {
        this.provider = provider; this.apiKey = apiKey; this.model = model;
        // Rate limiting
        this._requestTimestamps = [];
        this._maxRequestsPerMinute = 20;
        this._rateLimitedUntil = 0;
        // Fallback
        this.fallbackGroqKey = null;
        this._fallbackActive = false;
        this._primaryFailCount = 0;
        this._primaryCooldownUntil = 0;
    }

    setFallbackGroqKey(key) { this.fallbackGroqKey = key; }
    // v5.73.0 daily-news.js 用的 chat([{role,content}], {max_tokens}) 介面:合併成單一提示詞走 generate()
    async chat(messages, opts = {}) {
        const prompt = (messages || []).map(m => m && m.content ? String(m.content) : '').filter(Boolean).join('\n\n');
        const r = await this.generate(prompt, opts.max_tokens || 500, opts.temperature ?? 0.9, false);
        if (!r || r === '__ERROR__' || r === '__RATE_LIMITED__') return null;
        return r;
    }

    /**
     * Test if the API key is valid by making a minimal request.
     * Returns { ok: true/false, error: string|null }
     */
    async testConnection(provider, apiKey) {
        provider = provider || this.provider;
        apiKey = apiKey || this.apiKey;
        if (!provider || provider === 'none' || !apiKey) {
            return { ok: false, error: 'No provider or API key' };
        }
        try {
            this._lastError = '';
            const result = await this._callProvider(provider, apiKey, null, 'Say "ok"', 5, 0);
            if (result === '__RATE_LIMITED__') return { ok: true, error: null }; // rate limited means key is valid
            if (result === '__ERROR__') return { ok: false, error: this._lastError || 'API returned error — check your key' };
            return { ok: true, error: null };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    _canMakeRequest(isPlayerChat = false) {
        const now = Date.now();
        if (now < this._rateLimitedUntil) {
            if (!isPlayerChat || now < this._rateLimitedUntil - 30000) return false;
        }
        this._requestTimestamps = this._requestTimestamps.filter(t => now - t < 60000);
        const limit = isPlayerChat ? this._maxRequestsPerMinute : Math.floor(this._maxRequestsPerMinute / 2);
        return this._requestTimestamps.length < limit;
    }

    _recordRequest() { this._requestTimestamps.push(Date.now()); }

    _handleRateLimit() {
        this._rateLimitedUntil = Date.now() + 60000;
        console.warn('[RimTown LLM] 429 received — pausing all requests for 60 seconds');
    }

    async generate(prompt, maxTokens = 500, temperature = 0.9, isPlayerChat = false) {
        // v5.39.0 智慧分流:有 Groq 金鑰且主供應商不是 Groq 時,「玩家對話/劇情」優先吃 Groq 免費額度,
        // 把主供應商(gpt-4o-mini 等付費金鑰)留給行程/反思/背景對話;Groq 被限流就退回主供應商,5 分鐘後再試
        if (isPlayerChat && this.fallbackGroqKey && this.provider !== 'groq'
            && Date.now() >= (this._groqLaneCooldownUntil || 0)) {
            this._recordRequest();
            const viaGroq = await this._callProvider('groq', this.fallbackGroqKey, null, prompt, maxTokens, temperature);
            if (viaGroq && viaGroq !== '__RATE_LIMITED__' && viaGroq !== '__ERROR__') {
                return this._stripThinkTags(viaGroq);
            }
            this._groqLaneCooldownUntil = Date.now() + 300000;
            console.log('[RimTown LLM] chat-lane Groq unavailable — falling back to', this.provider);
        }
        // If primary is in cooldown and fallback available, go straight to fallback
        if (this._primaryCooldownUntil > Date.now() && this.fallbackGroqKey && this.provider !== 'groq') {
            console.log('[RimTown LLM] Primary in cooldown — using Groq fallback');
            return this._generateWithGroqFallback(prompt, maxTokens, temperature);
        }

        if (!this._canMakeRequest(isPlayerChat)) {
            // Rate limited locally — try fallback instead of returning empty
            if (this.fallbackGroqKey && this.provider !== 'groq') {
                console.log('[RimTown LLM] Local rate limit — using Groq fallback');
                return this._generateWithGroqFallback(prompt, maxTokens, temperature);
            }
            const waitSec = Math.max(0, Math.ceil((this._rateLimitedUntil - Date.now()) / 1000));
            console.log(`[RimTown LLM] Rate limited — skipping (isPlayerChat: ${isPlayerChat}, cooldown: ${waitSec}s)`);
            return '';
        }
        this._recordRequest();

        console.log('[RimTown LLM] generate called | provider:', this.provider, '| model:', this.model, '| maxTokens:', maxTokens, '| priority:', isPlayerChat ? 'PLAYER' : 'npc');
        const result = await this._callProvider(this.provider, this.apiKey, this.model, prompt, maxTokens, temperature, isPlayerChat ? 'chat' : 'background');

        // If primary failed and we have fallback, try Groq
        if (result === '__RATE_LIMITED__' || result === '__ERROR__') {
            this._handleRateLimit();
            if (this.fallbackGroqKey && this.provider !== 'groq') {
                console.log(`[RimTown LLM] Primary ${this.provider} failed (${result}) — switching to Groq fallback`);
                this._primaryFailCount++;
                const cooldownMs = Math.min(60000 * this._primaryFailCount, 300000);
                this._primaryCooldownUntil = Date.now() + cooldownMs;
                console.log(`[RimTown LLM] Primary cooldown: ${cooldownMs/1000}s (fail #${this._primaryFailCount})`);
                return this._generateWithGroqFallback(prompt, maxTokens, temperature);
            }
            return '';
        }

        // Primary succeeded — reset fail count
        if (result && this._primaryFailCount > 0) {
            this._primaryFailCount = 0;
            this._primaryCooldownUntil = 0;
            if (this._fallbackActive) {
                this._fallbackActive = false;
                console.log('[RimTown LLM] Primary recovered — back to', this.provider);
            }
        }
        return this._stripThinkTags(result);
    }

    _stripThinkTags(text) {
        if (!text) return text;
        // Remove paired <think>...</think> blocks
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
        // Remove unclosed <think> tag (model didn't close it or got cut off)
        text = text.replace(/<think>[\s\S]*/gi, '');
        return text.trim();
    }

    async _generateWithGroqFallback(prompt, maxTokens, temperature) {
        this._fallbackActive = true;
        const result = await this._callProvider('groq', this.fallbackGroqKey, null, prompt, maxTokens, temperature);
        if (result === '__RATE_LIMITED__' || result === '__ERROR__') return '';
        return this._stripThinkTags(result);
    }

    // v5.33.3 Groq 模型動態解析:Groq 汰換模型頻繁,寫死模型名遲早 404
    // 直接查這把 key 當下可用的模型清單,依偏好挑一個;結果快取到 localStorage
    async _resolveGroqModel(apiKey, force = false) {
        if (!force && this._groqModelCache) return this._groqModelCache;
        if (!force) {
            try { const c = localStorage.getItem('rimtown_groq_model'); if (c) return (this._groqModelCache = c); } catch (e) {}
        }
        try {
            const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': 'Bearer ' + apiKey } });
            if (res.ok) {
                const data = await res.json();
                const ids = (data.data || []).map(m => m.id);
                const prefer = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b'];
                let pick = prefer.find(p => ids.includes(p));
                if (!pick) pick = ids.find(id => !/whisper|tts|guard|embed|vision|scout|maverick/i.test(id));
                if (pick) {
                    this._groqModelCache = pick;
                    try { localStorage.setItem('rimtown_groq_model', pick); } catch (e) {}
                    console.log('[RimTown LLM] Groq model resolved:', pick);
                    return pick;
                }
            }
        } catch (e) { console.warn('[RimTown LLM] Groq model list failed:', e.message); }
        return this._groqModelCache || 'llama-3.3-70b-versatile';
    }

    async _callProvider(provider, apiKey, model, prompt, maxTokens, temperature, lane = 'background') {
        const endpoints = {
            anthropic: { url: 'https://api.anthropic.com/v1/messages', model: model || 'claude-haiku-4-5-20251001' },
            // v5.29.1 OpenAI 鎖定 gpt-4o-mini(成本控制):忽略任何 model 覆寫,避免誤用到高價模型
            openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
            gemini: { url: `https://generativelanguage.googleapis.com/v1beta/models/${model||'gemini-2.5-flash'}:generateContent` },
            deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: model || 'deepseek-chat' },
            // v5.33.2 Groq 預設改用正式版模型(qwen3-32b 為 preview 已下架,舊預設會 404)
            groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: model || 'llama-3.3-70b-versatile' },
            together: { url: 'https://api.together.xyz/v1/chat/completions', model: model || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo' },
            minimax: { url: 'https://api.minimaxi.com/v1/text/chatcompletion_v2', model: model || 'MiniMax-M2.5' },
        };
        // 小鎮伺服器 AI(免金鑰):走同網域 /api/chat,金鑰保管在伺服器
        if (provider === 'server') {
            try {
                const headers = { 'Content-Type': 'application/json' };
                try {
                    const jwt = localStorage.getItem('rimtown_jwt');
                    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
                } catch (e) {}
                // v5.73.0 對話語言:英文模式把提示詞裡的中文人名換成英文名再送,伺服器改用英文系統指示並跳過簡轉繁
                const lang = (typeof LLM_LANG !== 'undefined') ? LLM_LANG.get() : 'zh';
                const sendPrompt = (lang === 'en' && typeof I18N !== 'undefined') ? I18N.localizeNames(prompt, true) : prompt;
                const res = await fetch('/api/chat', {
                    method: 'POST', headers,
                    // v5.66.0 lane 交給伺服器分流:chat=玩家對話/劇情 → Groq 優先;background=行程/反思 → 付費中繼
                    body: JSON.stringify({ prompt: sendPrompt, max_tokens: maxTokens, temperature, lane, lang }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                // v5.67.4 雙保險:伺服器已擋,萬一漏網也不讓「我是 AI 助理」進到台詞
                if (World.looksLikeAssistantLeak(data.reply)) { console.warn('[RimTown LLM] assistant leak blocked'); return '__ERROR__'; }
                // v5.67.5 雙保險:伺服器已轉繁體,萬一漏網前端再轉一次
                let reply = data.reply || '';
                if (lang === 'en') {
                    // v5.73.0 英文回覆:英文名換回中文名,讓行程/對話解析與存檔仍用中文名(顯示層再換成英文)
                    if (typeof I18N !== 'undefined') reply = I18N.delocalizeNames(reply);
                } else if (typeof RIMTOWN_S2T !== 'undefined' && RIMTOWN_S2T.looksSimplified(reply)) reply = RIMTOWN_S2T.convert(reply);
                return reply;
            } catch (err) {
                console.warn('[RimTown LLM] server provider error:', err.message);
                return '__ERROR__';
            }
        }

        const cfg = endpoints[provider];
        if (!cfg) return '__ERROR__';
        // v5.33.3 Groq 未指定模型時動態解析(可用清單快取)
        if (provider === 'groq' && !model) cfg.model = await this._resolveGroqModel(apiKey);

        try {
            if (provider === 'anthropic') {
                const res = await fetch(cfg.url, {
                    method:'POST',
                    headers:{ 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
                    body: JSON.stringify({ model:cfg.model, max_tokens:maxTokens, temperature, messages:[{role:'user',content:prompt}] }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                console.log('[RimTown LLM] Anthropic response:', res.status, data.content ? 'OK' : 'EMPTY', data.error?.message || '');
                return data.content?.[0]?.text || '';
            } else if (provider === 'gemini') {
                const res = await fetch(cfg.url, {
                    method:'POST', headers:{'Content-Type':'application/json', 'x-goog-api-key':apiKey},
                    body: JSON.stringify({
                        contents:[{parts:[{text:prompt}]}],
                        generationConfig:{maxOutputTokens:maxTokens, temperature},
                    }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                console.log('[RimTown LLM] Gemini response:', res.status, data.candidates ? 'OK' : 'EMPTY', data.error?.message || '');
                const parts = data.candidates?.[0]?.content?.parts || [];
                const textPart = parts.filter(p => !p.thought).map(p => p.text).join('');
                return textPart || parts[0]?.text || '';
            } else if (provider === 'minimax') {
                const res = await fetch(cfg.url, {
                    method:'POST',
                    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
                    body: JSON.stringify({ model:cfg.model, max_completion_tokens:maxTokens, temperature, messages:[{role:'user',content:prompt}] }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                if (!res.ok) return '__ERROR__';
                const data = await res.json();
                if (data.base_resp && data.base_resp.status_code !== 0) {
                    console.error('[RimTown LLM] MiniMax API error:', data.base_resp.status_code, data.base_resp.status_msg);
                    return '__ERROR__';
                }
                const content = data.choices?.[0]?.message?.content || '';
                console.log('[RimTown LLM] MiniMax response:', res.status, '| content length:', content.length);
                return content;
            } else {
                // OpenAI-compatible (openai, deepseek, groq, together)
                const res = await fetch(cfg.url, {
                    method:'POST',
                    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
                    body: JSON.stringify({ model:cfg.model, max_tokens:maxTokens, temperature, messages:[{role:'user',content:prompt}] }),
                });
                if (res.status === 429) return '__RATE_LIMITED__';
                // v5.33.2 記錄真實錯誤(HTTP 狀態 + API 訊息),測試連線時能顯示原因而非籠統「檢查金鑰」
                if (!res.ok) {
                    try { const eb = await res.json(); this._lastError = `HTTP ${res.status}${eb?.error?.message ? ': ' + eb.error.message : ''}`; }
                    catch (e2) { this._lastError = 'HTTP ' + res.status; }
                    console.error('[RimTown LLM]', provider, this._lastError);
                    // v5.33.3 Groq 快取的模型被下架 → 清快取強制重查清單,換一個模型重試一次
                    if (provider === 'groq' && res.status === 404 && !model) {
                        this._groqModelCache = null;
                        try { localStorage.removeItem('rimtown_groq_model'); } catch (e3) {}
                        const fresh = await this._resolveGroqModel(apiKey, true);
                        if (fresh && fresh !== cfg.model) return this._callProvider('groq', apiKey, fresh, prompt, maxTokens, temperature);
                    }
                    return '__ERROR__';
                }
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content || '';
                console.log('[RimTown LLM] Response:', res.status, '| content length:', content.length, '| error:', data.error?.message || 'none');
                if (data.error) { console.error('[RimTown LLM] API error:', data.error); return '__ERROR__'; }
                return content;
            }
        } catch (err) {
            console.error('[RimTown LLM] Network/fetch error:', err.message);
            return '__ERROR__';
        }
    }
}
