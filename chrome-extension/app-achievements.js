// RimTown - app-achievements.js（v8.3.0）：成就大改版
// 你是觀察者（神）：成就紀念「小鎮發生過的事」和「你身為神做過的事」（打牌、託夢、化身旅人、災厄工坊）。
// - 鍵值不變（雲端存的是 key），只改分類、文字與觸發；已解鎖的一個都不會消失。
// - 玩家時代「你親手做的事」移到「舊時代紀念」：只顯示已解鎖的，不算進總數。
// - 新系統（提案、國王、人情世故、婚喪醫療、銀行工會、宗教報社、三條科技路線、災厄工坊）補上新成就。
//   大多看日誌事件觸發（各系統寫日誌的中文範本是固定的），少數看鎮上的狀態。
// - 修正：完美主義者照實際總數、成就數量的成就（以前算錯永遠不會觸發）、計數只算目前清單裡的、城鎮等級名稱。
// 必須在 app.js、app-notify.js 之後載入。
'use strict';
const ACH_CATS = ['town', 'politics', 'ways', 'life', 'economy', 'culture', 'tech', 'god', 'special'];
const ACH_CAT_NAME = { town: '城鎮', politics: '提案與政治', ways: '人情世故', life: '愛情與人生', economy: '經濟', culture: '信仰與文化', tech: '科技路線', god: '神的工具', special: '特殊', legacy: '舊時代紀念' };
(function () {
    if (typeof ACHIEVEMENTS === 'undefined' || typeof RimTownApp === 'undefined') return;
    const A = ACHIEVEMENTS;
    const set = (k, cat, name, desc, icon) => { A[k] = Object.assign({}, A[k] || {}, { category: cat, name: t(name), desc: t(desc), icon: icon || A[k]?.icon || '🏅' }); };
    const move = (cat, keys) => { for (const k of keys) if (A[k]) A[k] = Object.assign({}, A[k], { category: cat }); };

    // ---------- 舊成就改寫 ----------
    // 神的工具:化身旅人聊天(你本人跟村民的互動)
    set('first_chat', 'god', '化身旅人', '第一次化身旅人跟村民聊天', '💬');
    set('chat_10', 'god', '常來的旅人', '化身旅人聊天 10 次', '🗣️');
    set('chat_50', 'god', '熟面孔', '化身旅人聊天 50 次', '🎙️');
    set('chat_100', 'god', '傳說中的旅人', '化身旅人聊天 100 次', '👄');
    set('chat_all_npcs', 'god', '人人都見過你', '化身旅人跟每位村民都聊過', '🤝');
    set('high_affinity', 'god', '旅人的知己', '有村民對旅人的好感達到 80', '🫂');
    set('enemy_made', 'god', '不受歡迎的旅人', '有村民對旅人的好感低於 -50', '😤');
    // 人情世故:小團體
    set('first_faction', 'ways', '小團體', '鎮上出現第一個小團體', '👥');
    set('faction_3', 'ways', '各立山頭', '鎮上同時有 3 個以上小團體', '🦋');
    set('faction_drama', 'ways', '派系鬥爭', '見證小團體之間的衝突', '🎭');
    // 愛情與人生(村民之間)
    move('life', ['npc_wedding', 'npc_couple_5', 'npc_breakup', 'npc_cheating', 'npc_fight']);
    // 提案與政治
    set('first_election', 'politics', '第一次選舉', '小鎮舉行第一次選舉', '🗳️');
    set('election_3', 'politics', '三屆選舉', '小鎮經歷三次選舉', '🏛️');
    // 城鎮:等級對上四級(村莊 → 城鎮 → 城市 → 王都)
    set('town_lv3', 'town', '升格城鎮', '村莊升格為城鎮', '🏘️');
    set('town_lv5', 'town', '城市之光', '城鎮升格為城市', '🏙️');
    set('town_lv7', 'town', '王都', '城市升格為王都', '🏰');
    set('survive_7', 'town', '第一週', '小鎮度過第一週', '📅');
    set('survive_30', 'town', '第一個月', '小鎮度過第 30 天', '🗓️');
    set('survive_100', 'town', '百日', '小鎮度過第 100 天', '🏆');
    set('survive_year', 'town', '週年慶', '小鎮度過第一年', '🎉');
    set('survive_3years', 'town', '三年老鎮', '小鎮度過第三年', '🧓');
    move('town', ['repel_raid', 'repel_5', 'repel_10', 'first_explore', 'explore_all', 'expedition_success', 'prosperity_max']);
    set('pop_15', 'town', '小鎮風光', '人口達到 15'); set('pop_20', 'town', '繁榮市鎮', '人口達到 20'); set('pop_25', 'town', '熱鬧起來', '人口達到 25'); set('pop_30', 'town', '人口爆發', '人口達到 30'); set('pop_40', 'town', '大鎮', '人口達到 40');
    // 經濟
    set('rich', 'economy', '公庫充實', '公庫超過 500 銀幣', '🤑');
    set('ultra_rich', 'economy', '富可敵國', '公庫超過 2000 銀幣', '💎');
    set('first_trade', 'economy', '商隊上門', '商隊第一次來鎮上交易', '💰');
    set('first_harvest', 'economy', '初次收穫', '鎮上第一次收成', '🌾');
    // 科技路線:研究
    move('tech', ['first_research', 'research_5', 'all_research']);
    // 信仰與文化:節慶、日報
    move('culture', ['first_festival', 'all_festivals', 'festival_5']);
    set('read_newspaper', 'culture', '第一份日報', '小鎮出了第一份日報', '📰');
    set('newspaper_10', 'culture', '日報收藏家', '累計 10 份日報', '📚');
    set('newspaper_30', 'culture', '媒體狂熱', '累計 30 份日報', '🗞️');
    // 特殊
    move('special', ['save_collector', 'multi_town']);
    set('pacifist', 'special', '太平日子', '小鎮連續 30 天沒有打架和入侵', '☮️');
    set('achievement_99', 'special', '完美主義者', '解鎖全部成就', '💯');
    // 舊時代紀念:玩家時代「你親手做的事」(已解鎖的照樣顯示,不算總數、觀察者不再頒)
    move('legacy', ['first_crush', 'first_dating', 'first_marriage', 'heartbreaker', 'rejected', 'flirt_master', 'golden_couple', 'ran_for_mayor', 'elected_mayor', 'voted', 'proposed', 'player_farmer', 'player_trader', 'player_explorer', 'speed_runner', 'first_child', 'new_game_plus', 'generation_3', 'peacemaker', 'trade_50', 'factory_order', 'factory_order_10']);

    // ---------- 新成就 ----------
    // ev:日誌範本(中文 key)符合就解鎖;fn:看鎮上的狀態
    const NEW = [
        // 城鎮
        ['pop_60', 'town', '城市規模', '人口達到 60', '🌆', { fn: (w, X) => X.pop >= 60 }],
        ['pop_100', 'town', '百人之城', '人口達到 100', '🌐', { fn: (w, X) => X.pop >= 100 }],
        // 提案與政治
        ['prop_first', 'politics', '第一件提案', '村民提出第一件提案', '📜', { fn: (w) => (w.proposals?.counter || 0) >= 2 || (w.proposals?.items || []).length >= 1 }],
        ['prop_50', 'politics', '議事頻繁', '累計 50 件提案', '🗂️', { fn: (w) => (w.proposals?.counter || 0) > 50 }],
        ['prop_petty', 'politics', '雞毛蒜皮', '有人為了鄰里小事提案擺酒和解', '🍶', { fn: (w) => (w.proposals?.items || []).some(p => p.kind === 'feast' || p.kind === 'mediate') }],
        ['prop_trial', 'politics', '公審', '村民提案審判鎮上的人', '⚖️', { fn: (w) => (w.proposals?.items || []).some(p => p.kind === 'trial') }],
        ['veto_override', 'politics', '議會反擊', '議會以三分之二推翻首長否決', '⚔️', { ev: /推翻否決/ }],
        ['crowned', 'politics', '加冕', '小鎮有了國王', '👑', { ev: /加冕為王/ }],
        ['knighted', 'politics', '冊封', '國王冊封了貴族', '⚜️', { ev: /冊封.+為/ }],
        ['coup', 'politics', '政變', '有人發動政變', '🗡️', { ev: /政變/ }],
        ['revolt', 'politics', '起義', '民眾起義推翻王室', '🏳️', { ev: /起義成功/ }],
        // 人情世故
        ['ways_casual', 'ways', '隨口提提', '提案被大比數否決後說「我本來就只是隨口提提」', '🎭', { ev: /隨口提提/ }],
        ['ways_forum', 'ways', '鄰里茶會', '不敢開口的人太多，鎮上辦了一場茶會', '🫖', { ev: /鄰里茶會辦完了/ }],
        ['ways_hyp', 'ways', '說一套做一套', '有人支持規定卻私下違反，被撞見', '🤫', { ev: /當初投票支持「/ }],
        ['ways_stingy', 'ways', '禮金風波', '禮金包太少被私下記恨', '🧧', { fn: (w) => (w.ways?.st?.stingy || 0) >= 1 }],
        ['ways_thaw', 'ways', '和好', '冷戰之後終於和好', '🤝', { ev: /終於開口打了招呼|終於和好了/ }],
        ['ways_apart', 'ways', '老死不相往來', '冷戰到最後再也不往來', '🧊', { ev: /從此不再往來/ }],
        ['ways_bench', 'ways', '點頭之交', '每天碰面卻叫不出對方的名字', '🪑', { ev: /叫不出對方的名字/ }],
        ['ways_knock', 'ways', '敲門', '有人兩天沒出現，街坊去敲門問候', '☕', { ev: /跑去敲門問候/ }],
        // 愛情與人生
        ['wedding_crash', 'life', '婚禮鬧場', '前任在婚禮上鬧場', '😤', { ev: /婚禮上鬧場/ }],
        ['funeral', 'life', '送別', '鎮上第一場葬禮', '🕯️', { ev: /的葬禮開始了/ }],
        ['transplant', 'life', '移植成功', '第一場成功的移植手術', '🫀', { ev: /完成移植/ }],
        ['myth_gene', 'life', '神話之血', '鎮上出現第一位神裔', '🐺', { fn: (w) => { try { return typeof MYTH !== 'undefined' && w.myth && MYTH.view(w).carriers.length > 0; } catch (e) { return false; } } }],
        ['elder_90', 'life', '人瑞', '有村民活到 90 歲', '🎂', { fn: (w, X) => X.alive.some(a => (a.age ?? 0) >= 90) }],
        // 經濟
        ['strike', 'economy', '罷工', '工人罷工要求加薪', '✊', { ev: /罷工/ }],
        ['bank_run', 'economy', '撐過擠兌', '銀行撐過一場擠兌', '🏦', { ev: /撐過了擠兌/ }],
        ['antitrust', 'economy', '反壟斷', '反壟斷法拆分了某人的產業', '⚖️', { ev: /反壟斷：/ }],
        // 信仰與文化
        ['bribe_exposed', 'culture', '揭弊', '收錢的事被揭穿', '🙇', { ev: /收錢的事被揭穿/ }],
        ['press_expose', 'culture', '報社揭發', '報社揭發一樁醜聞', '📰', { ev: /報社揭發/ }],
        ['heresy', 'culture', '異端', '有人被指控為異端', '🔥', { ev: /指控.+異端/ }],
        // 科技路線
        ['path_debate', 'tech', '路線大辯論', '小鎮辯論要走哪條科技路線', '🗳️', { ev: /科技路線大辯論/ }],
        ['path_electro', 'tech', '飛向太空', '電子機械路線研究到第六時代', '🚀', { fn: (w) => top6(w, 'electro') }],
        ['path_bio', 'tech', '神的藍圖', '基因生物路線研究到第六時代', '🧬', { fn: (w) => top6(w, 'bio') }],
        ['path_steam', 'tech', '以太之城', '蒸汽煉金路線研究到第六時代', '✨', { fn: (w) => top6(w, 'steam') }],
        ['nuke', 'tech', '核災', '經歷一場核災', '☢️', { ev: /核災！/ }],
        ['great_smog', 'tech', '大黑霧', '經歷一場大黑霧', '🌫️', { ev: /大黑霧/ }],
        ['rediscover', 'tech', '失而復得', '失傳的科技重新研究出來', '📜', { ev: /重新研究出來了/ }],
        // 神的工具
        ['card_first', 'god', '神之手', '第一次打出事件卡', '🃏', { fn: (w) => (w.eventCards?.played || []).length >= 1 }],
        ['card_10', 'god', '命運之手', '打出 10 張事件卡', '🎴', { fn: (w) => (w.eventCards?.played || []).length >= 10 }],
        ['dream_first', 'god', '託夢', '第一次託夢給村民', '🌙', { fn: (w) => (w.dream?.dreams || []).length >= 1 || ((w.dream?.hits || 0) + (w.dream?.misses || 0)) >= 1 }],
        ['lab_first', 'god', '災厄降臨', '第一次在災厄工坊釋放病原體', '🧪', { fn: (w) => (w.calamity?.st?.released || 0) >= 1 }],
        ['lab_cure', 'god', '疫苗問世', '小鎮靠疫苗撐過一場災厄', '💉', { fn: (w) => (w.calamity?.hist || []).some(h => h.how === 'cure') }],
        ['lab_endure', 'god', '硬撐過來', '沒有疫苗，小鎮也撐過一場災厄', '🕯️', { fn: (w) => (w.calamity?.hist || []).some(h => h.how === 'endure' && h.survived !== false && (h.died || 0) > 0) }],
        ['lab_boom', 'god', '說謊爆炸', '得了說謊病的人說謊當場爆炸', '💥', { ev: /當場爆炸/ }],
        ['lab_panacea', 'god', '萬靈藥', '疫情裡賣的萬靈藥被拆穿', '🧴', { ev: /大家這才知道/ }],
        ['lab_lesson', 'god', '吃過虧才學乖', '小鎮記得上次的疫情，這次早一點防疫', '📖', { ev: /老一輩想起/ }],
    ];
    function top6(w, path) { try { return typeof TECH !== 'undefined' && Object.values(w.research?.projects || {}).some(p => p.era === 6 && p.status === 'complete' && TECH.onPath(p.key, path)); } catch (e) { return false; } }
    for (const [k, cat, name, desc, icon] of NEW) set(k, cat, name, desc, icon);
    const EV = NEW.filter(x => x[5].ev).map(x => [x[0], x[5].ev]);
    const FN = NEW.filter(x => x[5].fn).map(x => [x[0], x[5].fn]);
    const OBS_OFF = new Set(['ran_for_mayor', 'elected_mayor', 'peacemaker', 'voted', 'proposed', 'player_farmer', 'player_trader', 'player_explorer', 'speed_runner', 'first_child']);
    const counted = (k, a) => a && a.category !== 'legacy' && a.category !== 'player' && !OBS_OFF.has(k);

    // 日誌事件 → 成就(World 寫日誌時順便看一下;成就解鎖本身的日誌不算)
    if (typeof World !== 'undefined' && World.prototype.logMessageT && !World.prototype.logMessageT.__ach) {
        const _lm = World.prototype.logMessageT;
        const g = function (cat, key, ...rest) { const r = _lm.call(this, cat, key, ...rest); try { if (typeof key === 'string' && !key.startsWith('成就解鎖')) { const app = typeof window !== 'undefined' ? window.rimtownApp : null; if (app && app.world === this) app._achOnLog(key); } } catch (e) {} return r; };
        g.__ach = true; World.prototype.logMessageT = g;
    }

    Object.assign(RimTownApp.prototype, {
        _achOnLog(key) { for (const [k, re] of EV) if (!this._unlockedAchievements.has(k) && re.test(key)) this._unlockAchievement(k); },
        _achCheckNew() {
            const w = this.world; if (!w) return;
            const alive = Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
            const X = { alive, pop: alive.length };
            for (const [k, fn] of FN) { if (this._unlockedAchievements.has(k)) continue; let ok = false; try { ok = !!fn(w, X); } catch (e) {} if (ok) this._unlockAchievement(k); }
            // 人口:只算活著的村民(以前把旅人、死去的人也算進去)
            for (const [k, n] of [['pop_15', 15], ['pop_20', 20], ['pop_25', 25], ['pop_30', 30], ['pop_40', 40]]) if (X.pop >= n) this._unlockAchievement(k);
            // 城鎮等級:四級
            try { if (typeof TIERS !== 'undefined') { const lv = TIERS.level(w); if (lv >= 1) this._unlockAchievement('town_lv3'); if (lv >= 2) this._unlockAchievement('town_lv5'); if (lv >= 3) this._unlockAchievement('town_lv7'); } } catch (e) {}
            // 商隊上門(以前要玩家親手交易)
            if ((w.trade?.tradeHistory || []).length >= 1 || (w.trade?.stats?.trades || 0) >= 1) this._unlockAchievement('first_trade');
            // 成就數量:只算目前清單裡的
            const total = Object.entries(A).filter(([k, a]) => counted(k, a)).length; let have = 0; for (const k of this._unlockedAchievements) if (counted(k, A[k])) have++;
            if (have >= 25) this._unlockAchievement('achievement_25'); if (have >= 50) this._unlockAchievement('achievement_50');
            if (have >= total - 1 && !this._unlockedAchievements.has('achievement_99')) this._unlockAchievement('achievement_99'); // 除了自己以外都拿到了
        },
        renderAchievements(container) {
            const esc = (s) => (this._escapeHtml ? this._escapeHtml(String(s ?? '')) : String(s ?? ''));
            const all = Object.entries(A).filter(([k, a]) => counted(k, a));
            let have = 0; for (const [k] of all) if (this._unlockedAchievements.has(k)) have++;
            let html = `<div class="achievements-panel"><h3>${t('成就')} <span class="ach-count">${have}/${all.length}</span></h3>`;
            const card = (key, def) => { const on = this._unlockedAchievements.has(key); return `<div class="ach-card ${on ? 'unlocked' : 'locked'}"><span class="ach-icon">${on ? def.icon : '🔒'}</span><div class="ach-info"><div class="ach-name">${esc(def.name)}</div><div class="ach-desc">${esc(def.desc)}</div></div></div>`; };
            for (const cat of ACH_CATS) {
                const achs = all.filter(([, a]) => a.category === cat); if (!achs.length) continue;
                const n = achs.filter(([k]) => this._unlockedAchievements.has(k)).length;
                html += `<div class="ach-category"><h4>${t(ACH_CAT_NAME[cat])} <small class="ach-cat-n">${n}/${achs.length}</small></h4><div class="ach-grid">${achs.map(([k, a]) => card(k, a)).join('')}</div></div>`;
            }
            const old = Object.entries(A).filter(([k, a]) => !counted(k, a) && this._unlockedAchievements.has(k));
            if (old.length) html += `<details class="ach-category ach-legacy"><summary><h4>📦 ${t(ACH_CAT_NAME.legacy)} <small class="ach-cat-n">${old.length}</small></h4></summary><div class="ach-note">${t('玩家時代拿到的成就，留作紀念，不算進總數。')}</div><div class="ach-grid">${old.map(([k, a]) => card(k, a)).join('')}</div></details>`;
            html += '</div>';
            container.innerHTML = html;
        },
    });
    // 每 5 秒的成就檢查順便跑新的
    const _ck = RimTownApp.prototype._checkAchievements;
    RimTownApp.prototype._checkAchievements = function (...args) { const r = _ck.apply(this, args); const saved = this._achFirstCheckDone; if (!this._achNewOnce) this._achFirstCheckDone = false; /* 第一輪補發的舊帳靜默入袋,不洗版 */ try { this._achCheckNew(); } catch (e) { console.warn('[Achievements]', e); } this._achFirstCheckDone = saved; this._achNewOnce = true; return r; };
})();
