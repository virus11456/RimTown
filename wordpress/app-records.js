// RimTown - app-records.js：從 app.js 拆出的 紀錄分頁：編年史、日報、故事（任務）分頁（v6.0.0 B14）。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app.js 之後、DOMContentLoaded 之前載入（index.html／rimtown.php／sw.js 都要列）。
'use strict';
Object.assign(RimTownApp.prototype, {
    renderRecords(container) {
        this.renderLog(container);
        this._renderChronicleSection(container);
    },

    // ============================================================
    // v5.43.0 小鎮編年史:IndexedDB 資料庫(每天換日自動歸檔),可調閱/匯出
    // ============================================================
    _chronicleDb() {
        if (this._chronicleDbPromise) return this._chronicleDbPromise;
        this._chronicleDbPromise = new Promise((resolve, reject) => {
            try {
                const req = indexedDB.open('rimtown-chronicle', 1);
                req.onupgradeneeded = () => { req.result.createObjectStore('days', { keyPath: 'key' }); };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } catch (e) { reject(e); }
        });
        return this._chronicleDbPromise;
    },
    _chronicleSeq(arc) {
        const sIdx = Math.max(0, ['春季', '夏季', '秋季', '冬季'].indexOf(arc.season));
        return ((arc.year - 1) * 4 + sIdx) * 15 + (arc.day - 1);
    },
    _chronicleLabel(arc) { return `${t('第')}${arc.year}${t('年 ')}${t(arc.season)} ${t('第')}${arc.day}${t('天')}`; },
    async _chroniclePut(arc) {
        try {
            const db = await this._chronicleDb();
            const rec = { key: this._chronicleSeq(arc), label: this._chronicleLabel(arc), ...arc };
            await new Promise((res, rej) => {
                const tx = db.transaction('days', 'readwrite');
                tx.objectStore('days').put(rec);
                tx.oncomplete = res; tx.onerror = () => rej(tx.error);
            });
            this._chronicleKeys = null; // 讓列表下次重讀
        } catch (e) { console.warn('[RimTown] chronicle put failed:', e); }
    },
    async _chronicleAll() {
        const db = await this._chronicleDb();
        return new Promise((res, rej) => {
            const req = db.transaction('days').objectStore('days').getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => rej(req.error);
        });
    },
    async _chronicleGet(key) {
        const db = await this._chronicleDb();
        return new Promise((res, rej) => {
            const req = db.transaction('days').objectStore('days').get(Number(key));
            req.onsuccess = () => res(req.result || null);
            req.onerror = () => rej(req.error);
        });
    },
    async _chronicleClear() {
        const db = await this._chronicleDb();
        await new Promise((res, rej) => {
            const tx = db.transaction('days', 'readwrite');
            tx.objectStore('days').clear();
            tx.oncomplete = res; tx.onerror = () => rej(tx.error);
        });
        this._chronicleKeys = null; this._chronicleView = null;
    },
    _downloadFile(filename, content, mime) {
        const blob = new Blob([content], { type: mime || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    _csvCell(v) { const s = String(v ?? ''); return `"${s.replace(/"/g, '""')}"`; },
    async _chronicleExportJSON() {
        const all = (await this._chronicleAll()).sort((a, b) => a.key - b.key);
        this._downloadFile('rimtown-chronicle.json', JSON.stringify(all, null, 2), 'application/json');
    },
    async _chronicleExportConvoCSV() {
        const all = (await this._chronicleAll()).sort((a, b) => a.key - b.key);
        const rows = [['day', 'time', 'type', 'a', 'b', 'ai', 'summary', 'dialogue'].join(',')];
        for (const d of all) {
            for (const c of (d.convos || [])) {
                rows.push([this._csvCell(d.label), this._csvCell(c.time), 'npc', this._csvCell(c.a), this._csvCell(c.b), c.llm ? 'yes' : 'no', this._csvCell(c.summary), this._csvCell((c.dialogue || []).join(' / '))].join(','));
            }
            for (const p of (d.playerChats || [])) {
                rows.push([this._csvCell(d.label), this._csvCell(p.time), 'player', this._csvCell(p.speaker), this._csvCell(p.target), '', '', this._csvCell(p.text)].join(','));
            }
        }
        this._downloadFile('rimtown-conversations.csv', '\uFEFF' + rows.join('\n'), 'text/csv;charset=utf-8');
    },
    async _chronicleExportScheduleCSV() {
        const all = (await this._chronicleAll()).sort((a, b) => a.key - b.key);
        const fmtM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const rows = [['day', 'npc', 'job', 'currently', 'plan', 'trace'].join(',')];
        for (const d of all) {
            for (const n of (d.npcs || [])) {
                rows.push([this._csvCell(d.label), this._csvCell(n.name), this._csvCell(n.job), this._csvCell(n.currently),
                    this._csvCell((n.plan || []).join('；')),
                    this._csvCell((n.trace || []).map(e => `${fmtM(e.m)} ${e.text}`).join('；'))].join(','));
            }
        }
        this._downloadFile('rimtown-schedules.csv', '\uFEFF' + rows.join('\n'), 'text/csv;charset=utf-8');
    },
    _renderChronicleSection(container) {
        const host = document.createElement('div');
        host.className = 'econ-section';
        host.style.cssText = 'margin-top:12px';
        const keys = this._chronicleKeys;
        let listHtml;
        if (keys == null) {
            listHtml = `<p class="muted-text" style="font-size:0.72rem">${t('載入中…')}</p>`;
            this._chronicleAll().then(all => {
                this._chronicleKeys = all.sort((a, b) => b.key - a.key).map(d => ({ key: d.key, label: d.label, n: (d.npcs || []).length, c: (d.convos || []).length + (d.playerChats || []).length }));
                if (this.activeTab === 'records') this.renderSidebar();
            }).catch(() => { this._chronicleKeys = []; });
        } else if (!keys.length) {
            listHtml = `<p class="muted-text" style="font-size:0.72rem">${t('還沒有歸檔。每天換日時會自動把全鎮的作息、行程、足跡與對話存進資料庫。')}</p>`;
        } else {
            listHtml = keys.slice(0, 30).map(k =>
                `<div class="memory-item" data-action="chronicle-view" data-val="${k.key}" style="cursor:pointer${this._chronicleView?.key === k.key ? ';border-left:2px solid var(--accent,#ffd700)' : ''}">📅 ${k.label} <span style="color:var(--text-muted);font-size:0.68rem">${k.n} ${t('位村民')} · ${k.c} ${t('場對話')}</span></div>`
            ).join('');
        }
        let viewHtml = '';
        const v = this._chronicleView;
        if (v) {
            const fmtM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
            viewHtml += `<div style="margin-top:8px;font-weight:700;font-size:0.82rem">📖 ${v.label}</div>`;
            if ((v.convos || []).length) {
                viewHtml += `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:0.78rem">💬 ${t('對話')}（${v.convos.length}）</summary>` +
                    v.convos.map(c => `<details style="margin:4px 0 4px 10px"><summary style="cursor:pointer;font-size:0.72rem">${c.time.split(' ').pop()} ${c.a} × ${c.b}${c.llm ? ' 🤖' : ''} — ${this._escapeHtml(c.summary)}</summary><div style="font-size:0.7rem;padding:4px 0 4px 12px;line-height:1.6">${(c.dialogue || []).map(l => this._escapeHtml(l)).join('<br>')}</div></details>`).join('') + '</details>';
            }
            if ((v.playerChats || []).length) {
                viewHtml += `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:0.78rem">🧑 ${t('你的對話')}（${v.playerChats.length}）</summary><div style="font-size:0.7rem;padding:4px 0 4px 12px;line-height:1.6">${v.playerChats.map(p => `${this._escapeHtml(p.speaker)} → ${this._escapeHtml(p.target)}: ${this._escapeHtml(p.text)}`).join('<br>')}</div></details>`;
            }
            viewHtml += (v.npcs || []).map(n => `<details style="margin-top:4px"><summary style="cursor:pointer;font-size:0.75rem">👤 ${t(n.name)}${n.job ? `（${n.job}）` : ''}${n.planLlm ? ' 🤖' : ''}${n.replanned ? ' 📝' : ''}</summary>
                <div style="font-size:0.7rem;padding:4px 0 4px 12px;line-height:1.6">
                ${n.currently ? `<div>🧭 ${this._escapeHtml(n.currently)}</div>` : ''}
                ${(n.plan || []).length ? `<div style="margin-top:3px">📅 ${n.plan.map(g => this._escapeHtml(g)).join('　')}</div>` : ''}
                ${(n.trace || []).length ? `<div style="margin-top:3px">🕐 ${n.trace.map(e => `${fmtM(e.m)} ${this._escapeHtml(e.text)}`).join('　')}</div>` : ''}
                </div></details>`).join('');
        }
        host.innerHTML = `<h3>📚 ${t('小鎮編年史')}</h3>
            <p class="muted-text" style="font-size:0.68rem;margin:2px 0 6px">${t('每天換日自動歸檔全鎮村民的近況、行程、足跡與所有對話逐字稿(存在你的瀏覽器資料庫)。')}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                <button class="btn-archive-view" data-action="chronicle-export-json">📦 ${t('匯出 JSON')}</button>
                <button class="btn-archive-view" data-action="chronicle-export-convo">💬 ${t('匯出對話 CSV')}</button>
                <button class="btn-archive-view" data-action="chronicle-export-sched">📅 ${t('匯出作息 CSV')}</button>
                <button class="btn-archive-view" data-action="chronicle-clear" style="opacity:0.7">🗑️ ${t('清空')}</button>
            </div>
            ${listHtml}${viewHtml}`;
        container.appendChild(host);
    },

    // ============================================================
    // Newspaper Tab
    // ============================================================
    renderNewspaper(container) {
        if (!this.state) return;
        const news = this.state.dailyNews || {};
        const papers = news.newspapers || [];

        let html = '<div class="economy-panel">';
        html += `${t('<div class="econ-section"><h3>📰 AI 日報（共 ')}${papers.length}${t(' 期）</h3></div>')}`;

        if (papers.length === 0) {
            html += t('<div class="econ-section"><p class="muted-text">還沒有日報。每天結束時會自動發佈。</p></div>');
        }

        // Show latest first
        const display = papers.slice().reverse().slice(0, 20);
        for (let i = 0; i < display.length; i++) {
            const paper = display[i];
            const isExpanded = this._expandedNewspaper === paper.id;
            const isLatest = i === 0;

            html += `<div class="news-card ${isExpanded ? 'news-expanded' : ''} ${isLatest ? 'news-latest' : ''}" data-action="view-newspaper" data-val="${paper.id}">`;
            html += `<div class="news-card-header">`;
            html += `<div class="news-card-issue">#${paper.id}</div>`;
            html += `<div class="news-card-meta">`;
            html += `${t('<div class="news-card-date">第')}${paper.year}${t('年 ')}${paper.season}${t(' 第')}${paper.day}${t('天</div>')}`;
            html += `<div class="news-card-reporter">✍️ ${paper.reporter}（${paper.reporterJob}）</div>`;
            html += `</div>`;
            html += `<div class="news-card-toggle">${isExpanded ? '▲' : '▼'}</div>`;
            html += `</div>`;

            // Show headline preview when collapsed
            if (!isExpanded && paper.content) {
                const firstLine = paper.content.split('\n').find(l => l.trim().length > 0) || '';
                const preview = firstLine.length > 40 ? firstLine.substring(0, 40) + '…' : firstLine;
                html += `<div class="news-card-preview">${this._escapeHtml(preview)}</div>`;
            }

            if (isExpanded) {
                html += `<div class="news-card-content">${this._escapeHtml(paper.content)}</div>`;
            }
            html += '</div>';
        }

        if (papers.length > 20) {
            html += `${t('<div class="econ-section"><p class="muted-text">顯示最近 20 期（共 ')}${papers.length}${t(' 期）</p></div>')}`;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    _viewNewspaper(id) {
        this._expandedNewspaper = this._expandedNewspaper === id ? null : id;
        this.renderSidebar();
    },

    // ============================================================
    // Quest Tab (主線任務)
    // ============================================================
    renderQuest(container) {
        if (!this.state) return;
        // v5.59.0 TC-03:海風鎮沒有邊境鎮的主線(卡司不同),顯示佔位而非「落腳邊境」
        const themeStory = TOWN_STORY_BLURBS[this.world?.townTheme || 'frontier'];
        if (themeStory && !(typeof questChainFor === 'function' && questChainFor(this.world?.townTheme))) { // v5.83.0 有任務鏈的鎮顯示真正章節
            container.innerHTML = `<div class="economy-panel"><div class="econ-section">
                <h3>${themeStory.icon} ${t(themeStory.title)}</h3>
                <p class="muted-text" style="line-height:1.7">${t(themeStory.text)}</p>
            </div></div>`;
            return;
        }
        // Trigger quest check on view
        if (this.world.questSystem) this.world.questSystem.checkProgress(this.world);
        this.state = this.world.getState();
        const qs = this.state.questSystem;
        if (!qs) {
            container.innerHTML = t('<div class="economy-panel"><p class="muted-text">任務系統尚未載入。</p></div>');
            return;
        }

        const chapterNames = qs.chapterNames || (typeof CHAPTER_NAMES !== 'undefined' ? CHAPTER_NAMES : {}); // v5.83.0 依主題
        const rewardLabels = { silver: '💰', food: '🍖', wood: '🪵', stone: '🪨', metal: '⛓️', reputation: '⭐' };
        let html = '<div class="economy-panel">';

        // Header with reputation
        html += this._renderRequestBoard(); // v5.91.0 今日委託
        html += this._renderSeasonTrial(); // v5.93.0 本季考驗
        html += this._renderGrowth(); // v5.94.0 旅人成長
        html += t('<div class="econ-section"><h3>⚔️ 主線任務</h3>');
        html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
        html += `${t('<div style="font-size:0.75rem;color:var(--text-secondary)">進度：')}${qs.completedCount}/${qs.totalCount}${t(' 完成')}`;
        if (qs.reputation) html += `${t(' | ⭐ 聲望：')}${qs.reputation}`;
        html += `</div>`;
        html += `<button data-action="quest-refresh" style="font-size:0.7rem;padding:4px 10px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:var(--text-primary);cursor:pointer">🔄 ${t('刷新進度')}</button>`;
        html += `</div></div>`;

        // Crisis banner
        if (qs.activeCrisis) {
            const crisisLabels = { locust: t('🦗 蝗災'), bandit: t('⚔️ 盜匪圍城'), plague: t('🏥 瘟疫') };
            html += `<div class="econ-section" style="background:rgba(255,80,80,0.1);border-left:3px solid var(--negative);padding:8px 12px">`;
            html += `${t('<div style="font-weight:bold;color:var(--negative)">⚠️ 當前危機：')}${crisisLabels[qs.activeCrisis] || qs.activeCrisis}</div>`;
            html += `</div>`;
        }

        // Overall progress bar
        const overallPct = Math.round((qs.completedCount / qs.totalCount) * 100);
        html += `<div class="econ-section"><div class="progress-bar" style="height:10px;margin-bottom:8px"><div class="progress-fill" style="width:${overallPct}%;background:var(--accent)"></div></div></div>`;

        // Group quests by chapter
        const chapters = {};
        for (const [qId, qData] of Object.entries(qs.quests)) {
            const ch = qData.chapter || 1;
            if (!chapters[ch]) chapters[ch] = [];
            chapters[ch].push({ id: qId, ...qData });
        }

        for (const [chNum, quests] of Object.entries(chapters)) {
            const chName = chapterNames[chNum] || `${t('第')}${chNum}${t('章')}`;
            const allCompleted = quests.every(q => q.status === 'completed');
            const hasActive = quests.some(q => q.status === 'active');

            html += `<div class="econ-section">`;
            html += `<h3 style="color:${allCompleted ? 'var(--positive)' : hasActive ? 'var(--accent)' : 'var(--text-muted)'}">${allCompleted ? '✅' : hasActive ? '📖' : '🔒'} ${chName}</h3>`;

            for (const quest of quests) {
                if (quest.status === 'locked') {
                    html += t('<div class="quest-card quest-locked"><div class="quest-title">🔒 ???</div><div class="quest-desc">完成前置任務後解鎖</div></div>');
                    continue;
                }

                const isActive = quest.status === 'active';
                const isComplete = quest.status === 'completed';
                const cardClass = isComplete ? 'quest-completed' : isActive ? 'quest-active' : '';

                html += `<div class="quest-card ${cardClass}">`;
                html += `<div class="quest-title">${isComplete ? '✅' : quest.isCrisis ? '⚠️' : quest.isFinale ? '🏆' : '⚔️'} ${quest.title}</div>`;
                html += `<div class="quest-desc">${quest.description}</div>`;

                // Completed route badge
                if (isComplete && quest.completedRoute && quest.routes) {
                    const route = quest.routes.find(r => r.id === quest.completedRoute);
                    if (route) {
                        html += `${t('<div style="margin:4px 0;font-size:0.75rem;color:var(--positive)">✓ 以「')}${route.icon || ''} ${route.label}${t('」完成</div>')}`;
                    }
                }

                // Multi-route display
                if (quest.routes && isActive) {
                    html += '<div class="quest-routes" style="margin-top:6px">';
                    html += t('<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">選擇任一路線完成即可：</div>');
                    for (const route of quest.routes) {
                        // Calculate route overall progress
                        const condCount = route.conditions.length;
                        const condDone = route.conditions.filter(c => c.completed).length;
                        const routePct = condCount > 0 ? Math.round((condDone / condCount) * 100) : 0;
                        const routeComplete = condDone === condCount;

                        html += `<div class="quest-route" style="margin:6px 0;padding:6px 8px;border-radius:6px;background:${routeComplete ? 'rgba(80,200,120,0.1)' : 'rgba(255,255,255,0.03)'};border:1px solid ${routeComplete ? 'var(--positive)' : 'rgba(255,255,255,0.08)'}">`;
                        html += `<div style="font-weight:bold;font-size:0.8rem;margin-bottom:3px">${route.icon || '📋'} ${route.label}</div>`;
                        html += `<div style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:4px">${route.description}</div>`;

                        for (const cond of route.conditions) {
                            const pct = Math.min(100, Math.round((cond.progress / cond.target) * 100));
                            html += `<div class="quest-objective ${cond.completed ? 'done' : ''}" style="margin:2px 0">`;
                            html += `<span style="font-size:0.75rem">${cond.completed ? '☑' : '☐'} ${cond.label}</span>`;
                            html += `<span class="quest-obj-progress" style="font-size:0.7rem">${cond.progress}/${cond.target}</span>`;
                            html += `<div class="progress-bar" style="height:3px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${cond.completed ? 'var(--positive)' : 'var(--accent)'}"></div></div>`;
                            html += '</div>';
                        }
                        html += '</div>';
                    }
                    html += '</div>';
                }

                // Multi-route display for completed quests (collapsed)
                if (quest.routes && isComplete) {
                    const completedRoute = quest.routes.find(r => r.id === quest.completedRoute);
                    if (completedRoute) {
                        html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">`;
                        html += `${t('其他路線：')}${quest.routes.filter(r => r.id !== quest.completedRoute).map(r => `${r.icon || ''} ${r.label}`).join('、') || t('無')}`;
                        html += `</div>`;
                    }
                }

                // Legacy objectives (for ch1_settle)
                if (quest.objectives && !quest.routes) {
                    html += '<div class="quest-objectives">';
                    for (const obj of quest.objectives) {
                        const pct = Math.min(100, Math.round((obj.progress / obj.target) * 100));
                        const done = obj.completed;
                        html += `<div class="quest-objective ${done ? 'done' : ''}">`;
                        html += `<span>${done ? '☑' : '☐'} ${obj.label}</span>`;
                        html += `<span class="quest-obj-progress">${obj.progress}/${obj.target}</span>`;
                        html += `<div class="progress-bar" style="height:4px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${done ? 'var(--positive)' : 'var(--accent)'}"></div></div>`;
                        html += '</div>';
                    }
                    html += '</div>';
                }

                // Rewards
                if (isActive && quest.rewards) {
                    const rewardStr = Object.entries(quest.rewards)
                        .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                        .join('  ');
                    html += `${t('<div class="quest-rewards" style="margin-top:4px;font-size:0.75rem">獎勵：')}${rewardStr}</div>`;
                }

                // Completion message
                if (isComplete && quest.onComplete) {
                    html += `<div class="quest-complete-msg">${quest.onComplete}</div>`;
                }

                html += '</div>';
            }
            html += '</div>';
        }

        // ============================================================
        // 每日目標
        // ============================================================
        if (qs.dailyObjective) {
            html += `<div class="econ-section">`;
            html += t('<h3>⭐ 每日目標</h3>');
            html += `<div class="quest-card quest-active" style="border-left:3px solid var(--accent)">`;
            html += `<div class="quest-title">${qs.dailyObjective.icon || '📋'} ${qs.dailyObjective.text}</div>`;
            if (qs.dailyObjective.reward) {
                const rewardStr = Object.entries(qs.dailyObjective.reward)
                    .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                    .join('  ');
                html += `${t('<div class="quest-rewards" style="margin-top:2px;font-size:0.72rem">獎勵：')}${rewardStr}</div>`;
            }
            html += `</div></div>`;
        }

        // ============================================================
        // 支線任務
        // ============================================================
        const sideQuests = qs.sideQuests || {};
        const activeSides = Object.values(sideQuests).filter(q => q.status === 'active');
        const completedSides = Object.values(sideQuests).filter(q => q.status === 'completed');
        if (activeSides.length > 0 || completedSides.length > 0) {
            html += t('<div class="econ-section"><h3>📖 支線任務</h3>');
            html += `${t('<div style="font-size:0.75rem;color:var(--text-secondary)">進行中：')}${activeSides.length}${t(' | 已完成：')}${completedSides.length}</div>`;
            html += `</div>`;

            for (const quest of activeSides) {
                html += `<div class="quest-card quest-active" style="border-left:3px solid #e88d3f">`;
                html += `<div class="quest-title">📖 ${quest.title}</div>`;
                html += `<div class="quest-desc">${quest.description}</div>`;
                if (quest.story) {
                    html += `<div style="font-size:0.72rem;color:var(--text-secondary);font-style:italic;margin:4px 0;padding:4px 8px;border-left:2px solid rgba(232,141,63,0.4);background:rgba(232,141,63,0.05)">${quest.story}</div>`;
                }
                if (quest.objectives) {
                    html += '<div class="quest-objectives">';
                    for (const obj of quest.objectives) {
                        const pct = Math.min(100, Math.round((obj.progress / obj.target) * 100));
                        const done = obj.completed;
                        html += `<div class="quest-objective ${done ? 'done' : ''}">`;
                        html += `<span style="font-size:0.75rem">${done ? '☑' : '☐'} ${obj.label}</span>`;
                        html += `<span class="quest-obj-progress" style="font-size:0.7rem">${obj.progress}/${obj.target}</span>`;
                        html += `<div class="progress-bar" style="height:3px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${done ? 'var(--positive)' : '#e88d3f'}"></div></div>`;
                        html += '</div>';
                    }
                    html += '</div>';
                }
                if (quest.rewards) {
                    const rewardStr = Object.entries(quest.rewards)
                        .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                        .join('  ');
                    html += `${t('<div class="quest-rewards" style="margin-top:4px;font-size:0.75rem">獎勵：')}${rewardStr}</div>`;
                }
                html += '</div>';
            }

            for (const quest of completedSides) {
                html += `<div class="quest-card quest-completed">`;
                html += `<div class="quest-title">✅ ${quest.title}</div>`;
                if (quest.onComplete) {
                    html += `<div class="quest-complete-msg">${quest.onComplete}</div>`;
                }
                html += '</div>';
            }
        }

        // ============================================================
        // NPC 個人故事線
        // ============================================================
        const nq = this.state.npcQuests;
        if (nq) {
            html += t('<div class="econ-section"><h3>💫 NPC 個人故事</h3>');
            html += `${t('<div style="font-size:0.75rem;color:var(--text-secondary)">進行中：')}${nq.activeCount}${t(' | 已完成：')}${nq.completedCount}/${nq.totalDefinedCount}</div>`;
            html += `</div>`;

            // Active personal quests
            if (nq.active && nq.active.length > 0) {
                for (const quest of nq.active) {
                    html += `<div class="quest-card quest-active">`;
                    html += `<div class="quest-title">${quest.icon || '💫'} ${quest.title}</div>`;

                    // Show NPC name
                    const npcName = quest.npcId ? (this.state.agents?.[quest.npcId]?.name || quest.npcId) : '';
                    if (npcName) html += `${t('<div style="font-size:0.7rem;color:var(--accent);margin-bottom:2px">來自：')}${npcName}</div>`;

                    html += `<div class="quest-desc">${quest.description}</div>`;

                    // Routes
                    if (quest.routes) {
                        html += '<div class="quest-routes" style="margin-top:6px">';
                        for (const route of quest.routes) {
                            const condCount = route.conditions.length;
                            const condDone = route.conditions.filter(c => c.completed).length;
                            const routeComplete = condDone === condCount;

                            html += `<div class="quest-route" style="margin:6px 0;padding:6px 8px;border-radius:6px;background:${routeComplete ? 'rgba(80,200,120,0.1)' : 'rgba(255,255,255,0.03)'};border:1px solid ${routeComplete ? 'var(--positive)' : 'rgba(255,255,255,0.08)'}">`;
                            html += `<div style="font-weight:bold;font-size:0.8rem;margin-bottom:3px">${route.icon || '📋'} ${route.label}</div>`;

                            for (const cond of route.conditions) {
                                const pct = cond.target > 0 ? Math.min(100, Math.round((cond.progress / cond.target) * 100)) : 0;
                                html += `<div class="quest-objective ${cond.completed ? 'done' : ''}" style="margin:2px 0">`;
                                html += `<span style="font-size:0.75rem">${cond.completed ? '☑' : '☐'} ${cond.label}</span>`;
                                if (cond.target > 1) html += `<span class="quest-obj-progress" style="font-size:0.7rem">${cond.progress}/${cond.target}</span>`;
                                html += `<div class="progress-bar" style="height:3px;margin-top:2px"><div class="progress-fill" style="width:${pct}%;background:${cond.completed ? 'var(--positive)' : 'var(--accent)'}"></div></div>`;
                                html += '</div>';
                            }
                            html += '</div>';
                        }
                        html += '</div>';
                    }

                    // Rewards
                    if (quest.rewards) {
                        const rewardStr = Object.entries(quest.rewards)
                            .map(([r, a]) => `${rewardLabels[r] || r} ${a}`)
                            .join('  ');
                        html += `${t('<div class="quest-rewards" style="margin-top:4px;font-size:0.75rem">獎勵：')}${rewardStr}</div>`;
                    }
                    html += '</div>';
                }
            } else {
                html += t('<div class="econ-section"><p class="muted-text" style="font-size:0.8rem">提升與 NPC 的好感度來觸發個人故事線。</p></div>');
            }

            // Completed personal quests
            if (nq.completed && nq.completed.length > 0) {
                html += t('<div class="econ-section"><h3 style="color:var(--positive)">✅ 已完成的個人故事</h3>');
                for (const quest of nq.completed) {
                    const npcName = quest.npcId ? (this.state.agents?.[quest.npcId]?.name || quest.npcId) : '';
                    const route = quest.routes?.find(r => r.id === quest.completedRoute);
                    html += `<div class="quest-card quest-completed">`;
                    html += `<div class="quest-title">✅ ${quest.icon || '💫'} ${quest.title}</div>`;
                    if (npcName) html += `${t('<div style="font-size:0.7rem;color:var(--text-muted)">來自：')}${npcName}</div>`;
                    if (route) html += `${t('<div style="font-size:0.7rem;color:var(--positive);margin-top:2px">✓ 以「')}${route.icon || ''} ${route.label}${t('」完成</div>')}`;
                    html += '</div>';
                }
                html += '</div>';
            }

            // Industry bonuses from NPC affinity
            const bonusEntries = Object.entries(nq.industryBonuses || {}).filter(([,v]) => v > 0);
            if (bonusEntries.length > 0) {
                const indLabels = { woodcutting: t('🪓 伐木'), mining: t('⛏️ 採礦'), farming: t('🌾 農業'), smithing: t('⚒️ 鍛造'), trade: t('💰 貿易') };
                html += t('<div class="econ-section"><h3>📈 NPC 產業加成</h3>');
                for (const [ind, bonus] of bonusEntries) {
                    const pct = Math.round(bonus * 100);
                    html += `<div style="font-size:0.8rem;margin:2px 0">${indLabels[ind] || ind}：+${pct}%</div>`;
                }
                html += '</div>';
            }
        }

        // ============================================================
        // 聲望系統 (Reputation)
        // ============================================================
        const rep = this.state.reputationSystem;
        if (rep) {
            html += `<div class="econ-section"><h3>⭐ ${t('聲望系統')}</h3>`;
            // Tier badge
            html += `<div style="display:flex;align-items:center;gap:8px;margin:6px 0">`;
            html += `<span style="font-size:1.5rem">${rep.tierIcon}</span>`;
            html += `<div>`;
            html += `<div style="font-size:0.95rem;font-weight:bold;color:var(--accent)">${rep.tierName}</div>`;
            html += `<div style="font-size:0.72rem;color:var(--text-secondary)">${rep.tierDesc}</div>`;
            html += `</div>`;
            html += `<div style="margin-left:auto;font-size:0.85rem;font-weight:bold">⭐ ${rep.reputation}</div>`;
            html += `</div>`;
            // Progress bar to next tier
            if (rep.nextTierName) {
                html += `<div style="margin:6px 0">`;
                html += `<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-secondary)">`;
                html += `<span>${rep.tierName}</span><span>${rep.nextTierName} (${rep.nextTierMin})</span>`;
                html += `</div>`;
                html += `<div class="progress-bar" style="height:6px;margin-top:2px"><div class="progress-fill" style="width:${rep.progressToNext}%;background:linear-gradient(90deg,var(--accent),#f5c542)"></div></div>`;
                html += `</div>`;
            } else {
                html += `<div style="font-size:0.75rem;color:var(--positive);margin:4px 0">🏆 ${t('已達最高聲望！')}</div>`;
            }
            // Effects display
            html += `<div style="margin-top:8px;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:0.75rem">`;
            html += `<div style="font-weight:bold;margin-bottom:4px;color:var(--text-primary)">${t('聲望效果')}</div>`;
            const effectLabels = {
                trade_bonus: t('💰 交易加成'),
                npc_trust: t('🤝 NPC 初始信任'),
                mood_bonus: t('😊 NPC 心情加成'),
                shop_discount: t('🛒 商店折扣'),
                event_shield: t('🛡️ 事件減免'),
            };
            for (const [key, label] of Object.entries(effectLabels)) {
                const val = rep.effects[key];
                const active = val && val !== '+0' && val !== '+0%' && val !== '0%';
                html += `<div style="display:flex;justify-content:space-between;padding:1px 0;color:${active ? 'var(--text-primary)' : 'var(--text-muted)'}">`;
                html += `<span>${label}</span><span>${val}</span>`;
                html += `</div>`;
            }
            html += `</div>`;
            // Sources breakdown
            const sourceEntries = Object.entries(rep.sources || {}).filter(([,v]) => v > 0);
            if (sourceEntries.length > 0) {
                const sourceLabels = { quests: t('任務'), decisions: t('決策'), help: t('幫助NPC'), daily: t('日常'), trade: t('交易'), events: t('事件') };
                html += `<div style="margin-top:6px;font-size:0.7rem;color:var(--text-secondary)">`;
                html += `${t('聲望來源')}：`;
                html += sourceEntries.map(([k, v]) => `${sourceLabels[k] || k} ${v}`).join(' · ');
                html += `</div>`;
            }
            html += `</div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    },
});
