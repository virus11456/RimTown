// RimTown - app-chat.js：從 app.js 拆出的 玩家聊天：送訊息、對話泡泡、聯絡人、小鎮動態、謠言、聊天封存、意圖與擲骰、自訂村民表單（前半）（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    async playerSendMessage(targetId, message, intent, outcome) {
        if (this.chatSending || !message.trim()) return;
        this.chatSending = true;
        const player = this.world.agents['player'];
        const npc = this.world.agents[targetId];
        if (!player || !npc) { this.chatSending = false; return; }
        // No proximity restriction — can message any NPC from anywhere

        // Add player message to history immediately so it renders before typing indicator
        const trimmedMsg = message.trim();
        const timeStr = this.world.clock?.timeStr || '';
        player.chatHistory.push({speaker:player.name, target:npc.name, text:trimmedMsg, time:timeStr});

        // Render player message immediately, then show typing indicator
        this.state = this.world.getState();
        if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }

        // Show typing indicator
        this._showTypingIndicator(npc.name);

        try {
            // Add a natural delay (1.5-3s) so NPC doesn't reply instantly
            const typingDelay = 1500 + Math.random() * 1500;
            const [reply] = await Promise.all([
                this.world.conversationEngine.generatePlayerReply(player, npc, trimmedMsg, this.world),
                new Promise(r => setTimeout(r, typingDelay))
            ]);
            if (this.world.questSystem) this.world.questSystem.onChat(targetId); // v5.83.0 記下對象
            try { this.world.requests?.onChat(targetId, this.world); this._updateRequestBadge(); } catch (e) {} // v5.91.0 委託:陪伴/調解
            // Clear unread for this NPC
            if (this._chatUnread) this._chatUnread.delete(targetId);
            // v5.16.0 意圖的額外機械後果(獨立於 LLM,永遠可見)
            const intentLines = intent ? this._applyChatIntent(npc, player, intent, outcome) : [];
            this.state = this.world.getState();
            this._hideTypingIndicator();
            if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }
            // v5.16.0 對話可見機械後果:聊完跳一張小結果卡
            this._showChatEffect(npc, reply, intentLines);
        } catch(e) {
            console.error('Chat error:', e);
            this._hideTypingIndicator();
        }
        this.chatSending = false;
    },

    // Update only chat messages area without full sidebar re-render (prevents flickering)
    _renderChatMessages() {
        const msgEl = document.getElementById('chat-messages');
        if (!msgEl || !this.chatTarget) return;
        const player = this.state?.agents?.['player'];
        if (!player) return;
        const chatHistory = player.chat_history || [];
        const targetAgent = this.state.agents[this.chatTarget];
        const targetName = targetAgent?.name || this.chatTarget;
        const filtered = chatHistory.filter(c => c.target === targetName || c.speaker === targetName);
        let html = '';
        if (!filtered.length) {
            html = `<p class="muted-text chat-hint">${t('開始與')}${targetName}${t('對話吧！')}</p>`;
        }
        filtered.forEach(msg => {
            const isP = msg.speaker === player.name;
            html += `<div class="chat-bubble ${isP ? 'chat-player' : 'chat-npc'}">
                <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                <div class="chat-time">${msg.time || ''}</div></div>`;
        });
        msgEl.innerHTML = html;
    },

    // Lightweight in-place update for chat contacts during simulation ticks (prevents flickering)
    _updateChatContactsInPlace() {
        const contactBtns = document.querySelectorAll('.chat-contact');
        if (!contactBtns.length) return;
        const player = this.state?.agents?.['player'];
        if (!player) return;
        const chatHistory = player.chat_history || [];

        contactBtns.forEach(btn => {
            const npcId = btn.getAttribute('data-val');
            const agent = this.state.agents[npcId];
            if (!agent) return;

            // Update mood indicator
            const moodEl = btn.querySelector('.mood-indicator');
            if (moodEl) {
                moodEl.className = `mood-indicator mood-${agent.mood_description}`;
            }

            // Update thought text
            const thoughtEl = btn.querySelector('.chat-contact-thought');
            const thought = agent.current_thought || '';
            const thoughtText = thought ? this._escapeHtml(thought.length > 18 ? thought.slice(0, 18) + '...' : thought) : '';
            if (thoughtEl) {
                if (thoughtText) {
                    thoughtEl.innerHTML = thoughtText;
                } else {
                    thoughtEl.remove();
                }
            } else if (thoughtText) {
                const infoEl = btn.querySelector('.chat-contact-info');
                if (infoEl) {
                    const previewEl = infoEl.querySelector('.chat-contact-preview');
                    const newThought = document.createElement('div');
                    newThought.className = 'chat-contact-thought';
                    newThought.innerHTML = thoughtText;
                    if (previewEl) infoEl.insertBefore(newThought, previewEl);
                    else infoEl.appendChild(newThought);
                }
            }

            // Update unread dot
            const nameEl = btn.querySelector('.chat-contact-name');
            const hasUnread = this._chatUnread?.has(npcId);
            const dotEl = nameEl?.querySelector('.chat-unread-dot');
            if (hasUnread && !dotEl && nameEl) {
                nameEl.insertAdjacentHTML('beforeend', '<span class="chat-unread-dot"></span>');
            } else if (!hasUnread && dotEl) {
                dotEl.remove();
            }

            // Update last message preview
            const msgs = chatHistory.filter(c => c.speaker === agent.name || c.target === agent.name);
            const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
            const previewEl = btn.querySelector('.chat-contact-preview');
            if (previewEl && lastMsg) {
                const lastText = lastMsg.speaker === player.name ? `${t('你')}：${lastMsg.text}` : lastMsg.text;
                const truncated = lastText.length > 20 ? lastText.slice(0, 20) + '...' : lastText;
                previewEl.textContent = truncated;
            }

            // Update time
            const timeEl = btn.querySelector('.chat-contact-time');
            if (timeEl && lastMsg?.time) {
                timeEl.textContent = lastMsg.time;
            }
        });

        // Also update chat header info if chatting
        if (this.chatTarget) {
            const targetAgent = this.state.agents[this.chatTarget];
            if (targetAgent) {
                const detailEl = document.querySelector('.chat-conv-detail');
                if (detailEl) {
                    const job = targetAgent.job?.title || '';
                    const loc = targetAgent.current_location ? ' · ' + this._locationLabel(targetAgent.current_location) : '';
                    detailEl.textContent = job + loc;
                }
            }
        }
    },

    _showTypingIndicator(name) {
        this._typingName = name;
        const msgEl = document.getElementById('chat-messages');
        if (!msgEl) return;
        const existing = msgEl.querySelector('.chat-typing');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = 'chat-typing';
        div.innerHTML = '<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>';
        msgEl.appendChild(div);
        msgEl.scrollTop = msgEl.scrollHeight;
    },

    _hideTypingIndicator() {
        this._typingName = null;
        const msgEl = document.getElementById('chat-messages');
        if (!msgEl) return;
        const existing = msgEl.querySelector('.chat-typing');
        if (existing) existing.remove();
    },

    startChatWith(agentId) {
        this.chatTarget = agentId;
        this.selectedAgent = agentId;
        this.activeTab = 'chat';
        this._focusChatInput = true;
        // Clear unread for this NPC
        if (this._chatUnread) this._chatUnread.delete(agentId);
        if (this._updateTabHighlight) this._updateTabHighlight('chat');
        // Auto-open sidebar on mobile
        const sidebar = document.getElementById('rimtown-sidebar');
        if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('mobile-collapsed');
        this.renderSidebar();
        this.render();
    },
    renderChat(container) {
        const player = this.state?.agents?.['player'];
        if (!player) { container.innerHTML = '<p class="muted-text">Player not found.</p>'; return; }
        // v5.2.0 私訊 / 鎮民動態 切換
        const feedUnread = this.world?._feedUnread || 0;
        const isFeed = this._chatView === 'feed';
        const toggleHtml = `<div style="display:flex;gap:6px;margin-bottom:8px">
            <button class="trade-btn" data-action="chat-view" data-val="dm" style="flex:1;${!isFeed ? 'background:var(--accent);color:#fff;' : ''}padding:7px">💬 ${t('私訊')}</button>
            <button class="trade-btn" data-action="chat-view" data-val="feed" style="flex:1;${isFeed ? 'background:var(--accent);color:#fff;' : ''}padding:7px">📱 ${t('鎮民動態')}${feedUnread && !isFeed ? ` <span style="background:#e33;border-radius:8px;padding:0 6px;font-size:0.68rem">${feedUnread}</span>` : ''}</button>
        </div>`;
        if (isFeed) { this.renderTownFeed(container, toggleHtml); return; }
        const chatHistory = player.chat_history || [];
        if (!this._chatUnread) this._chatUnread = new Set();

        // Job color map for avatars
        const JOB_AVATAR_COLORS = {
            mayor:'#c83040', doctor:'#e8e8f0', blacksmith:'#607080', cook:'#e88030',
            farmer:'#6a9a40', trader:'#8030a0', guard:'#3a5060', researcher:'#2868b8',
            miner:'#6a5040', priest:'#f0e070', carpenter:'#907060', tailor:'#d06080', default:'#8090a0'
        };

        // Build all NPC list with last message info
        const allNpcs = Object.entries(this.state.agents)
            .filter(([id]) => id !== 'player')
            .map(([id, a]) => {
                const msgs = chatHistory.filter(c => c.speaker === a.name || c.target === a.name);
                const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
                const jobKey = a.job?.key || 'default';
                const avatarColor = JOB_AVATAR_COLORS[jobKey] || JOB_AVATAR_COLORS.default;
                return { id, name: a.name, job: a.job?.title || '', jobKey, avatarColor, gender: a.gender || 'male', mood: a.mood_description, location: a.current_location, currentThought: a.current_thought || '', lastMsg, msgCount: msgs.length, hasUnread: this._chatUnread.has(id) };
            });

        // Sort: unread first, then by last message time (most recent first), then no-history alphabetically
        allNpcs.sort((a, b) => {
            if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
            if (a.lastMsg && b.lastMsg) return 0; // keep original order for both having messages
            if (a.lastMsg) return -1;
            if (b.lastMsg) return 1;
            return a.name.localeCompare(b.name);
        });

        // --- Contact list (v5.49.3 永遠渲染:窄版對話模式用 CSS 隱藏,桌面雙欄時顯示為左欄) ---
        let contactsHtml = '<div class="chat-contacts">';
        contactsHtml += `<div class="chat-contacts-header">${t('聯絡人')}<span class="chat-contacts-count">${allNpcs.length}</span></div>`;
        contactsHtml += '<div class="chat-contacts-list chat-contacts-full">';
        allNpcs.forEach(npc => {
            const isActive = this.chatTarget === npc.id;
            const lastText = npc.lastMsg ? (npc.lastMsg.speaker === player.name ? `${t('你')}：${npc.lastMsg.text}` : npc.lastMsg.text) : t('尚未對話');
            const truncated = lastText.length > 20 ? lastText.slice(0, 20) + '...' : lastText;
            let avatarDataUrl = null;
            try { if (this.tileMap?.renderAvatarDataURL) avatarDataUrl = this.tileMap.renderAvatarDataURL(npc.jobKey, npc.gender, npc.name, this.world?.agents?.[npc.id]?.look || null); } catch(e) {}
            const thoughtText = npc.currentThought ? this._escapeHtml(npc.currentThought.length > 18 ? npc.currentThought.slice(0, 18) + '...' : npc.currentThought) : '';
            contactsHtml += `<button class="chat-contact ${isActive ? 'active' : ''}" data-action="start-chat" data-val="${npc.id}">
                <div class="chat-contact-avatar chat-contact-avatar-pixel" style="background:${npc.avatarColor}">${avatarDataUrl ? `<img src="${avatarDataUrl}" class="avatar-pixel-art" alt="${t(npc.name)}">` : `<span class="avatar-initial" style="color:#fff;font-weight:bold;font-size:1rem;text-shadow:0 1px 2px rgba(0,0,0,0.4)">${npc.name.charAt(0)}</span>`}<span class="mood-indicator mood-${npc.mood}"></span></div>
                <div class="chat-contact-info">
                    <div class="chat-contact-name">${t(npc.name)}${npc.hasUnread ? '<span class="chat-unread-dot"></span>' : ''}</div>
                    <div class="chat-contact-job">${npc.job || t('無業')}</div>
                    ${thoughtText ? `<div class="chat-contact-thought">${thoughtText}</div>` : ''}
                    <div class="chat-contact-preview">${this._escapeHtml(truncated)}</div>
                </div>
                ${npc.lastMsg?.time ? `<div class="chat-contact-time">${npc.lastMsg.time}</div>` : ''}
            </button>`;
        });
        contactsHtml += '</div></div>';

        // --- Chat area ---
        let chatAreaHtml = '';
        if (this.chatTarget) {
            const targetAgent = this.state.agents[this.chatTarget];
            const targetName = targetAgent?.name || this.chatTarget;
            const targetJob = targetAgent?.job?.title || '';
            const targetLoc = targetAgent?.current_location || '';

            // Chat header with NPC info(v5.49.2 左側返回鍵回聯絡人清單)
            chatAreaHtml += `<div class="chat-conv-header" style="display:flex;align-items:center;gap:10px">
                <button data-action="close-chat" title="${t('返回聯絡人')}" style="background:rgba(255,255,255,0.08);border:1px solid var(--border);border-radius:8px;color:var(--text-secondary);width:32px;height:32px;line-height:1;cursor:pointer;font-size:1.1rem;flex-shrink:0">‹</button>
                <div style="min-width:0">
                    <div class="chat-conv-name">${targetName}</div>
                    <div class="chat-conv-detail">${targetJob}${targetLoc ? ' · ' + this._locationLabel(targetLoc) : ''}</div>
                </div>
            </div>`;

            // Messages
            chatAreaHtml += '<div class="chat-messages" id="chat-messages">';
            const filtered = chatHistory.filter(c => c.target === targetName || c.speaker === targetName);
            if (!filtered.length) {
                chatAreaHtml += `<p class="muted-text chat-hint">${t('開始與')}${targetName}${t('對話吧！')}</p>`;
            }
            filtered.forEach(msg => {
                const isP = msg.speaker === player.name;
                chatAreaHtml += `<div class="chat-bubble ${isP ? 'chat-player' : 'chat-npc'}">
                    <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                    <div class="chat-time">${msg.time || ''}</div></div>`;
            });
            chatAreaHtml += '</div>';

            // v5.16.0 意圖化交談鈕:讓玩家一眼看懂「這場對話我能做什麼」(自由輸入照樣保留)
            const oddsNpc = this.world?.agents?.[this.chatTarget]; // v5.95.0 按鈕上顯示成功率
            const intentBar = this._chatIntents().map(it => {
                const o = (it.key !== 'whisper' && oddsNpc && this.world?.chatOdds) ? this.world.chatOdds(oddsNpc, it.key) : null;
                const pct = o ? Math.round(o.p * 100) : null;
                const ttl = o ? `${it.hint} · ${t('成功率')} ${pct}%${o.factors.length ? '（' + o.factors.map(f => `${f.label}${f.v > 0 ? '+' : ''}${Math.round(f.v * 100)}`).join('、') + '）' : ''}` : it.hint;
                return `<button class="chat-intent-btn" data-action="chat-intent" data-val="${it.key}" title="${this._escapeHtml(ttl)}" ${this.chatSending ? 'disabled' : ''}>${it.icon} ${it.label}${pct !== null ? ` <span style="opacity:0.65;font-size:0.85em">${pct}%</span>` : ''}</button>`;
            }).join('');
            chatAreaHtml += `<div class="chat-intent-bar">${intentBar}</div>`;
            // Input — always available
            chatAreaHtml += `<div class="chat-input-area">
                <input type="text" id="chat-input" class="chat-input" placeholder="${t('輸入訊息')}..." ${this.chatSending ? 'disabled' : ''}>
                <button class="chat-gift-btn" data-action="open-gift" title="${t('送禮')}" style="padding:0 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;font-size:1rem">🎁</button>
                <button class="chat-gift-btn" data-action="open-rumor" title="${t('爆料八卦')}" style="padding:0 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;font-size:1rem">🗣️</button>
                <button class="chat-send-btn" data-action="send-chat" ${this.chatSending ? 'disabled' : ''}>${this.chatSending ? '...' : t('送出')}</button></div>`;
        }
        // v5.49.2 未選人時不再渲染空白對話區佔位,清單直接撐滿

        // Archive bar
        chatAreaHtml += `<div class="chat-archive-bar">
            <button class="btn-archive-view" data-action="show-archives">${t('歷史對話')}</button>
            <button class="btn-archive-save" data-action="manual-archive">${t('立即存檔')}</button>
        </div>`;

        container.innerHTML = toggleHtml + `<div class="chat-layout${this.chatTarget ? ' conv' : ''}">` + contactsHtml + '<div class="chat-pane">' + chatAreaHtml + '</div></div>';
        this._scrollChatToBottom();
        const input = document.getElementById('chat-input');
        if (input && !this.chatSending && this._focusChatInput) {
            input.focus();
            this._focusChatInput = false;
        }
    },

    // =====================================================
    // v5.2.0 鎮民動態(小鎮朋友圈)
    // =====================================================
    renderTownFeed(container, toggleHtml) {
        this.world._feedUnread = 0;
        const esc = (x) => this._escapeHtml(String(x ?? ''));
        const posts = this.world?.townFeed?.posts ? [...this.world.townFeed.posts].reverse().slice(0, 40) : [];
        const playerName = this.world?.agents?.['player']?.name || t('旅人');
        let html = toggleHtml || '';
        html += `<div style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:8px">${t('村民們的日常、心情和玻璃心文都在這裡。按讚留言可以刷好感!')}</div>`;
        if (!posts.length) html += `<p class="muted-text">${t('還沒有人發文。村民們每天都會更新動態!')}</p>`;
        for (const p of posts) {
            const liked = p.likes.includes(playerName);
            const cmts = (p.comments || []).map(c =>
                `<div style="font-size:0.75rem;margin:4px 0 0 10px;line-height:1.4"><b style="color:var(--accent)">${esc(c.speaker)}</b><span style="opacity:0.6">：</span>${esc(c.text)}</div>`).join('');
            html += `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <b style="font-size:0.85rem">${esc(p.authorName)}</b>
                    <span style="font-size:0.65rem;color:var(--text-secondary)">${esc(p.day || '')} ${esc(p.time || '')}</span>
                </div>
                <div style="margin:6px 0;font-size:0.85rem;line-height:1.55">${esc(p.text)}</div>
                <div style="display:flex;gap:10px">
                    <button data-action="feed-like" data-val="${p.id}" style="background:none;border:none;cursor:pointer;font-size:0.8rem;color:var(--text-secondary);padding:2px 4px">${liked ? '❤️' : '🤍'} ${p.likes.length}</button>
                    <button data-action="feed-comment" data-val="${p.id}" style="background:none;border:none;cursor:pointer;font-size:0.8rem;color:var(--text-secondary);padding:2px 4px">💬 ${(p.comments || []).length}</button>
                </div>
                ${cmts}
                ${this._feedCommentPost === p.id ? `<div style="display:flex;gap:6px;margin-top:8px">
                    <input id="feed-comment-input" maxlength="60" placeholder="${t('留言...')}" style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-panel);color:var(--text-primary);font-size:0.8rem">
                    <button class="trade-btn" data-action="feed-comment-send" data-val="${p.id}">${t('送出')}</button></div>` : ''}
            </div>`;
        }
        container.innerHTML = html;
        document.getElementById('feed-comment-input')?.focus();
    },

    _feedLike(postId) {
        const post = this.world?.townFeed?.posts.find(p => p.id === postId);
        const player = this.world?.agents?.['player'];
        if (!post || !player || post.likes.includes(player.name)) return;
        post.likes.push(player.name);
        const author = this.world.agents[post.authorId];
        if (author && !author.isPlayer) { author.relationships.getOrCreate('player', player.name).modifyAffinity(1); this.tileMap?.spawnFxOnAgent?.(post.authorId, '❤️', { color: '#ff6b9d', size: 10 }); }
        this.bgm?.sfx?.('click');
        this.renderSidebar();
    },

    _feedCommentSend(postId) {
        const input = document.getElementById('feed-comment-input');
        const text = (input?.value || '').trim();
        if (!text) return;
        const post = this.world?.townFeed?.posts.find(p => p.id === postId);
        const player = this.world?.agents?.['player'];
        if (!post || !player) return;
        post.comments = post.comments || [];
        post.comments.push({ speaker: player.name, text });
        this._feedCommentPost = null;
        const author = this.world.agents[post.authorId];
        if (author && !author.isPlayer) {
            const rel = author.relationships.getOrCreate('player', player.name);
            rel.modifyAffinity(2);
            author.memory.add(this.world.tickCount, this.world.clock.timeStr, 'social', `${t(player.name)}${t('在我的動態下留言:')}${text}`, 4, [player.name]);
            // 作者回覆留言
            setTimeout(() => {
                const aff = rel.affinity;
                const pool = aff > 40
                    ? [t('就知道你懂我 😆'), t('哈哈,改天一起!'), `${t('謝啦')}${t(player.name)}!❤️`]
                    : aff < -10 ? [t('喔,是你啊。'), t('嗯。')]
                    : [`${t('哈哈謝謝')}${playerTitle(this.world)}!`, `${playerTitle(this.world)}${t('也看到啦 😳')}`, t('感恩!')];
                post.comments.push({ speaker: author.name, text: pool[Math.floor(Math.random() * pool.length)] });
                if (this.activeTab === 'chat' && this._chatView === 'feed') this.renderSidebar();
            }, 900);
        }
        this.bgm?.sfx?.('send');
        this.renderSidebar();
    },

    // =====================================================
    // v5.2.0 玩家放話(爆料)
    // =====================================================
    _showRumorPicker() {
        const listener = this.world?.agents?.[this.chatTarget];
        if (!listener) return;
        const dayKey = `${this.world.clock.year}-${this.world.clock.season}-${this.world.clock.day}`;
        if (this.world._lastRumorDay === dayKey) {
            this._gameAlert(t('今天已經爆過料了,太常放話會被當成大嘴巴!明天再來。'), '🗣️');
            return;
        }
        const npcs = Object.entries(this.world.agents).filter(([id, a]) => !a.isPlayer && id !== this.chatTarget && !a.isDead);
        let el = document.getElementById('rumor-picker');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rumor-picker';
            el.className = 'modal';
            document.getElementById('rimtown-app')?.appendChild(el);
        }
        const rows = npcs.map(([id, a]) => `<button data-action="rumor-about" data-val="${id}"
            style="display:block;width:100%;text-align:left;padding:8px 12px;margin-bottom:5px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:0.85rem">${t(a.name)} <span style="font-size:0.7rem;color:var(--text-secondary)">${a.job?.title || t('無業')}</span></button>`).join('');
        el.innerHTML = `<div class="modal-content" style="max-width:320px;max-height:70vh;overflow-y:auto">
            <h2>🗣️ ${t('要爆誰的料?')}</h2>
            <div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:8px">${t('偷偷跟')}${t(listener.name)}${t('說別人的八卦。謠言會在鎮上流傳,小心傳回當事人耳裡...')}</div>
            ${rows}
            <div class="modal-buttons"><button onclick="document.getElementById('rumor-picker').classList.add('hidden')">${t('取消')}</button></div>
        </div>`;
        el.classList.remove('hidden');
    },

    _rumorPickTone(aboutId) {
        this._rumorAbout = aboutId;
        const about = this.world?.agents?.[aboutId];
        const el = document.getElementById('rumor-picker');
        if (!about || !el) return;
        el.innerHTML = `<div class="modal-content" style="max-width:320px">
            <h2>🗣️ ${t('關於')} ${t(about.name)}...</h2>
            <button data-action="rumor-send" data-val="praise" style="display:block;width:100%;padding:10px;margin-bottom:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary)">💐 ${t('誇讚他')} <span style="font-size:0.68rem;color:var(--text-secondary)">${t('傳回本人耳裡好感大增')}</span></button>
            <button data-action="rumor-send" data-val="diss" style="display:block;width:100%;padding:10px;margin-bottom:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary)">🐍 ${t('酸他一下')} <span style="font-size:0.68rem;color:#e88">${t('被發現是你說的就完了')}</span></button>
            <button data-action="rumor-send" data-val="ship" style="display:block;width:100%;padding:10px;margin-bottom:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary)">💘 ${t('亂點鴛鴦')} <span style="font-size:0.68rem;color:var(--text-secondary)">${t('也許會湊成一對?')}</span></button>
            <div class="modal-buttons"><button onclick="document.getElementById('rumor-picker').classList.add('hidden')">${t('取消')}</button></div>
        </div>`;
    },

    _sendRumor(tone) {
        const player = this.world?.agents?.['player'];
        const listener = this.world?.agents?.[this.chatTarget];
        const about = this.world?.agents?.[this._rumorAbout];
        if (!player || !listener || !about) return;
        let shipWith = null;
        if (tone === 'ship') {
            const others = Object.values(this.world.agents).filter(a => !a.isPlayer && !a.isDead && a.agentId !== about.agentId && a.agentId !== listener.agentId && !a.relationships.getPartner());
            if (others.length) shipWith = others[Math.floor(Math.random() * others.length)].name;
        }
        const g = this.world.gossipNetwork.playerSeedGossip(this.world, player, listener, about, tone, shipWith);
        this.world._lastRumorDay = `${this.world.clock.year}-${this.world.clock.season}-${this.world.clock.day}`;
        player.chatHistory.push({ speaker: player.name, target: listener.name, text: `🗣️(${t('偷偷說')}) ${g.content}`, time: this.world.clock.timeStr });
        const tr = listener.personality.traits;
        const relL = listener.relationships.getOrCreate('player', player.name);
        let reaction;
        if (tr.includes('gossip')) { reaction = t('哇這個猛!放心,我幫你「不小心」說出去 👀'); relL.modifyAffinity(3); }
        else if (tr.includes('kind')) { reaction = t('欸...在背後這樣說人家不太好吧...不過我聽到了。'); relL.modifyAffinity(-1); }
        else { reaction = t('喔~?有意思,我記下了。'); relL.modifyAffinity(1); }
        listener.chatHistory?.push?.({ speaker: listener.name, target: player.name, text: reaction, time: this.world.clock.timeStr });
        player.chatHistory.push({ speaker: listener.name, target: player.name, text: reaction, time: this.world.clock.timeStr });
        document.getElementById('rumor-picker')?.classList.add('hidden');
        this.bgm?.sfx?.('send');
        this.state = this.world.getState();
        if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }
        this.renderSidebar();
    },

    async showChatArchives() {
        this.activeTab = 'chat-archives';
        this._viewingArchive = null;
        this.renderSidebar();
    },

    async renderChatArchiveList(container) {
        const archives = await this.getChatArchives();
        let html = `<div class="archive-header">
            <button class="btn-back" data-action="back-to-chat">&larr; ${t('返回聊天')}</button>
            <h3>${t('聊天存檔')}</h3>
        </div>`;
        if (!archives.length) {
            html += t('<p class="muted-text" style="padding:12px">尚無存檔。開始新遊戲時聊天記錄會自動存檔。</p>');
        } else {
            html += '<div class="archive-list">';
            [...archives].reverse().forEach(a => {
                const date = new Date(a.savedAt).toLocaleDateString();
                html += `<div class="archive-item">
                    <div class="archive-info" data-action="view-archive" data-val="${a.id}">
                        <div class="archive-title">${a.gameClock} - ${a.playerName}</div>
                        <div class="archive-meta">${date} | ${a.messageCount}${t('則訊息 | ')}${a.npcNames.length}${t('位')}NPC</div>
                        <div class="archive-npcs">${a.npcNames.slice(0, 5).join(', ')}${a.npcNames.length > 5 ? '...' : ''}</div>
                    </div>
                    <div class="archive-actions">
                        <button data-action="export-archive" data-val="${a.id}" title="${t('匯出">')}${t('匯出')}</button>
                        <button data-action="delete-archive" data-val="${a.id}" title="${t('刪除')}" class="btn-danger">${t('刪除')}</button>
                    </div>
                </div>`;
            });
            html += '</div>';
        }
        container.innerHTML = html;
    },

    async viewArchive(archiveId) {
        const archives = await this.getChatArchives();
        this._viewingArchive = archives.find(a => a.id === archiveId) || null;
        if (this._viewingArchive) {
            this.activeTab = 'chat';
            this._archiveNpcFilter = null;
            this.renderSidebar();
        }
    },

    renderChatArchiveView(container) {
        const archive = this._viewingArchive;
        if (!archive) { this._viewingArchive = null; this.renderChat(container); return; }

        let html = `<div class="archive-header">
            <button class="btn-back" data-action="back-to-archives">&larr; ${t('返回列表')}</button>
            <h3>${archive.gameClock}</h3>
            <div class="archive-meta">${archive.playerName} | ${archive.messageCount}${t('則訊息')}</div>
        </div>`;

        // NPC filter buttons
        html += '<div class="nearby-list" style="padding:4px 8px">';
        html += `<button class="nearby-btn ${!this._archiveNpcFilter?'active':''}" data-action="filter-archive-npc" data-val="">All</button>`;
        archive.npcNames.forEach(name => {
            html += `<button class="nearby-btn history-btn ${this._archiveNpcFilter===name?'active':''}" data-action="filter-archive-npc" data-val="${name}">${name}</button>`;
        });
        html += '</div>';

        // Messages
        let messages = archive.messages;
        if (this._archiveNpcFilter) {
            messages = messages.filter(m => m.speaker === this._archiveNpcFilter || m.target === this._archiveNpcFilter);
        }

        html += '<div class="chat-messages" id="chat-messages">';
        if (!messages.length) {
            html += t('<p class="muted-text chat-hint">找不到訊息。</p>');
        }
        messages.forEach(msg => {
            const isP = msg.speaker === archive.playerName;
            html += `<div class="chat-bubble ${isP?'chat-player':'chat-npc'}">
                <div class="chat-speaker">${msg.speaker}</div>
                <div class="chat-text">${this._escapeHtml(msg.text)}</div>
                <div class="chat-time">${msg.time||''}</div></div>`;
        });
        html += '</div>';

        html += `<div class="chat-archive-bar">
            <button class="btn-archive-save" data-action="export-archive" data-val="${archive.id}">${t('匯出此對話記錄')}</button>
        </div>`;

        container.innerHTML = html;
        this._scrollChatToBottom();
    },

    async manualArchiveChat() {
        const result = await this.archiveChatHistory();
        if (result) {
            this.world.logMessage('system', `${t('聊天已存檔（')}${result.messageCount}${t('則訊息）。')}`);
        } else {
            this.world.logMessage('system', t('沒有聊天訊息可存檔。'));
        }
        this.state = this.world.getState();
        this.renderSidebar();
    },

    async exportArchivedChat(archiveId) {
        const archives = await this.getChatArchives();
        const archive = archives.find(a => a.id === archiveId);
        if (archive) this.exportChatLog(archive);
    },

    async deleteArchivedChat(archiveId) {
        if (!await this._gameConfirm(t('確定刪除此聊天存檔？'), '🗑️')) return;
        await this.deleteChatArchive(archiveId);
        this.renderSidebar();
    },

    _sendFromInput() {
        const input = document.getElementById('chat-input');
        if (!input || !this.chatTarget) return;
        const msg = input.value.trim(); if (!msg) return;
        input.value = '';
        // v5.35.0 耳語模式:這句話植入對方內心,不走一般對話
        if (this._whisperArmed) {
            this._whisperArmed = false;
            input.placeholder = t('輸入訊息') + '...';
            this.playerWhisper(this.chatTarget, msg);
            return;
        }
        this.playerSendMessage(this.chatTarget, msg);
    },

    // v5.35.0 耳語植入(generative_agents whisper):寫進 NPC 記憶流成為他自己的念頭
    async playerWhisper(targetId, text) {
        const npc = this.world?.agents?.[targetId];
        const player = this.world?.agents?.['player'];
        if (!npc || !player) return;
        player.chatHistory.push({ speaker: player.name, target: npc.name, text: `🤫 (${t('耳語')}) ${text}`, time: this.world.clock.timeStr });
        this.state = this.world.getState();
        if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }
        try {
            const res = await this.world.conversationEngine.plantWhisper(player, npc, text, this.world);
            player.chatHistory.push({ speaker: npc.name, target: player.name, text: `💭 (${t(npc.name)}${t('若有所思,喃喃自語')}) ${res?.thought || text}`, time: this.world.clock.timeStr });
        } catch (e) { console.error('[RimTown] whisper failed:', e); }
        this.state = this.world.getState();
        if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }
        this.bgm?.sfx?.('open');
    },

    // v5.16.0 意圖化交談鈕:每個意圖有開場白 + 一組確定會發生的機械後果
    _chatIntents() {
        return [
            { key: 'comfort',  icon: '🤗', label: t('安慰'),   hint: t('紓解對方壓力,拉近關係'),       opener: t('別太往心裡去,有我在呢。') },
            { key: 'gossip',   icon: '👂', label: t('打聽'),   hint: t('探聽鎮上最新的八卦'),           opener: t('最近鎮上有什麼新鮮事嗎?') },
            { key: 'persuade', icon: '🗯️', label: t('說服'),   hint: t('選舉期間可拉票;平時緩和恩怨'),   opener: t('聽我說,我覺得你可以再想想…') },
            { key: 'mediate',  icon: '🕊️', label: t('調解'),   hint: t('替對方化解和某人的仇恨'),        opener: t('別跟人結怨了,退一步海闊天空。') },
            { key: 'flirt',    icon: '💗', label: t('示好'),   hint: t('增進浪漫好感(關係太差會尷尬)'), opener: t('跟你在一起總是特別開心。') },
            { key: 'threaten', icon: '😠', label: t('威脅'),   hint: t('讓對方畏懼,但信任與好感重挫'),   opener: t('你最好識相點,別逼我出手。') },
            { key: 'request',  icon: '📌', label: t('委託'),   hint: t('請對方幫忙(信任夠才會答應)'),   opener: t('有件事想拜託你幫個忙。') },
            // v5.95.0 有目的的對話:求助(拿對方本行的物資)、談條件(談成後押商隊兩天內 +5%)
            { key: 'help',     icon: '📦', label: t('求助'),   hint: t('請對方從本行勻一些物資給鎮上(每人每天一次,信任越高越肯)'), opener: t('鎮上缺東西，你那邊能勻一些嗎？') },
            { key: 'bargain',  icon: '🧾', label: t('談條件'), hint: t('談成後兩天內押商隊利潤 +5%(商人最好談)'), opener: t('我們來談個條件，對你我都划算。') },
            { key: 'whisper',  icon: '🤫', label: t('耳語'),   hint: t('在他心裡種下一個念頭——他會當成自己的想法,影響之後的言行'), opener: '' },
            // v5.56.0 雙城:有別的鎮才出現
            ...(this.world?.otherTowns?.length ? [{ key: 'invite-town', icon: '🚌', label: t('邀去鄰鎮'), hint: t('邀請對方去另一個城鎮作客幾天(要夠熟才會答應)'), opener: t('要不要跟我去別的鎮走走？') }] : []),
        ];
    },

    _sendIntent(key) {
        if (this.chatSending || !this.chatTarget) return;
        const it = this._chatIntents().find(x => x.key === key);
        if (!it) return;
        // v5.35.0 耳語:進入輸入模式,下一句話會被植入對方內心(不是普通對話)
        if (key === 'whisper') {
            this._whisperArmed = true;
            const input = document.getElementById('chat-input');
            if (input) { input.placeholder = t('🤫 低聲說出你要植入的念頭...'); input.focus(); }
            return;
        }
        this._firstDayMark?.('interact'); // v5.18.0 第一天:出手互動
        if (key === 'comfort' || key === 'mediate') this._firstDayMark?.('mark'); // 這兩種也算「為某人做點事」
        // v5.95.0 擲骰:先算成功率再送出,結果傳給後果函式
        let outcome = null;
        try { const npc = this.world?.agents?.[this.chatTarget]; if (npc && this.world.chatOdds) { const o = this.world.chatOdds(npc, key); outcome = { ok: Math.random() < o.p, p: o.p }; } } catch (e) {}
        this.playerSendMessage(this.chatTarget, it.opener, key, outcome);
    },

    // 套用意圖的確定性後果,回傳給結果卡顯示的文字行(直接操作世界狀態,存進存檔)
    _applyChatIntent(npc, player, key, outcome) {
        const rel = npc.relationships.getOrCreate('player', player.name);
        const world = this.world;
        const lines = [];
        const fx = (txt, color) => lines.push({ txt, color });
        // v5.95.0 擲骰沒過:這句話沒說進心裡,原本的機械後果不套用
        if (outcome && !outcome.ok) {
            rel.modifyAffinity(-1);
            fx(`🎲 ${t('沒說進心裡')}（${t('成功率')} ${Math.round(outcome.p * 100)}%）`, '#9aa');
            fx(`${t('好感')} -1`, '#e0b07a');
            world.recordPlayerAction?.(key, '', npc, null);
            return lines;
        }
        if (outcome?.ok) { fx(`🎲 ${t('說到點上')}（${t('成功率')} ${Math.round(outcome.p * 100)}%）`, '#7fc4ff'); try { world.growth?.addXp(3, 'chat', world); world.requests?.onIntent?.(npc.agentId, key, true, world); } catch (e) {} } // v5.97.0 委託:打聽/拉票
        switch (key) {
            // v5.95.0 求助:對方從本行勻物資給鎮上(每人每天一次)
            case 'help': {
                const JOB_RES = { farmer: 'food', cook: 'food', miner: 'stone', blacksmith: 'metal', carpenter: 'wood', doctor: 'herbs', researcher: 'herbs', priest: 'herbs', tailor: 'cloth', trader: 'cloth', guard: 'tools', mayor: 'silver' };
                const res = JOB_RES[npc.job?.key] || 'food';
                const dayKey = `${world.clock.year}-${world.clock.season}-${world.clock.day}`;
                if (npc._lastHelpDay === dayKey) { fx(`📦 ${t(npc.name)}${t('說今天已經勻過了，明天再說')}`, '#9aa'); break; }
                const amount = 10 + Math.floor(Math.random() * 11);
                npc._lastHelpDay = dayKey;
                world.stockpile.add(res, amount, world.tickCount, `${t('求助')}：${t(npc.name)}`, 'player');
                rel.trust = Math.max(-100, (rel.trust || 0) - 2);
                npc.memory?.add?.(world.tickCount, world.clock.timeStr, 'social', `${t('勻了')}${amount}${t('份東西給')}${t(player.name)}`, 5, ['player']);
                const label = (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[res]?.name) ? SHOP_ITEMS[res].name() : res;
                fx(`📦 ${t(npc.name)}${t('勻了')} ${amount} ${label} ${t('給鎮上')}`, '#5cc98f');
                fx(`${t('信任')} -2（${t('人情總要還')}）`, '#e0b07a');
                break;
            }
            // v5.95.0 談條件:談成後兩天內押商隊利潤 +5%
            case 'bargain': {
                world.bargainUntilAbsDay = world._absDay() + 2;
                rel.modifyAffinity(1);
                npc.memory?.add?.(world.tickCount, world.clock.timeStr, 'social', `${t('和')}${t(player.name)}${t('談成了一筆條件')}`, 5, ['player']);
                fx(`🧾 ${t(npc.name)}${t('點頭答應：兩天內押商隊利潤 +5%')}`, '#5cc98f');
                break;
            }
            // v5.56.0 雙城:邀請村民去另一個鎮作客
            case 'invite-town': {
                const towns = world.otherTowns || [];
                const town = towns[Math.floor(Math.random() * towns.length)];
                if (!town || (npc.agentId || '').startsWith('visit_')) { fx(t('現在沒辦法邀請這位出遠門'), '#c9a05c'); break; }
                if ((rel.affinity || 0) < 20) {
                    fx(`🚌 ${t(npc.name)}${t('婉拒了：「跟你還沒熟到一起出遠門啦。」')}`, '#c9a05c');
                    break;
                }
                world.sendVisitorTo(npc, town, 4);
                fx(`🚌 ${t(npc.name)}${t('答應去')}${t(town.name)}${t('作客幾天，收拾行李出發了！')}`, '#5cc98f');
                fx(t('切到那個鎮就能看到他作客的樣子；幾天後他會帶著見聞回來'), '#8fa8c9');
                world.recordPlayerAction?.('invite-town', '', npc, null);
                break;
            }
            case 'comfort': {
                npc.needs.social = Math.min(100, npc.needs.social + 15);
                npc.moodModifier = (npc.moodModifier || 0) + 4;
                rel.modifyAffinity(2);
                npc.addThought?.('nice_chat', world, 'player', player.name);
                fx(`🤗 ${t(npc.name)}${t('覺得被支持了')}`, '#5cc98f');
                fx(`${t('壓力')} ↓ · ${t('好感')} +2`, '#5cc98f');
                break;
            }
            case 'gossip': {
                const g = (world.gossipNetwork?.activeGossip || [])
                    .filter(x => x.about && x.about !== npc.name && x.about !== player.name)
                    .slice(-8);
                const pick = g.length ? g[Math.floor(Math.random() * g.length)] : null;
                rel.modifyAffinity(1);
                if (pick) {
                    player.chatHistory.push({ speaker: npc.name, target: player.name, text: `(${t('壓低聲音')}) ${pick.content}`, time: world.clock.timeStr });
                    fx(`👂 ${t(npc.name)}${t('跟你透露了一則八卦')}`, '#d9b3ff');
                } else {
                    fx(`👂 ${t(npc.name)}${t('說最近沒什麼新鮮事')}`, '#9aa');
                }
                break;
            }
            case 'persuade': {
                const el = world.election;
                const active = el && (el.active || el.phase === 'campaign' || el.phase === 'voting');
                const cands = el?.candidates || [];
                // v5.38.0 你自己就是候選人:「說服」= 為自己拉票(每位村民一屆一次)
                if (active && cands.some(c => c.agentId === 'player')) {
                    const res = el.canvassNpc ? el.canvassNpc(world, npc) : { ok: false };
                    if (res.ok) {
                        rel.modifyAffinity(2);
                        fx(`👑 ${t('你向')}${t(npc.name)}${t('認真說明了自己的政見')}`, '#ffd700');
                        fx(t('他聽進去了——投票時會記得你'), '#7fc4ff');
                    } else if (res.dup) {
                        fx(`🗳️ ${t(npc.name)}${t('笑說你已經拉過他的票了')}`, '#9aa');
                    } else {
                        rel.modifyAffinity(1);
                        fx(`🗯️ ${t(npc.name)}${t('點頭聽著你說')}`, '#9aa');
                    }
                } else if (active && cands.length) {
                    // 拉票:把 NPC 對「玩家最挺的候選人」的好感往上推(信任越高越有效)
                    const favored = cands
                        .map(c => ({ c, aff: player.relationships.relationships[c.agentId]?.affinity || 0 }))
                        .sort((a, b) => b.aff - a.aff)[0]?.c;
                    if (favored && favored.agentId !== npc.agentId) {
                        const trust = rel.trust || 0;
                        if (trust > -10) {
                            const r2 = npc.relationships.getOrCreate(favored.agentId, favored.name);
                            const gain = 6 + Math.round(Math.max(0, trust) / 20);
                            r2.modifyAffinity(gain);
                            fx(`🗯️ ${t(npc.name)}${t('更傾向支持')}${t(favored.name)}${t('了')}`, '#7fc4ff');
                            fx(`${t('選舉風向被你撥動了一點')}`, '#7fc4ff');
                        } else {
                            rel.modifyAffinity(-3);
                            fx(`🗯️ ${t(npc.name)}${t('不吃你這套,反而更防著你')}`, '#e07a7a');
                        }
                    } else if (favored && favored.agentId === npc.agentId) {
                        rel.modifyAffinity(2);
                        fx(`🗯️ ${t(npc.name)}${t('很高興你挺他參選')}`, '#7fc4ff');
                    }
                } else {
                    // 平時:勸他放下對頭
                    const foe = Object.values(npc.relationships.relationships).filter(r => (r.affinity || 0) < -20).sort((a, b) => a.affinity - b.affinity)[0];
                    if (foe) { foe.modifyAffinity(5); fx(`🗯️ ${t('你勸')}${t(npc.name)}${t('對')}${foe.targetName}${t('別那麼針對')}`, '#7fc4ff'); fx(`${t('敵意')} ↓`, '#7fc4ff'); }
                    else { rel.modifyAffinity(1); fx(`🗯️ ${t(npc.name)}${t('點頭聽著你說')}`, '#9aa'); }
                }
                break;
            }
            case 'mediate': {
                // v5.47.0 BUG-02:優先挑「絕交」對象(和解任務目標),而不是單純好感最低者
                const foes = Object.values(npc.relationships.relationships).filter(r => (r.affinity || 0) < -20).sort((a, b) => a.affinity - b.affinity);
                const foe = foes.find(r => r.isFeud) || foes[0];
                if (!foe) { fx(`🕊️ ${t(npc.name)}${t('最近沒跟誰結怨')}`, '#9aa'); break; }
                const other = world.agents[foe.targetId];
                // v5.42.0 和解線:對「絕交」等級的仇怨,調解升級為兩段式任務——
                // 分別勸過兩邊後,促成「世紀大和解」名場面(大量好感+聲望+成就)
                if (other && (foe.isFeud || foe.affinity <= -40)) {
                    world.mediations = world.mediations || {};
                    const key = [npc.agentId, other.agentId].sort().join('|');
                    const rec = world.mediations[key] = world.mediations[key] || { sides: {} };
                    if (rec.sides[npc.agentId]) {
                        fx(`🕊️ ${t(npc.name)}${t('嘆了口氣:「你上次說的,我還在想...」')}`, '#9aa');
                        fx(`${t('和解進度')} ${Object.keys(rec.sides).length}/2 — ${t('去勸勸另一邊的')}${foe.targetName}${t('吧')}`, '#7fc4ff');
                        break;
                    }
                    if ((rel.trust || 0) < -10) {
                        rel.modifyAffinity(-2);
                        fx(`🕊️ ${t(npc.name)}${t('冷冷地說:「這與你無關。」')}`, '#e07a7a');
                        fx(`${t('他還不信任你——先提升關係再來調解')}`, '#e07a7a');
                        break;
                    }
                    rec.sides[npc.agentId] = true;
                    foe.modifyAffinity(6);
                    npc.memory.add(world.tickCount, world.clock.timeStr, 'plan', `${t(player.name)}${t('苦口婆心勸我和')}${foe.targetName}${t('和好...也許,是該放下了。')}`, 7, [foe.targetName]);
                    const bothDone = rec.sides[npc.agentId] && rec.sides[other.agentId];
                    if (bothDone) {
                        // 兩邊都勸過了 → 世紀大和解
                        delete world.mediations[key];
                        const relAB = npc.relationships.getOrCreate(other.agentId, other.name);
                        const relBA = other.relationships.getOrCreate(npc.agentId, npc.name);
                        relAB.modifyAffinity(Math.max(0, -5 - relAB.affinity));
                        relBA.modifyAffinity(Math.max(0, -5 - relBA.affinity));
                        relAB.isFeud = false; relBA.isFeud = false;
                        npc.moodModifier = (npc.moodModifier || 0) + 10;
                        other.moodModifier = (other.moodModifier || 0) + 10;
                        npc.memory.add(world.tickCount, world.clock.timeStr, 'relationship', `${t('在')}${t(player.name)}${t('的調解下,我和')}${t(other.name)}${t('和解了。心裡一塊石頭落了地。')}`, 9, [other.name, player.name]);
                        other.memory.add(world.tickCount, world.clock.timeStr, 'relationship', `${t('在')}${t(player.name)}${t('的調解下,我和')}${t(npc.name)}${t('和解了。心裡一塊石頭落了地。')}`, 9, [npc.name, player.name]);
                        npc.relationships.getOrCreate('player', player.name).modifyAffinity(8);
                        other.relationships.getOrCreate('player', player.name).modifyAffinity(8);
                        world.reputationSystem?.addReputation?.(15, 'help', world);
                        world.logMessage('event', `🕊️ ${t('在')}${t(player.name)}${t('的奔走下,')}${t(npc.name)}${t('和')}${t(other.name)}${t('當眾和解!全鎮傳為佳話')}`);
                        world.dailyNews?.collectEvent('social', `${t(npc.name)}${t('與')}${t(other.name)}${t('在旅人調解下世紀大和解')}`, 9, [npc.name, other.name]);
                        world.queueDramaScene?.('reconcile', npc, other, player.name);
                        this._unlockAchievement('peacemaker');
                        fx(`🕊️ ${t('成了!')}${t(npc.name)}${t('和')}${t(other.name)}${t('當眾和解!')}`, '#ffd700');
                        fx(`${t('兩人好感 +8 · 聲望 +15')}`, '#5cc98f');
                    } else {
                        fx(`🕊️ ${t(npc.name)}${t('沉默許久:「...讓我想想。」')}${t('（心防鬆動了）')}`, '#5cc98f');
                        fx(`${t('和解進度')} 1/2 — ${t('再去勸勸')}${foe.targetName}${t(',兩邊都點頭就能促成和解')}`, '#7fc4ff');
                    }
                    break;
                }
                // 一般恩怨:維持緩和效果
                foe.modifyAffinity(8);
                if (other) other.relationships.getOrCreate(npc.agentId, npc.name).modifyAffinity(4);
                rel.modifyAffinity(1);
                world.logMessage?.('relationship', `🕊️ ${t('經你居中調解,')}${t(npc.name)}${t('對')}${foe.targetName}${t('的敵意緩和了一些')}`, npc.name, foe.targetName);
                fx(`🕊️ ${t('你緩和了')}${t(npc.name)}${t('對')}${foe.targetName}${t('的敵意')}`, '#5cc98f');
                fx(`${t('好感(對')}${foe.targetName}) +8`, '#5cc98f');
                break;
            }
            case 'flirt': {
                if ((rel.affinity || 0) > 25) {
                    rel.modifyRomantic(3); rel.modifyAffinity(1);
                    npc.addThought?.('nice_chat', world, 'player', player.name);
                    fx(`💗 ${t(npc.name)}${t('心跳漏了一拍')}`, '#ff8fb0');
                    fx(`${t('浪漫')} +3`, '#ff8fb0');
                } else {
                    rel.modifyAffinity(-3);
                    fx(`💗 ${t('太唐突了,')}${t(npc.name)}${t('有點尷尬')}`, '#e07a7a');
                    fx(`${t('好感')} −3`, '#e07a7a');
                }
                break;
            }
            case 'threaten': {
                rel.modifyTrust(-12); rel.modifyAffinity(-8);
                npc.moodModifier = (npc.moodModifier || 0) - 5;
                npc.addThought?.('harsh_words', world, 'player', player.name);
                fx(`😠 ${t(npc.name)}${t('怕了你,但更討厭你了')}`, '#e07a7a');
                fx(`${t('信任')} ↓↓ · ${t('好感')} −8`, '#e07a7a');
                break;
            }
            case 'request': {
                const trust = rel.trust || 0;
                if (trust >= 10 || (rel.affinity || 0) >= 30) {
                    rel.modifyAffinity(3);
                    npc.memory?.add?.(world.tickCount, world.clock.timeStr, 'social', `${t('答應幫')}${t(player.name)}${t('一個忙')}`, 5, ['player']);
                    fx(`📌 ${t(npc.name)}${t('答應幫你了')}`, '#5cc98f');
                    fx(`${t('好感')} +3`, '#5cc98f');
                } else {
                    fx(`📌 ${t(npc.name)}${t('跟你還不夠熟,婉拒了')}`, '#e0b07a');
                }
                break;
            }
        }
        // v5.45.0 蝴蝶效應:記錄這次行動+關係快照,隔天首頁「昨日回響」告訴你發酵了什麼
        world.recordPlayerAction?.(key, '', npc, null);
        return lines;
    },

    // v5.16.0 對話結果卡:把對話對遊戲狀態的影響直接攤給玩家看(暫時浮現,不污染聊天紀錄)
    _showChatEffect(npc, reply, intentLines) {
        const el = document.getElementById('chat-messages');
        if (!el) return;
        const eff = reply?.effects || {};
        const rows = [];
        const aff = eff.affinity_change;
        if (typeof aff === 'number' && aff !== 0) {
            const pos = aff > 0;
            rows.push(`<span style="color:${pos ? '#5cc98f' : '#e07a7a'}">❤️ ${t('好感')} ${pos ? '+' : ''}${aff}</span>`);
        }
        const rom = eff.romantic_change;
        if (typeof rom === 'number' && rom > 0) rows.push(`<span style="color:#ff8fb0">💕 ${t('浪漫')} +${rom}</span>`);
        (intentLines || []).forEach(l => rows.push(`<span style="color:${l.color || '#ccd'}">${l.txt}</span>`));
        if (!rows.length) return;
        // 現在關係層級的一句話狀態(跨過門檻時最有感)
        const rel = this.world?.agents?.[npc.agentId]?.relationships?.relationships?.['player'];
        if (rel) {
            const a = rel.affinity || 0;
            let statusNote = '';
            if (a <= -20) statusNote = `${t(npc.name)}${t('把你當成對頭')}`;
            else if (a >= 55) statusNote = `${t(npc.name)}${t('把你當成摯友')}`;
            else if (a >= 20) statusNote = `${t(npc.name)}${t('把你當朋友')}`;
            if (statusNote) rows.push(`<span style="color:#9aa;font-size:0.9em">→ ${statusNote}</span>`);
        }
        const div = document.createElement('div');
        div.className = 'chat-effect-chip';
        div.innerHTML = rows.join('<span class="chat-effect-dot">·</span>');
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
        setTimeout(() => { div.classList.add('fade'); }, 4200);
        setTimeout(() => { div.remove(); }, 5000);
    },
    _scrollChatToBottom() { requestAnimationFrame(() => { const el = document.getElementById('chat-messages'); if(el) el.scrollTop=el.scrollHeight; }); },
    _appendChatBubble(type, text) { const el = document.getElementById('chat-messages'); if(!el) return; const div=document.createElement('div'); div.className=`chat-bubble chat-${type}`; div.innerHTML=`<div class="chat-text">${this._escapeHtml(text)}</div>`; el.appendChild(div); el.scrollTop=el.scrollHeight; },

    _updateChatBadge() {
        const count = this._chatUnread ? this._chatUnread.size : 0;
        // 同步所有聊天入口(開羅底部列 data-tab="chat" + 三大入口「居民」鈕 data-tab-badge="chat")的未讀徽章
        document.querySelectorAll('[data-tab="chat"], [data-tab-badge="chat"]').forEach(tab => {
            let badge = tab.querySelector('.chat-badge');
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'chat-badge';
                    tab.style.position = 'relative';
                    tab.appendChild(badge);
                }
                badge.textContent = count > 9 ? '9+' : count;
            } else if (badge) {
                badge.remove();
            }
        });
    },
});
