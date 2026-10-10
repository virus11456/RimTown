// RimTown - Frontend App (WordPress Plugin) v6.0.0
const RIMTOWN_APP_VERSION = '6.0.0';
// v5.76.0 鄰鎮解鎖表:到達繁榮度就打通道路、在背景生成該鎮存檔(每鎮一次,永不自動刪)
const NEIGHBOR_TOWNS = [
    { theme: 'harbor', name: '海風鎮', prosperity: 20, key: 'rimtown_harbor_unlocked', match: /海風鎮|Seabreeze/i, icon: '🛤️',
      log: () => t('📯 沿海道路修復完成，往海風鎮的馬車恢復通行！'), title: () => t('道路重通！'),
      desc: () => t('通往漁村「海風鎮」的沿海道路修好了——去東邊的馬車站就能搭車拜訪，兩鎮的村民也會開始互相作客') },
    { theme: 'mountain', name: '礦山鎮', prosperity: 40, key: 'rimtown_mountain_unlocked', match: /礦山鎮|Mine Ridge/i, icon: '⛏️',
      log: () => t('📯 山道來信：礦山鎮的吊橋修好了，往山上的馬車開通！'), title: () => t('山道來信！'),
      desc: () => t('山上的礦業小鎮「礦山鎮」捎信來：吊橋修好了，馬車可以上山。那裡石材金屬多、糧食布料缺，正好和邊境鎮互補') },
    { theme: 'forest', name: '林間村', prosperity: 60, key: 'rimtown_forest_unlocked', match: /林間村|Greenwood/i, icon: '🌲',
      log: () => t('📯 林道開通：獵戶把林間村的密林小徑清出來了，馬車可以進林子！'), title: () => t('林道開通！'),
      desc: () => t('密林裡的「林間村」獵戶清出一條馬車道：那裡木材草藥多、石材金屬缺，古樹祭壇與篝火場等你去看看') },
    { theme: 'market', name: '市集城', prosperity: 80, key: 'rimtown_market_unlocked', match: /市集城|Market City/i, icon: '🏛️',
      log: () => t('📯 商會來函：市集城向邊境鎮開放城門，五鎮馬車全線通車！'), title: () => t('商會來函！'),
      desc: () => t('平原上的交通樞紐「市集城」向你開放城門：商會、書院、大市集廣場與商隊營地都在那裡，銀幣布料多、原料缺，是五鎮貿易的中心') },
];
// v5.76.0 主題鎮的任務分頁占位(主線任務只屬於邊境鎮)
const TOWN_STORY_BLURBS = {
    harbor: { icon: '🌊', title: '海風鎮的故事', text: '這座漁村沒有既定的劇本——阿潮的暗戀、石叔與燈爺的舊怨、雲姨未說完的往事，都在日常裡自己發生。多跟大家聊聊，故事會找上你。' },
    mountain: { icon: '⛏️', title: '礦山鎮的故事', text: '這座礦業小鎮沒有既定的劇本——阿岩算出的金脈、老錘與牛叔的塌方舊怨、白姑想寄出去的那封信、牛叔盤算的接班，都在日常裡自己發生。多跟大家聊聊，故事會找上你。' },
    forest: { icon: '🌲', title: '林間村的故事', text: '這座林間小村沒有既定的劇本——阿松送出的第十四隻木雕、守林人與伐木場的拉扯、老樵口中那棵不能砍的樹、林姥年輕時進林子的原因，都在日常裡自己發生。多跟大家聊聊，故事會找上你。' },
    market: { icon: '🏛️', title: '市集城的故事', text: '這座商城沒有既定的劇本——老帳發現的那筆不該存在的款項、綵姑等的那個人、阿算背完的整本算經、窯叔與商會的壓價之爭、駝姐帶回來的五鎮消息，都在日常裡自己發生。多跟大家聊聊，故事會找上你。' },
};
const ELECTION_POLICIES_LABELS = {economy:t('經濟發展'),welfare:t('社會福利'),defense:t('軍事防禦'),culture:t('文化教育'),nature:t('自然保育'),freedom:t('個人自由')};

// =====================================================
// Achievement Definitions (99 achievements)
// =====================================================
const ACHIEVEMENTS = {
    // === Social (13) ===
    first_chat: { name: t('初次對話'), desc: t('第一次與居民聊天'), icon: '💬', category: 'social' },
    chat_10: { name: t('話癆'), desc: t('與居民聊天10次'), icon: '🗣️', category: 'social' },
    chat_50: { name: t('社交達人'), desc: t('與居民聊天50次'), icon: '🎙️', category: 'social' },
    chat_100: { name: t('聊天之王'), desc: t('與居民聊天100次'), icon: '👄', category: 'social' },
    chat_all_npcs: { name: t('全民好友'), desc: t('與每位居民都聊過天'), icon: '🤝', category: 'social' },
    high_affinity: { name: t('知己'), desc: t('與任一居民好感度達到80'), icon: '🫂', category: 'social' },
    enemy_made: { name: t('結怨'), desc: t('與任一居民好感度低於-50'), icon: '😤', category: 'social' },
    first_faction: { name: t('結黨'), desc: t('加入第一個社交圈'), icon: '👥', category: 'social' },
    faction_3: { name: t('社交蝴蝶'), desc: t('城鎮出現3個以上派系'), icon: '🦋', category: 'social' },
    faction_drama: { name: t('戲劇性'), desc: t('見證派系衝突'), icon: '🎭', category: 'social' },
    npc_fight: { name: t('暴力事件'), desc: t('目擊 NPC 打架住院'), icon: '🤕', category: 'social' },
    npc_cheating: { name: t('八點檔'), desc: t('目擊劈腿被抓事件'), icon: '😱', category: 'social' },
    npc_breakup: { name: t('分手見證人'), desc: t('目擊一對情侶分手'), icon: '💢', category: 'social' },
    // === Romance (10) ===
    first_crush: { name: t('心動'), desc: t('有人對你產生好感'), icon: '💗', category: 'romance' },
    first_dating: { name: t('初戀'), desc: t('開始與某人交往'), icon: '💕', category: 'romance' },
    first_marriage: { name: t('白頭偕老'), desc: t('與某人結婚'), icon: '💍', category: 'romance' },
    heartbreaker: { name: t('渣男/渣女'), desc: t('與3個以上的人交往過'), icon: '💔', category: 'romance' },
    npc_wedding: { name: t('婚禮祝福'), desc: t('見證一對NPC結婚'), icon: '💒', category: 'romance' },
    npc_couple_5: { name: t('月老'), desc: t('城鎮中同時有5對情侶'), icon: '🏹', category: 'romance' },
    rejected: { name: t('心碎'), desc: t('求婚被拒絕'), icon: '😢', category: 'romance' },
    flirt_master: { name: t('調情高手'), desc: t('成功調情5次'), icon: '😘', category: 'romance' },
    golden_couple: { name: t('模範夫妻'), desc: t('結婚後好感度維持90以上'), icon: '👫', category: 'romance' },
    // === Economy (24) ===
    first_trade: { name: t('商人初體驗'), desc: t('完成第一筆交易'), icon: '💰', category: 'economy' },
    trade_50: { name: t('交易老手'), desc: t('完成50筆交易'), icon: '💳', category: 'economy' },
    rich: { name: t('富甲一方'), desc: t('銀幣超過500'), icon: '🤑', category: 'economy' },
    ultra_rich: { name: t('富可敵國'), desc: t('銀幣超過2000'), icon: '💎', category: 'economy' },
    builder: { name: t('建設者'), desc: t('建造第一棟建築'), icon: '🏗️', category: 'economy' },
    master_builder: { name: t('建築大師'), desc: t('建造5棟建築'), icon: '🏰', category: 'economy' },
    all_buildings: { name: t('鎮之完善'), desc: t('建造所有建築'), icon: '🌆', category: 'economy' },
    first_upgrade: { name: t('精益求精'), desc: t('首次升級建築'), icon: '🔧', category: 'economy' },
    max_upgrade: { name: t('登峰造極'), desc: t('將建築升級至最高等級'), icon: '🏯', category: 'economy' },
    first_research: { name: t('學者'), desc: t('完成第一項研究'), icon: '📚', category: 'economy' },
    research_5: { name: t('博學多才'), desc: t('完成5項研究'), icon: '🎓', category: 'economy' },
    all_research: { name: t('科技先驅'), desc: t('完成所有研究'), icon: '🔬', category: 'economy' },
    first_industry: { name: t('創業家'), desc: t('開啟第一個產業'), icon: '🏭', category: 'economy' },
    industry_lv3: { name: t('產業升級'), desc: t('任一產業升到 Lv3'), icon: '⚒️', category: 'economy' },
    industry_lv5: { name: t('產業帝國'), desc: t('任一產業升到 Lv5'), icon: '👑', category: 'economy' },
    two_industries: { name: t('雙線發展'), desc: t('同時擁有兩個產業'), icon: '🔀', category: 'economy' },
    four_industries: { name: t('完全體'), desc: t('解鎖全部四大產業'), icon: '🌟', category: 'economy' },
    first_harvest: { name: t('初次收穫'), desc: t('第一次收穫農作物'), icon: '🌾', category: 'economy' },
    harvest_100: { name: t('豐收之王'), desc: t('累計收穫 100 單位作物'), icon: '🌽', category: 'economy' },
    harvest_500: { name: t('農業大亨'), desc: t('累計收穫 500 單位作物'), icon: '🚜', category: 'economy' },
    excellent_crop: { name: t('極品農產'), desc: t('收穫極品品質作物'), icon: '✨', category: 'economy' },
    first_factory: { name: t('工廠主'), desc: t('建造第一座工廠'), icon: '🏭', category: 'economy' },
    factory_order: { name: t('訂單達人'), desc: t('完成第一筆工廠訂單'), icon: '📋', category: 'economy' },
    factory_order_10: { name: t('量產專家'), desc: t('完成10筆工廠訂單'), icon: '📦', category: 'economy' },
    resource_hoarder: { name: t('囤積狂'), desc: t('任一資源超過200單位'), icon: '🏪', category: 'economy' },
    // === Survival (12) ===
    survive_7: { name: t('一週生存'), desc: t('存活7天'), icon: '📅', category: 'survival' },
    survive_30: { name: t('月生存者'), desc: t('存活30天'), icon: '🗓️', category: 'survival' },
    survive_100: { name: t('百日英雄'), desc: t('存活100天'), icon: '🏆', category: 'survival' },
    survive_year: { name: t('週年慶'), desc: t('存活一整年'), icon: '🎉', category: 'survival' },
    survive_3years: { name: t('老居民'), desc: t('存活三年'), icon: '🧓', category: 'survival' },
    repel_raid: { name: t('防衛者'), desc: t('擊退第一次入侵'), icon: '⚔️', category: 'survival' },
    repel_5: { name: t('常勝將軍'), desc: t('擊退5次入侵'), icon: '🎖️', category: 'survival' },
    repel_10: { name: t('鐵壁防線'), desc: t('擊退10次入侵'), icon: '🛡️', category: 'survival' },
    first_explore: { name: t('探險家'), desc: t('發現第一個探索區域'), icon: '🗺️', category: 'survival' },
    explore_all: { name: t('全境探索'), desc: t('發現所有探索區域'), icon: '🧭', category: 'survival' },
    expedition_success: { name: t('凱旋歸來'), desc: t('完成第一次成功探險'), icon: '🏆', category: 'survival' },
    // === Town (14) ===
    pop_15: { name: t('小鎮風光'), desc: t('人口達到15'), icon: '🏘️', category: 'town' },
    pop_20: { name: t('繁榮市鎮'), desc: t('人口達到20'), icon: '🌇', category: 'town' },
    pop_25: { name: t('邊境都市'), desc: t('人口達到25'), icon: '🌃', category: 'town' },
    pop_30: { name: t('人口爆發'), desc: t('人口達到30'), icon: '🏙️', category: 'town' },
    pop_40: { name: t('大都會'), desc: t('人口達到40'), icon: '🌐', category: 'town' },
    first_election: { name: t('民主初體驗'), desc: t('參與第一次選舉'), icon: '🗳️', category: 'town' },
    elected_mayor: { name: t('當選鎮長'), desc: t('玩家當選鎮長'), icon: '👑', category: 'town' },
    election_3: { name: t('政壇老手'), desc: t('經歷3次選舉'), icon: '🏛️', category: 'town' },
    ran_for_mayor: { name: t('初生之犢'), desc: t('登記參選鎮長'), icon: '📢', category: 'town' },
    peacemaker: { name: t('和事佬'), desc: t('促成一對絕交的村民世紀大和解'), icon: '🕊️', category: 'social' },
    elected_mayor: { name: t('民選鎮長'), desc: t('贏得鎮長選舉'), icon: '👑', category: 'town' },
    first_birth: { name: t('新生命'), desc: t('城鎮迎來第一個新生兒'), icon: '👶', category: 'town' },
    births_5: { name: t('嬰兒潮'), desc: t('累計5個新生兒出生'), icon: '🍼', category: 'town' },
    first_death: { name: t('永別'), desc: t('失去第一位居民'), icon: '⚰️', category: 'town' },
    town_lv3: { name: t('村莊崛起'), desc: t('城鎮升級到村莊'), icon: '🏘️', category: 'town' },
    town_lv5: { name: t('城鎮繁榮'), desc: t('城鎮升級到城鎮'), icon: '🏙️', category: 'town' },
    town_lv7: { name: t('大都市'), desc: t('城鎮升級到城市'), icon: '🌆', category: 'town' },
    // === Player (12) ===
    voted: { name: t('公民責任'), desc: t('在選舉中投票'), icon: '✅', category: 'player' },
    proposed: { name: t('求婚'), desc: t('向某人求婚'), icon: '💎', category: 'player' },
    player_farmer: { name: t('自耕農'), desc: t('親手種植並收穫一次作物'), icon: '🧑‍🌾', category: 'player' },
    player_trader: { name: t('商賈'), desc: t('累計交易額達到1000銀幣'), icon: '🪙', category: 'player' },
    player_explorer: { name: t('冒險王'), desc: t('完成3次成功探險'), icon: '⛰️', category: 'player' },
    speed_runner: { name: t('速通玩家'), desc: t('在30天內建造5棟建築'), icon: '⚡', category: 'player' },
    pacifist: { name: t('和平主義者'), desc: t('存活30天且零衝突事件'), icon: '☮️', category: 'player' },
    save_collector: { name: t('存檔狂'), desc: t('儲存遊戲10次以上'), icon: '💾', category: 'player' },
    multi_town: { name: t('開拓者'), desc: t('擁有3個以上城鎮'), icon: '🗺️', category: 'player' },
    // === Special (14) ===
    night_owl: { name: t('夜貓子'), desc: t('在深夜（0-4點）仍在活動'), icon: '🦉', category: 'special' },
    early_bird: { name: t('早起的鳥'), desc: t('在清晨（5-6點）開始活動'), icon: '🐓', category: 'special' },
    gossip_heard: { name: t('八卦通'), desc: t('聽到10則村民對話'), icon: '👂', category: 'special' },
    gossip_50: { name: t('偷聽大師'), desc: t('聽到50則村民對話'), icon: '🕵️', category: 'special' },
    gossip_200: { name: t('情報局長'), desc: t('聽到200則村民對話'), icon: '📡', category: 'special' },
    all_seasons: { name: t('四季輪轉'), desc: t('經歷春夏秋冬'), icon: '🌸', category: 'special' },
    first_festival: { name: t('節慶參與'), desc: t('經歷第一個節日'), icon: '🎪', category: 'special' },
    all_festivals: { name: t('四季慶典'), desc: t('經歷所有四個節日'), icon: '🎊', category: 'special' },
    festival_5: { name: t('慶典常客'), desc: t('累計經歷5次節慶'), icon: '🥳', category: 'special' },
    read_newspaper: { name: t('讀報人'), desc: t('閱讀第一篇 AI 日報'), icon: '📰', category: 'special' },
    newspaper_10: { name: t('日報收藏家'), desc: t('累計 10 篇日報'), icon: '📚', category: 'special' },
    newspaper_30: { name: t('媒體狂熱'), desc: t('累計 30 篇日報'), icon: '🗞️', category: 'special' },
    cloud_sync: { name: t('雲端玩家'), desc: t('首次使用雲端同步'), icon: '☁️', category: 'special' },
    prosperity_max: { name: t('傳奇小鎮'), desc: t('繁榮度達到「傳奇」等級'), icon: '⭐', category: 'special' },
    achievement_25: { name: t('成就獵人'), desc: t('解鎖25個成就'), icon: '🏅', category: 'special' },
    achievement_50: { name: t('成就大師'), desc: t('解鎖50個成就'), icon: '🥇', category: 'special' },
    achievement_99: { name: t('完美主義者'), desc: t('解鎖全部99個成就'), icon: '💯', category: 'special' },
    // === Legacy (3) ===
    first_child: { name: t('為人父母'), desc: t('生下第一個孩子'), icon: '👶', category: 'legacy' },
    new_game_plus: { name: t('二周目'), desc: t('開始第二代的旅程'), icon: '🔄', category: 'legacy' },
    generation_3: { name: t('三代傳承'), desc: t('進入第三代'), icon: '👑', category: 'legacy' },
};

// =====================================================
// Cloud Auth Client
// =====================================================
class RimTownAuth {
    constructor() {
        this.loggedIn = false;
        this.username = '';
        this.userId = 0;
        this._restUrl = '';
        this._nonce = '';
        this._initFromWP();
    }

    _initFromWP() {
        if (typeof rimtownAuth !== 'undefined') {
            this._restUrl = rimtownAuth.restUrl;
            this._nonce = rimtownAuth.nonce;
            this.loggedIn = !!rimtownAuth.loggedIn;
            this.username = rimtownAuth.username || '';
            this.userId = rimtownAuth.userId || 0;
        } else if (location.protocol.startsWith('http')) {
            // Serverless 模式(Vercel 靜態站):帳號 API 在同網域 /api/,JWT 存 localStorage
            this._serverless = true;
            this._restUrl = '/api/';
            try { this._nonce = localStorage.getItem('rimtown_jwt') || ''; } catch (e) { this._nonce = ''; }
            // 從 token 還原登入狀態(重新整理後仍保持登入)
            if (this._nonce) {
                try {
                    const p = JSON.parse(atob(this._nonce.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                    if (p.exp * 1000 > Date.now()) {
                        this.loggedIn = true;
                        this.username = p.u || '';
                        this.userId = p.id || 0;
                    } else {
                        this._nonce = '';
                        try { localStorage.removeItem('rimtown_jwt'); } catch (e) {}
                    }
                } catch (e) { this._nonce = ''; }
            }
        }
    }

    async _fetch(endpoint, method = 'GET', body = null) {
        const isPublic = ['login', 'register', 'reset-password', 'me'].includes(endpoint);
        const headers = { 'Content-Type': 'application/json' };
        if (!isPublic && this._nonce) headers['X-WP-Nonce'] = this._nonce;
        if (this._serverless && this._nonce) headers['Authorization'] = 'Bearer ' + this._nonce;
        const opts = {
            method,
            headers,
            credentials: 'same-origin',
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(this._restUrl + endpoint, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.code || 'API error');
        return data;
    }

    // Serverless 模式:token 持久化
    _persistToken() {
        if (!this._serverless) return;
        try {
            if (this._nonce) localStorage.setItem('rimtown_jwt', this._nonce);
            else localStorage.removeItem('rimtown_jwt');
        } catch (e) { /* private mode 等情況忽略 */ }
    }

    async register(username, password, email, invite) {
        const data = await this._fetch('register', 'POST', { username, password, email, invite });
        if (data.nonce) this._nonce = data.nonce;
        this.loggedIn = true;
        this.username = data.user.username;
        this.userId = data.user.id;
        this._persistToken();
        return data;
    }

    async login(username, password) {
        const data = await this._fetch('login', 'POST', { username, password });
        if (data.nonce) this._nonce = data.nonce;
        this.loggedIn = true;
        this.username = data.user.username;
        this.userId = data.user.id;
        this._persistToken();
        return data;
    }

    async logout() {
        await this._fetch('logout', 'POST');
        this.loggedIn = false;
        this.username = '';
        this.userId = 0;
        this._nonce = '';
        this._persistToken();
    }

    // v5.66.0 帳號自救:用目前有效的登入憑證重建遺失的帳號紀錄
    async repairAccount(newPassword) {
        const data = await this._fetch('me', 'POST', { action: 'repair', new_password: newPassword });
        if (data.nonce) { this._nonce = data.nonce; this._persistToken(); }
        return data;
    }

    async checkLogin() {
        const data = await this._fetch('me');
        this.loggedIn = data.logged_in;
        this.username = data.user?.username || '';
        this.userId = data.user?.id || 0;
        this.isAdmin = !!data.is_admin; // v5.63.0
        if (!data.logged_in) { this._nonce = ''; this._persistToken(); }
        return data;
    }

    // v5.63.0 管理員操作(僅 serverless 站;身分由伺服器 ADMIN_USERS 判定)
    async adminListUsers() { const d = await this._fetch('admin?action=users'); return { users: d.users || [], storage: d.storage || null }; }
    async adminUsage() { const d = await this._fetch('admin?action=usage'); return d.days || []; } // v5.96.0 B8 AI 用量
    async adminAction(action, username, extra = {}) { return this._fetch('admin', 'POST', { action, username, ...extra }); }
    // v5.68.0 推薦碼管理
    async adminInvites() { const d = await this._fetch('admin?action=invites'); return d.invites || []; }
    async adminInvite(action, extra = {}) { return this._fetch('admin', 'POST', { action, ...extra }); }

    // Cloud save operations
    async listSaves() {
        const data = await this._fetch('saves');
        return data.saves || [];
    }

    async cloudSave(townId, townName, saveData, meta) {
        const body = {
            town_id: townId,
            town_name: townName,
            save_data: typeof saveData === 'string' ? saveData : JSON.stringify(saveData),
            season: meta.season || '',
            year: meta.year || 1,
            day: meta.day || 1,
            population: meta.population || 0,
        };
        // v5.64.1 玩家明確要用較舊的存檔(匯入)時強制覆寫;其餘情況伺服器會擋掉「舊蓋新」
        if (this.forceNextSave) { body.force = true; this.forceNextSave = false; }
        return this._fetch('save', 'POST', body);
    }

    async cloudLoad(townId) {
        const data = await this._fetch('save/' + townId);
        return typeof data.save_data === 'string' ? JSON.parse(data.save_data) : data.save_data;
    }

    async cloudDelete(townId) {
        return this._fetch('save/' + townId, 'DELETE');
    }

    // v5.33.0 帳號設定同步:AI 供應商/金鑰/額度隨帳號走(伺服器端加密保存)
    async getCloudSettings() {
        const d = await this._fetch('settings');
        return d.settings || null;
    }

    async saveCloudSettings(settings) {
        return this._fetch('settings', 'POST', settings);
    }

    // Achievements
    async getAchievements() {
        const data = await this._fetch('achievements');
        return data.achievements || [];
    }

    async unlockAchievement(key, townId) {
        return this._fetch('achievements', 'POST', { key, town_id: townId });
    }
}

class RimTownApp {
    constructor() {
        this.world = new World();
        this.state = null;
        this.selectedAgent = null;
        this.activeTab = 'residents';
        this.chatTarget = null;
        this.chatSending = false;
        this._chatUnread = new Set();
        this.agentColors = {};
        this.colorPalette = [
            '#e94560','#4ade80','#60a5fa','#fbbf24','#a78bfa',
            '#f472b6','#34d399','#38bdf8','#fb923c','#c084fc',
            '#22d3ee','#f87171',
        ];
        this.simInterval = null;
        this.simSpeed = 2000;
        this.llmClient = null;
        this.tileMap = null;
        this._mapGenerated = false;
        this._viewingArchive = null;
        this.currentTownId = null;
        // v2.0 — Auth + Achievements
        this.guestMode = false;
        this.auth = new RimTownAuth();
        this._unlockedAchievements = new Set();
        this._achievementQueue = []; // Toast queue
        this._chatCount = 0;
        this._chattedNpcs = new Set();
        this._raidCount = 0;
        this._seasonsVisited = new Set();
        this._npcConvosSeen = 0;
        this._tradeCount = 0;
        this._flirtCount = 0;
        this._datingHistory = new Set();
        this.init();
    }

    async init() {
        this.setupEventDelegation();
        // v5.68.0 首頁(Landing):Vercel 版一律先看首頁。未登入只能註冊/登入(不啟動世界);
        // 已登入在底下載好世界、暫停等你按「繼續遊戲」。登入/註冊成功後帶 rimtown_enter_now 重載直接進遊戲。
        this._landingActive = false;
        if (this.auth._serverless) {
            let enterNow = false;
            try { enterNow = sessionStorage.getItem('rimtown_enter_now') === '1'; if (enterNow) sessionStorage.removeItem('rimtown_enter_now'); } catch (e) {}
            if (!this.auth.loggedIn) {
                this._landingActive = true; this._landingMode = 'auth';
                this.setupAuthListeners();
                this._renderLanding(); this._showLanding();
                return; // 一律要登入才能玩
            }
            if (!enterNow) { this._landingActive = true; this._landingMode = 'continue'; this._renderLanding(); this._showLanding(); }
        }
        // v5.33.0 已登入就先拉帳號雲端的 AI 設定,再據以建立 LLM client
        if (this.auth.loggedIn) { try { await this._pullCloudSettings(); } catch (e) {} }
        await this.loadSettings();
        // v5.62.1 一次性遷移:清掉城鎮列表裡同名的「第1天孤兒」重複條目
        this._dedupeTownList();
        // Try to load saved game
        let loaded = false;
        if (this.auth.loggedIn) {
            // When logged in, only load from cloud — skip local saves
            try {
                const saves = await this.auth.listSaves();
                if (saves.length > 0) {
                    // v5.62.1 優先回到上次玩的鎮,而不是雲端清單第一筆
                    const lastTown = localStorage.getItem('rimtown_last_town');
                    const cloudMatch = saves.find(s => s.town_id === lastTown) || saves[0];
                    const cloudData = await this.auth.cloudLoad(cloudMatch.town_id);
                    // v5.63.0 雲端與本機同一鎮比新舊(tickCount),雲端寫入曾失敗時不再載到舊進度
                    let localData = null;
                    try { const j = localStorage.getItem('rimtown_town_' + cloudMatch.town_id); if (j) localData = JSON.parse(j); } catch (e) {}
                    const saveData = this._newerSave(cloudData, localData);
                    if (saveData && this.world.loadSave(saveData)) {
                        this.currentTownId = cloudMatch.town_id;
                        this._cloudSaves = saves;
                        loaded = true;
                        console.log('[RimTown] Loaded on init:', cloudMatch.town_name, saveData === localData && cloudData ? '(本機較新)' : '(雲端)');
                        // 本機較新就回填雲端
                        if (saveData === localData && cloudData) { this.saveGame().catch(() => {}); }
                    }
                    // v5.64.1 存檔保護原則:程式絕不自動刪除任何雲端存檔(v5.62.1 的雲端去重已移除;
                    // 同名重複條目改由列表顯示處理,要刪只能由玩家/管理員手動)
                }
            } catch (e) {
                console.error('[RimTown] Cloud load on init failed:', e);
            }
            if (!loaded) {
                // v5.62.1 雲端拿不到時先試本地存檔(v5.59.1 起切鎮有雙寫本地檔),
                // 不再直接開新世界+領新 id——那正是列表裡 Day1 孤兒條目的製造機
                const tryIds = [localStorage.getItem('rimtown_last_town'),
                    ...this._getTownList().map(tw => tw.id)].filter(Boolean);
                for (const tid of tryIds) {
                    if (this._loadTownById(tid)) { loaded = true; break; }
                }
            }
            if (!loaded) {
                this.world.reset();
                // v5.68.0 首頁註冊流程:新帳號重載後在這裡建立「<帳號>的邊境鎮」並同步雲端
                const pendingName = localStorage.getItem('rimtown_pending_town_name');
                if (pendingName) {
                    localStorage.removeItem('rimtown_pending_town_name');
                    this.currentTownId = this._generateTownId(pendingName);
                    this._saveCurrentTown(pendingName);
                    this._syncToCloud().catch(() => {});
                } else {
                    // v5.62.1 沿用既有同名條目的 id(覆寫同一 slot),沒有才產新 id
                    const orphan = this._getTownList().find(tw => tw.name === '邊境鎮');
                    this.currentTownId = orphan?.id || this._generateTownId('邊境鎮');
                }
            }
        } else {
            // Not logged in — use local saves
            const lastTownId = localStorage.getItem('rimtown_last_town');
            if (lastTownId) {
                loaded = this._loadTownById(lastTownId);
            }
            if (!loaded) {
                // v5.62.1 last_town 失效時先試列表裡其他有存檔的鎮(新到舊)
                const rest = this._getTownList()
                    .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
                for (const tw of rest) {
                    if (this._loadTownById(tw.id)) { loaded = true; break; }
                }
            }
            if (!loaded) {
                const legacyLoaded = await this.tryLoadGame();
                const orphan = this._getTownList().find(tw => tw.name === '邊境鎮');
                if (legacyLoaded) {
                    this.currentTownId = orphan?.id || this._generateTownId('邊境鎮');
                    this._saveCurrentTown('邊境鎮');
                } else {
                    this.world.reset();
                    this.currentTownId = orphan?.id || this._generateTownId('邊境鎮');
                    this._saveCurrentTown('邊境鎮');
                }
            }
        }
        if (this.llmClient) {
            this.world.conversationEngine = this._makeConversationEngine();
            console.log('[RimTown] ConversationEngine initialized with LLM:', this.llmClient.provider);
        } else {
            console.log('[RimTown] WARNING: No LLM client — conversations will use fallback templates');
        }
        this._hookConversationBubbles();
        this._updateLLMStatus();
        this.state = this.world.getState();
        this.setupTileMap();
        this.setupTabListeners();
        this.setupMobileSidebar();
        this.setupMobileInputFix();
        this.setupMobileHeader();
        this.setupControlListeners();
        this.setupSettingsListeners();
        this.setupBGM();
        this.setupAuthListeners();
        if (!this._landingActive) this.setupTutorial(); // v5.68.0 首頁關掉後才開教學
        this._updateAccountButton();
        this._loadAchievementsFromCloud();
        // Cloud data is already loaded in init() when logged in, no need to sync again
        if (this._landingActive) { this._pausedForLanding = true; this.world.paused = true; } // v5.68.0 首頁期間不跑模擬
        this.startSimulation();
        this.setupAutoSave();
        // Update header town name from saved metadata
        const currentMeta = this._getTownList().find(t => t.id === this.currentTownId);
        this._updateHeaderTownName(currentMeta?.name);
        this.render();
        this._startRenderLoop();
        // v5.67.4 載入時若清掉 AI 助理漏出的內容,提示並回存
        setTimeout(() => this._notifyScrubbedLeaks(), 1500);
        // Show version in header
        const verEl = document.getElementById('version-display');
        if (verEl && !verEl.textContent) verEl.textContent = 'v' + RIMTOWN_APP_VERSION;
        this._startAchievementChecker();
        // v5.63.0 向伺服器確認帳號狀態:取管理員旗標;被管理員刪除/封鎖的帳號立即登出
        if (this.auth._serverless && this.auth.loggedIn) {
            this.auth.checkLogin().then(d => {
                if (d?.banned || !d?.logged_in) {
                    this._gameAlert?.(t('你的帳號已被管理員停用，已登出。'), '🚫');
                    this._updateAccountButton?.();
                } else if (d?.record_missing) {
                    // v5.66.0 帳號紀錄遺失(雲端儲存空間故障):趁憑證還有效,讓玩家設新密碼重建
                    this._repairAccountFlow();
                }
                if (this.activeTab === 'settings') this.renderSidebar();
            }).catch(() => {});
        }
        // Show quest guidance for returning players (tutorial already done)
        if (localStorage.getItem('rimtown_tutorial_done')) {
            setTimeout(() => this._updateQuestGuidance(), 2000);
            // v5.18.0 第一天因果鏈:介紹已看過但尚未走完核心循環者,續接引導
            setTimeout(() => { this._initFirstDay(); this._renderFirstDayGuide(); }, 2200);
        }
        // v4.5.0 留存機制:離線進度結算 + 每日登入獎勵(v5.68.0 首頁開著時延到按「繼續遊戲」後)
        const afterEnter = () => { if (loaded) this._processOfflineProgress(); this._checkDailyReward(); };
        if (this._landingActive) this._afterLanding = afterEnter; else afterEnter();
        this._startLastSeenTracker();
        this._initReady = true;
        this._landingUpdateContinue();

        // Auto-show login modal if not logged in (with guest option)
        if (!this.auth.loggedIn) {
            const authModal = document.getElementById('auth-modal');
            if (authModal) {
                authModal.classList.remove('hidden');
                // Hide close button but show guest section
                const closeBtn = authModal.querySelector('.auth-close-btn');
                if (closeBtn) closeBtn.style.display = 'none';
                const guestSection = document.getElementById('auth-guest-section');
                if (guestSection) guestSection.classList.remove('hidden');
            }
        }
    }

    // =====================================================
    // AUTH SYSTEM
    // =====================================================
    setupAuthListeners() {
        const accountBtn = document.getElementById('btn-account');
        if (accountBtn) {
            accountBtn.addEventListener('click', () => {
                if (this.auth.loggedIn) {
                    this._showAccountMenu();
                } else {
                    const authModal = document.getElementById('auth-modal');
                    if (authModal) {
                        authModal.classList.remove('hidden');
                        // Show close button when manually opened
                        const closeBtn = authModal.querySelector('.auth-close-btn');
                        if (closeBtn) closeBtn.style.display = '';
                    }
                }
            });
        }

        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.remove('active'));
                tab.classList.add('active');
                const isLogin = tab.dataset.authTab === 'login';
                document.getElementById('auth-login-form')?.classList.toggle('hidden', !isLogin);
                document.getElementById('auth-register-form')?.classList.toggle('hidden', isLogin);
                document.getElementById('auth-reset-form')?.classList.add('hidden');
            });
        });

        // Close buttons
        document.querySelectorAll('.auth-close-btn').forEach(btn => {
            btn.addEventListener('click', () => this._closeAuthModal());
        });

        // Login
        document.getElementById('auth-login-btn')?.addEventListener('click', () => this._doLogin());
        document.getElementById('auth-login-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doLogin(); });

        // Register
        document.getElementById('auth-reg-btn')?.addEventListener('click', () => this._doRegister());
        document.getElementById('auth-reg-pass2')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doRegister(); });

        // Forgot password
        document.getElementById('auth-forgot-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('auth-login-form')?.classList.add('hidden');
            document.getElementById('auth-register-form')?.classList.add('hidden');
            document.getElementById('auth-reset-form')?.classList.remove('hidden');
            document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.remove('active'));
        });
        document.getElementById('auth-reset-back')?.addEventListener('click', () => {
            document.getElementById('auth-reset-form')?.classList.add('hidden');
            document.getElementById('auth-login-form')?.classList.remove('hidden');
            document.querySelectorAll('.auth-tab').forEach(_tw => {
                _tw.classList.toggle('active', _tw.dataset.authTab === 'login');
            });
        });
        document.getElementById('auth-reset-btn')?.addEventListener('click', () => this._doResetPassword());
        document.getElementById('auth-reset-pass2')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._doResetPassword(); });

        // Guest mode
        document.getElementById('auth-guest-btn')?.addEventListener('click', () => this._enterGuestMode());
        document.getElementById('guest-register-btn')?.addEventListener('click', () => {
            const authModal = document.getElementById('auth-modal');
            if (authModal) {
                authModal.classList.remove('hidden');
                const closeBtn = authModal.querySelector('.auth-close-btn');
                if (closeBtn) closeBtn.style.display = '';
                // Switch to register tab
                document.querySelectorAll('.auth-tab').forEach(_tw => {
                    _tw.classList.toggle('active', _tw.dataset.authTab === 'register');
                });
                document.getElementById('auth-login-form')?.classList.add('hidden');
                document.getElementById('auth-register-form')?.classList.remove('hidden');
                document.getElementById('auth-guest-section')?.classList.add('hidden');
            }
        });
        document.getElementById('guest-banner-close')?.addEventListener('click', () => {
            document.getElementById('guest-banner')?.classList.add('hidden');
            document.getElementById('rimtown-app')?.classList.remove('guest-banner-visible');
        });
    }

    async _doLogin() {
        const user = document.getElementById('auth-login-user')?.value?.trim();
        const pass = document.getElementById('auth-login-pass')?.value;
        const errEl = document.getElementById('auth-login-error');
        if (!user || !pass) { if (errEl) errEl.textContent = t('請輸入帳號和密碼'); return; }
        try {
            if (errEl) errEl.textContent = t('登入中...');
            await this.auth.login(user, pass);
            if (this._landingMode === 'auth') { try { sessionStorage.setItem('rimtown_enter_now', '1'); } catch (e) {} location.reload(); return; } // v5.68.0
            this.guestMode = false;
            this._hideGuestBanner();
            this._closeAuthModal();
            this._updateAccountButton();
            this.world.logMessage('system', `${t('歡迎回來，')}${this.auth.username}！`);
            // v5.33.0 登入後同步帳號的 AI 設定(金鑰/供應商/額度);雲端沒有就把本機的推上去
            this._pullCloudSettings().then(changed => {
                if (changed) return this._applySettingsFromStorage();
                this._pushCloudSettings();
            }).catch(() => {});
            this._syncFromCloud();
            // Show tutorial for new players after login
            if (!localStorage.getItem('rimtown_tutorial_done')) {
                this.setupTutorial();
            }
        } catch (e) {
            if (errEl) errEl.textContent = e.message || t('登入失敗');
        }
    }

    // Close auth modal and reset mobile viewport zoom
    _closeAuthModal() {
        // Blur active input first to dismiss keyboard and prevent zoom stuck
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
        }
        document.getElementById('auth-modal')?.classList.add('hidden');
        // Force viewport reset on mobile to fix zoom stuck after keyboard dismiss
        if (window.innerWidth <= 768) {
            window.scrollTo(0, 0);
            // Trigger resize recalculation for tilemap
            setTimeout(() => {
                if (this.tileMap) this.tileMap._needsResize = true;
                window.dispatchEvent(new Event('resize'));
            }, 100);
        }
    }

    _enterGuestMode() {
        this.guestMode = true;
        this._closeAuthModal();
        // Show guest banner
        const banner = document.getElementById('guest-banner');
        if (banner) { banner.classList.remove('hidden'); banner.style.display = 'flex'; }
        document.getElementById('rimtown-app')?.classList.add('guest-banner-visible');
        // Update account button
        this._updateAccountButton();
        // Enable tutorial for guests
        this.setupTutorial();
    }

    _hideGuestBanner() {
        const banner = document.getElementById('guest-banner');
        if (banner) { banner.classList.add('hidden'); banner.style.display = 'none'; }
        document.getElementById('rimtown-app')?.classList.remove('guest-banner-visible');
    }

    // =====================================================
    // v4.5.0 留存機制:每日登入獎勵 + 離線進度結算
    // =====================================================
    _checkDailyReward() {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const last = localStorage.getItem('rimtown_login_date');
            if (last === today) return;
            let streak = parseInt(localStorage.getItem('rimtown_login_streak') || '0', 10);
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            streak = (last === yesterday) ? streak + 1 : 1;
            localStorage.setItem('rimtown_login_date', today);
            localStorage.setItem('rimtown_login_streak', String(streak));
            const day = Math.min(streak, 7);
            const silver = 10 + day * 10;
            const food = 5 + day * 5;
            this.world.stockpile.add('silver', silver, this.world.tickCount, t('每日登入獎勵'));
            this.world.stockpile.add('food', food, this.world.tickCount, t('每日登入獎勵'));
            this.world.logMessage('system', `🎁 ${t('每日登入獎勵(連續')} ${streak} ${t('天):+')}${silver} ${t('銀幣、+')}${food} ${t('食物')}`);
            this.bgm?.sfx?.('coin');
            this.tileMap?.spawnFxOnAgent?.('player', `💰 +${silver}`, { color: '#ffd166', burst: '🪙', burstCount: 6 });
            this._showCenterNotification({
                icon: '🎁',
                title: t('每日登入獎勵'),
                name: `${t('連續登入')} ${streak} ${t('天')}`,
                desc: `+${silver} ${t('銀幣')}、+${food} ${t('食物')}${streak < 7 ? t('(連續 7 天獎勵最高!)') : ''}`,
                autoDismiss: 6000,
            });
        } catch (e) { console.warn('[RimTown] daily reward error', e); }
    }

    _startLastSeenTracker() {
        const mark = () => { try { localStorage.setItem('rimtown_last_seen', String(Date.now())); } catch (e) {} };
        setInterval(mark, 30000);
        window.addEventListener('beforeunload', mark);
        mark();
    }

    _processOfflineProgress() {
        try {
            const last = parseInt(localStorage.getItem('rimtown_last_seen') || '0', 10);
            if (!last) return;
            const elapsedMs = Date.now() - last;
            if (elapsedMs < 10 * 60 * 1000) return; // 離開 10 分鐘內不結算
            // 依正常模擬速度換算,上限 2 遊戲日(192 tick)避免爆炸
            const ticks = Math.min(192, Math.floor(elapsedMs / (this.simSpeed || 2000)));
            if (ticks < 10) return;
            const sp = this.world.stockpile;
            const before = { silver: sp.get('silver'), food: sp.get('food') };
            const msgIdx = this.world.messageLog.length;
            for (let i = 0; i < ticks; i++) {
                try { this.world.tick(); } catch (e) { break; }
            }
            const dSil = Math.round(sp.get('silver') - before.silver);
            const dFood = Math.round(sp.get('food') - before.food);
            const events = this.world.messageLog.slice(msgIdx)
                .filter(m => ['event', 'relationship', 'drama', 'incident'].includes(m.type)).length;
            const hours = Math.round(elapsedMs / 360000) / 10;
            this.state = this.world.getState();
            this._showCenterNotification({
                icon: '🌙',
                title: t('離線進度結算'),
                name: `${t('你離開了')} ${hours} ${t('小時')}`,
                desc: `${t('小鎮繼續運轉了')} ${Math.round(ticks / 96 * 10) / 10} ${t('天')}:${t('銀幣')} ${dSil >= 0 ? '+' : ''}${dSil}、${t('食物')} ${dFood >= 0 ? '+' : ''}${dFood}、${events} ${t('件大小事(見紀錄)')}`,
                autoDismiss: 9000,
            });
            this.world.logMessage('system', `🌙 ${t('離線結算:小鎮在你離開時模擬了')} ${ticks} ${t('個時段')}`);
        } catch (e) { console.warn('[RimTown] offline progress error', e); }
    }

    // =====================================================
    // v5.32.0 章節制解鎖(劇情先、經營後):取代 v4.7.0 的零散功能解鎖
    // 第一章只有「人」——村民/聊天/關係網/故事;經營系統依章節逐步開啟
    // =====================================================
    _chapterDefs() {
        return [
            { n: 1, need: 0,  icon: '🌱', name: t('初來乍到'),   desc: t('認識村民,聊天,看見他們的愛恨與記憶。這座小鎮會記得你做過的事。') },
            { n: 2, need: 20, icon: '🤝', name: t('小鎮的一份子'), desc: t('村民開始信任你:任務、事件應對、村民請託與每日決策向你敞開。') },
            { n: 3, need: 45, icon: '🏡', name: t('安家立業'),   desc: t('你有能力參與小鎮的經濟了:商店、農場、產業。') },
            { n: 4, need: 70, icon: '🏛️', name: t('小鎮的支柱'),  desc: t('小鎮的未來由你塑造:工廠、研究、建築升級、議會。') },
        ];
    }
    currentChapter() {
        const pros = this.state?.prosperity?.prosperity || 0;
        const chs = this._chapterDefs();
        let cur = chs[0];
        for (const c of chs) if (pros >= c.need) cur = c;
        return cur;
    }
    _unlockDefs() {
        return [
            { key: 'events',       need: 20, icon: '📰', label: t('事件') },
            { key: 'achievements', need: 20, icon: '🏆', label: t('成就') },
            { key: 'economy',      need: 45, icon: '💰', label: t('經濟') },
            { key: 'industry',     need: 70, icon: '🏭', label: t('產業') },
        ];
    }

    _isTabLocked(key) {
        const def = this._unlockDefs().find(d => d.key === key);
        if (!def) return false;
        return !(this._unlockCache && this._unlockCache[key]);
    }

    _checkUnlocks() {
        if (!this.state) return;
        const pros = this.state.prosperity?.prosperity || 0;
        const stKey = 'rimtown_unlocks_' + (this.currentTownId || 'default');
        let st = null;
        try { st = JSON.parse(localStorage.getItem(stKey) || 'null'); } catch (e) {}
        const firstRun = !st;
        st = st || {};
        const newly = [];
        for (const d of this._unlockDefs()) {
            if (!st[d.key] && pros >= d.need) {
                st[d.key] = 1;
                if (!firstRun) newly.push(d);
            }
        }
        // v5.32.0 章節推進通知(取代零散的功能解鎖通知)
        const curCh = this.currentChapter();
        const prevCh = st._chapter || 1;
        if (curCh.n > prevCh) st._chapter = curCh.n;
        try { localStorage.setItem(stKey, JSON.stringify(st)); } catch (e) {}
        this._unlockCache = st;
        this._updateTabLocks();
        if (curCh.n > prevCh && !firstRun) {
            this.bgm?.sfx?.('coin');
            this._showCenterNotification({
                icon: curCh.icon,
                title: `${t('第')}${curCh.n}${t('章:')}${t(curCh.name)}`,
                name: newly.length ? newly.map(d => `${d.icon} ${d.label}`).join('、') : '',
                desc: curCh.desc,
                autoDismiss: 0,
            });
        }
    }

    _updateTabLocks() {
        for (const d of this._unlockDefs()) {
            const locked = this._isTabLocked(d.key);
            document.querySelectorAll(`[data-tab="${d.key}"], [data-kairo-tab="${d.key}"], [data-action="mobile-group-tab"][data-val="${d.key}"]`)
                .forEach(el => el.classList.toggle('tab-locked', locked));
        }
    }

    _lockedAlert(key) {
        const def = this._unlockDefs().find(d => d.key === key);
        if (!def) return;
        const ch = this._chapterDefs().find(c => c.need === def.need);
        this._gameAlert(`${def.icon}「${def.label}」${t('會在')}${ch ? `${t('第')}${ch.n}${t('章「')}${t(ch.name)}${t('」')}` : ''}${t('開啟。先專心和村民相處吧——關係好了,小鎮自然會成長。')}`, '🔒');
    }

    // =====================================================
    // v4.8.0 裝飾自由擺放
    // =====================================================
    _decorDefs() {
        return [
            { type: 'flowerbed', icon: '🌸', name: t('花圃'),  beauty: 2, cost: { silver: 15 } },
            { type: 'bench',     icon: '🪑', name: t('長椅'),  beauty: 2, cost: { silver: 15, wood: 10 } },
            { type: 'lamp',      icon: '🏮', name: t('路燈'),  beauty: 3, cost: { silver: 20, metal: 5 } },
            { type: 'statue',    icon: '🗿', name: t('雕像'),  beauty: 6, cost: { silver: 60, stone: 20 } },
            { type: 'fountain',  icon: '⛲', name: t('小噴泉'), beauty: 8, cost: { silver: 80, stone: 30 } },
        ];
    }

    _enterDecorMode(type) {
        const def = this._decorDefs().find(d => d.type === type);
        if (!def) return;
        this._exitSiteMode?.();
        this._decorMode = def;
        this.bgm?.sfx?.('open');
        // 手機:收合面板讓地圖全開
        if (window.innerWidth <= 768) {
            document.getElementById('kairo-card')?.classList.add('hidden');
            this._kairoCardOpen = false;
        }
        // 提示橫幅
        let hint = document.getElementById('decor-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'decor-hint';
            hint.className = 'drama-ticker'; // 重用樣式
            hint.style.pointerEvents = 'auto';
            hint.style.cursor = 'pointer';
            document.querySelector('.map-panel')?.appendChild(hint);
            hint.addEventListener('click', () => { this._exitDecorMode(); this._exitSiteMode(); });
        }
        hint.textContent = `${def.icon} ${t('點地圖空地擺放')}${t(def.name)}${t('|點裝飾移除|點這裡結束')}`;
        hint.classList.remove('hidden');
        // 掛地圖 raw tap
        this.tileMap.onTapRaw = (mx, my) => this._decorTap(mx, my);
    }

    _exitDecorMode() {
        this._decorMode = null;
        if (this.tileMap) this.tileMap.onTapRaw = null;
        document.getElementById('decor-hint')?.classList.add('hidden');
        this.bgm?.sfx?.('close');
    }

    _decorTap(mx, my) {
        if (!this._decorMode) return false;
        const tx = Math.floor(mx / 16), ty = Math.floor(my / 16);
        const decos = this.world.decorations = this.world.decorations || [];
        // 點到現有裝飾 → 移除退款一半
        const hitIdx = decos.findIndex(d => Math.abs(d.x - tx) <= 0 && Math.abs(d.y - ty) <= 0);
        if (hitIdx >= 0) {
            const old = decos.splice(hitIdx, 1)[0];
            const def = this._decorDefs().find(d => d.type === old.type);
            if (def) for (const [k, v] of Object.entries(def.cost)) {
                this.world.stockpile.add(k, Math.floor(v / 2), this.world.tickCount, t('移除裝飾退款'));
            }
            this.tileMap.decorations = decos;
            this.bgm?.sfx?.('close');
            return true;
        }
        const def = this._decorMode;
        // 位置檢查:可行走地面、非水、無重疊
        if (!this.tileMap._isWalkableTile(tx * 16 + 8, ty * 16 + 8)) return true;
        const tile = this.tileMap.grid?.[ty]?.[tx];
        if (tile === 10 || tile === 11) return true; // WATER
        // v5.60.1 裝飾也不可擺進工廠預留地基或馬車站
        for (const pl of (this.tileMap._getFactoryPlots?.() || [])) {
            if (tx >= pl.x && tx < pl.x + pl.w && ty >= pl.y && ty < pl.y + pl.h) return true;
        }
        const dcs = this.tileMap.coachStation;
        if (dcs && tx >= dcs.x && tx < dcs.x + dcs.w && ty >= dcs.y && ty < dcs.y + dcs.h) return true;
        // 資源檢查與扣款
        const afford = Object.entries(def.cost).every(([k, v]) => (this.world.stockpile.get(k) || 0) >= v);
        if (!afford) {
            this._gameAlert(t('材料不足,無法再擺放!'), '🌸');
            this._exitDecorMode();
            return true;
        }
        for (const [k, v] of Object.entries(def.cost)) {
            this.world.stockpile.consume(k, v, this.world.tickCount, `${t('擺放')}${t(def.name)}`);
        }
        decos.push({ type: def.type, x: tx, y: ty });
        this.tileMap.decorations = decos;
        this.world.logMessage('building', `${def.icon} ${t('你在小鎮擺放了')}${t(def.name)}(${t('美觀')}+${def.beauty})`);
        this.bgm?.sfx?.('coin');
        this.world.checkCombos?.(); // v4.9.0 擺放後偵測相鄰組合
        return true;
    }

    // =====================================================
    // v4.9.0 建築選址(玩家點地圖挑新建築位置,佔 2x2 地塊)
    _enterSiteMode(key) {
        const tmpl = (typeof BUILDING_TEMPLATES !== 'undefined') ? BUILDING_TEMPLATES[key] : null;
        if (!tmpl || !this.tileMap) return;
        this._exitDecorMode();
        this._siteMode = key;
        let hint = document.getElementById('decor-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'decor-hint';
            hint.className = 'drama-ticker';
            hint.style.pointerEvents = 'auto';
            hint.style.cursor = 'pointer';
            document.querySelector('.map-panel')?.appendChild(hint);
            hint.addEventListener('click', () => { this._exitDecorMode(); this._exitSiteMode(); });
        }
        hint.textContent = `🏗️ ${t('點發光的綠色格子選擇')}【${t(tmpl.name)}】${t('的位置(會自動對齊格線)|點這裡取消')}`;
        hint.classList.remove('hidden');
        this.tileMap.onTapRaw = (mx, my) => this._siteTap(mx, my);
        // v5.60.0 選址引導:可蓋格位發光+滑鼠佔地預覽,錨點吸附 2 格網格蓋得整齊
        this._siteBlocked = null;
        this.tileMap.sitePreview = { w: 2, h: 2, isValid: (tx, ty) => this._siteValid(tx, ty) };
        this.bgm?.sfx?.('open');
        // 手機版:收起卡片讓玩家看得到地圖
        if (window.innerWidth <= 768) {
            document.getElementById('kairo-card')?.classList.add('hidden');
            this._kairoCardOpen = false;
        }
    }

    _exitSiteMode() {
        if (!this._siteMode) return;
        this._siteMode = null;
        this._siteBlocked = null;
        if (this.tileMap) { this.tileMap.onTapRaw = null; this.tileMap.sitePreview = null; }
        document.getElementById('decor-hint')?.classList.add('hidden');
    }

    // v5.60.0 選址合法性(發光格位/預覽框/點擊共用):0=可蓋 1=地形不行 2=已被占用
    _siteValid(tx, ty) {
        if (!this.tileMap) return 1;
        // 2x2 每格都要是可行走的空地、非水
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
            const cx = tx + dx, cy = ty + dy;
            const tile = this.tileMap.grid?.[cy]?.[cx];
            if (tile === undefined || tile === 10 || tile === 11 || !this.tileMap._isWalkableTile(cx * 16 + 8, cy * 16 + 8)) return 1;
        }
        // 不可與裝飾、其他工地/已選址建築重疊(占用集在選址模式期間快取)
        if (!this._siteBlocked) {
            const s = new Set();
            for (const d of (this.world.decorations || [])) s.add(`${d.x},${d.y}`);
            const sited = [...this.world.buildings.projects, ...this.world.buildings.completed].filter(b => Number.isFinite(b.siteX));
            for (const b of sited) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.add(`${b.siteX + dx},${b.siteY + dy}`);
            this._siteBlocked = s;
        }
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
            if (this._siteBlocked.has(`${tx + dx},${ty + dy}`)) return 2;
        }
        // v5.60.1 工廠預留地基(含空地基)與馬車站也是禁區,兩套系統不再互相蓋在對方頭上
        for (const pl of (this.tileMap._getFactoryPlots?.() || [])) {
            if (tx + 2 > pl.x && tx < pl.x + pl.w && ty + 2 > pl.y && ty < pl.y + pl.h) return 2;
        }
        const cs = this.tileMap.coachStation;
        if (cs && tx + 2 > cs.x && tx < cs.x + cs.w && ty + 2 > cs.y && ty < cs.y + cs.h) return 2;
        return 0;
    }

    _siteTap(mx, my) {
        if (!this._siteMode) return false;
        // v5.60.0 點擊吸附到 2 格網格(與發光格位/預覽框同一套座標),建築自動對齊
        const { tx, ty } = this.tileMap._siteSnap(mx, my);
        const v = this._siteValid(tx, ty);
        if (v === 1) { this._flashSiteHint(t('這裡放不下,點發光的綠色格子!')); return true; }
        if (v === 2) { this._flashSiteHint(t('這裡已經有東西了,換個地方吧!')); return true; }
        const p = this.world.buildings.startProject(this._siteMode, this.world, { x: tx, y: ty });
        if (!p) {
            this._gameAlert(t('資源不足,無法開工!'), '🏗️');
            this._exitSiteMode();
            return true;
        }
        this.bgm?.sfx?.('coin');
        this._gameAlert(`🚧 ${t(p.name)}${t('動工了!工匠們會每天到工地施工')}`, '🏗️');
        this._exitSiteMode();
        this.state = this.world.getState();
        this.renderSidebar();
        return true;
    }

    _flashSiteHint(msg) {
        const hint = document.getElementById('decor-hint');
        if (!hint) return;
        const orig = hint.textContent;
        hint.textContent = `❌ ${msg}`;
        this.bgm?.sfx?.('close');
        clearTimeout(this._siteHintTimer);
        this._siteHintTimer = setTimeout(() => { if (this._siteMode) hint.textContent = orig; }, 1500);
    }

    // =====================================================
    // v4.6.0 送禮系統(礦石鎮式刷好感)
    // =====================================================
    _giftDefs() {
        return [
            { key: 'food',   icon: '🍞', name: t('美味餐點'), cost: 10, base: 5 },
            { key: 'herbs',  icon: '🌿', name: t('草藥花束'), cost: 5,  base: 5 },
            { key: 'cloth',  icon: '🧵', name: t('精緻布料'), cost: 5,  base: 5 },
            { key: 'tools',  icon: '🔨', name: t('精良工具'), cost: 2,  base: 5 },
            { key: 'silver', icon: '💰', name: t('銀幣紅包'), cost: 25, base: 4 },
        ];
    }

    _giftPref(jobKey) {
        const map = { farmer:'tools', miner:'tools', carpenter:'tools', blacksmith:'tools',
                      doctor:'herbs', researcher:'herbs', priest:'herbs',
                      chef:'food', cook:'food', guard:'food',
                      merchant:'silver', tailor:'cloth' };
        return map[jobKey] || null;
    }

    _showGiftPicker() {
        const npc = this.world?.agents?.[this.chatTarget];
        if (!npc) return;
        const dayKey = `${this.world.clock.year}-${this.world.clock.season}-${this.world.clock.day}`;
        if (npc._lastGiftDay === dayKey) {
            this._gameAlert(`${t(npc.name)}${t('今天已經收過你的禮物了,明天再送吧!')}`, '🎁');
            return;
        }
        let el = document.getElementById('gift-picker');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gift-picker';
            el.className = 'modal';
            document.getElementById('rimtown-app')?.appendChild(el);
        }
        const sp = this.world.stockpile;
        const pref = this._giftPref(npc.job?.key);
        const rows = this._giftDefs().map(g => {
            const have = Math.floor(sp.get(g.key) || 0);
            const ok = have >= g.cost;
            const fav = pref === g.key ? ` <span style="color:#ffd700">★${t('他的最愛')}</span>` : '';
            return `<button data-action="give-gift" data-val="${g.key}" ${ok ? '' : 'disabled style="opacity:0.4"'}
                style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:9px 12px;margin-bottom:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:0.85rem">
                <span>${g.icon} ${t(g.name)}${fav}</span><span style="color:var(--text-secondary);font-size:0.75rem">${t('花費')} ${g.cost}(${t('庫存')} ${have})</span></button>`;
        }).join('');
        el.innerHTML = `<div class="modal-content" style="max-width:320px">
            <h2>🎁 ${t('送禮物給')} ${t(npc.name)}</h2>
            <div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:8px">${t('投其所好效果加倍!每人每天限送一次。')}</div>
            ${rows}
            <div class="modal-buttons"><button onclick="document.getElementById('gift-picker').classList.add('hidden')">${t('取消')}</button></div>
        </div>`;
        el.classList.remove('hidden');
    }

    _giveGift(giftKey) {
        const npc = this.world?.agents?.[this.chatTarget];
        const g = this._giftDefs().find(x => x.key === giftKey);
        if (!npc || !g) return;
        const sp = this.world.stockpile;
        if ((sp.get(g.key) || 0) < g.cost) return;
        document.getElementById('gift-picker')?.classList.add('hidden');
        sp.consume(g.key, g.cost, this.world.tickCount, `${t('送禮給')}${t(npc.name)}`);
        const dayKey = `${this.world.clock.year}-${this.world.clock.season}-${this.world.clock.day}`;
        npc._lastGiftDay = dayKey;
        const isFav = this._giftPref(npc.job?.key) === g.key;
        const gain = isFav ? g.base * 2 : g.base;
        const rel = npc.relationships.getOrCreate('player', this.world.agents['player']?.name || t('旅人'));
        rel.modifyAffinity(gain);
        if (isFav) rel.modifyRomantic(2);
        this.world.questSystem?.onGift?.(this.chatTarget); // v5.83.0 任務條件:送禮給誰
        try { this.world.requests?.onGift(this.chatTarget, this.world); this._updateRequestBadge(); } catch (e) {} // v5.91.0 委託:送禮
        npc.addThought?.(isFav ? 'fav_gift' : 'gift_received', this.world, 'player', this.world.agents['player']?.name || t('旅人')); // v5.15.0 收禮記憶
        this._firstDayMark?.('mark'); // v5.18.0 第一天:留下你的選擇
        npc.memory.add(this.world.tickCount, this.world.clock.timeStr, 'gift',
            `${t('收到')}${this.world.agents['player']?.name || t('旅人')}${t('送的')}${t(g.name)}${isFav ? t(',是我的最愛!') : ''}`, isFav ? 7 : 5, ['player']);
        const lines = isFav
            ? [t('這是我的最愛!你怎麼知道的?太感謝了!'), t('哇!我一直想要這個!你真懂我!')]
            : [t('謝謝你!我很喜歡。'), t('你真貼心,謝謝!')];
        const reply = lines[Math.floor(Math.random() * lines.length)];
        const player = this.world.agents['player'];
        if (player) {
            player.chatHistory.push({ speaker: player.name, target: npc.name, text: `🎁(${t('送出')}${t(g.name)})`, time: this.world.clock.timeStr });
            player.chatHistory.push({ speaker: npc.name, target: player.name, text: reply, time: this.world.clock.timeStr });
        }
        this.world.logMessage('relationship', `🎁 ${t('你送給')}${t(npc.name)}${t(g.name)}${isFav ? t(',對方超喜歡!') : ''}(${t('好感')}+${gain})`, npc.name);
        this.world.recordPlayerAction?.('gift', g.name, npc, null); // v5.45.0 蝴蝶效應
        this.bgm?.sfx?.('coin');
        // v5.6.0 浮動特效:好感愛心 + 愛心爆裂
        this.tileMap?.spawnFxOnAgent?.(this.chatTarget, `❤️ +${gain}`, { color: '#ff6b9d', burst: isFav ? '💖' : '❤️', burstCount: isFav ? 8 : 5 });
        this.world.checkHeartEvents?.(); // v5.0.0 送禮後檢查心動事件
        this.state = this.world.getState();
        if (this.activeTab === 'chat') { this._renderChatMessages(); this._scrollChatToBottom(); }
    }

    // =====================================================
    // v4.6.0 繁榮度全球排行榜(Serverless)
    // =====================================================
    async _submitLeaderboard() {
        try {
            if (!this.auth?.loggedIn || !this.auth._serverless) return;
            const now = Date.now();
            if (this._lbSubmitAt && now - this._lbSubmitAt < 3600000) return; // 1 小時一次
            this._lbSubmitAt = now;
            const pr = this.state?.prosperity || {};
            await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.auth._nonce },
                body: JSON.stringify({
                    town_name: this.state?.town_name || '邊境鎮',
                    prosperity: Math.round(pr.prosperity || 0),
                    level: pr.level || '',
                    population: Object.keys(this.state?.agents || {}).length,
                }),
            });
        } catch (e) {}
    }

    async _showLeaderboard() {
        let el = document.getElementById('lb-modal');
        if (!el) {
            el = document.createElement('div');
            el.id = 'lb-modal';
            el.className = 'modal';
            document.getElementById('rimtown-app')?.appendChild(el);
        }
        el.innerHTML = `<div class="modal-content" style="max-width:340px"><h2>🏆 ${t('全球繁榮排行榜')}</h2><div id="lb-body" style="font-size:0.8rem">${t('載入中...')}</div>
            <div class="modal-buttons"><button onclick="document.getElementById('lb-modal').classList.add('hidden')">${t('關閉')}</button></div></div>`;
        el.classList.remove('hidden');
        try {
            const res = await fetch('/api/leaderboard');
            const data = await res.json();
            const rows = (data.entries || []).map((e, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const me = this.auth?.username === e.username ? ' style="color:#ffd700;font-weight:700"' : '';
                return `<div${me}>${medal} ${e.username}${t('的')}${e.town_name || t('小鎮')} — 🏆${e.prosperity} 👥${e.population}</div>`;
            }).join('') || `<div>${t('還沒有人上榜,登入後你的繁榮度會自動參賽!')}</div>`;
            const hint = this.auth?.loggedIn ? '' : `<div style="margin-top:8px;color:var(--text-secondary)">${t('登入後即可上榜!')}</div>`;
            const body = document.getElementById('lb-body');
            if (body) body.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">${rows}</div>${hint}`;
        } catch (e) {
            const body = document.getElementById('lb-body');
            if (body) body.textContent = t('排行榜暫時無法載入(僅 rimtown.cc 支援)');
        }
    }

    // Custom game-style alert (replaces browser alert)
    _gameAlert(msg, icon = '⚠️') {
        return new Promise(resolve => {
            const dlg = document.getElementById('game-dialog');
            document.getElementById('game-dialog-icon').textContent = icon;
            document.getElementById('game-dialog-msg').textContent = msg;
            const btns = document.getElementById('game-dialog-buttons');
            btns.innerHTML = `<button class="game-dialog-ok">${t('確定')}</button>`;
            btns.querySelector('.game-dialog-ok').addEventListener('click', () => {
                dlg.classList.add('hidden');
                resolve();
            });
            dlg.classList.remove('hidden');
        });
    }

    // Custom game-style confirm (replaces browser confirm)
    _gameConfirm(msg, icon = '❓') {
        return new Promise(resolve => {
            const dlg = document.getElementById('game-dialog');
            document.getElementById('game-dialog-icon').textContent = icon;
            document.getElementById('game-dialog-msg').textContent = msg;
            const btns = document.getElementById('game-dialog-buttons');
            btns.innerHTML = `<button class="game-dialog-cancel">${t('取消')}</button><button class="game-dialog-ok">${t('確定')}</button>`;
            btns.querySelector('.game-dialog-cancel').addEventListener('click', () => {
                dlg.classList.add('hidden');
                resolve(false);
            });
            btns.querySelector('.game-dialog-ok').addEventListener('click', () => {
                dlg.classList.add('hidden');
                resolve(true);
            });
            dlg.classList.remove('hidden');
        });
    }

    async _doRegister() {
        const user = document.getElementById('auth-reg-user')?.value?.trim();
        const email = document.getElementById('auth-reg-email')?.value?.trim();
        const pass = document.getElementById('auth-reg-pass')?.value;
        const pass2 = document.getElementById('auth-reg-pass2')?.value;
        const invite = document.getElementById('auth-reg-invite')?.value?.trim() || '';
        const errEl = document.getElementById('auth-reg-error');
        if (!user || !pass) { if (errEl) errEl.textContent = t('請填寫帳號和密碼'); return; }
        if (!invite) { if (errEl) errEl.textContent = t('請輸入推薦碼'); return; }
        if (pass !== pass2) { if (errEl) errEl.textContent = t('兩次密碼不一致'); return; }
        try {
            if (errEl) errEl.textContent = t('註冊中...');
            await this.auth.register(user, pass, email, invite);
            if (this._landingMode === 'auth') {
                // v5.68.0 首頁註冊:清掉本機其他帳號殘留,標記新城鎮名,重載走正規登入流程(會顯示教學)
                this._getTownList().forEach(_tw => { localStorage.removeItem('rimtown_town_' + _tw.id); localStorage.removeItem('rimtown_town_' + _tw.id + '_archives'); });
                ['rimtown_town_list', 'rimtown_last_town', 'rimtown_achievements', 'rimtown_raid_count', 'rimtown_tutorial_done'].forEach(k => localStorage.removeItem(k));
                localStorage.setItem('rimtown_pending_town_name', `${user}的邊境鎮`);
                try { sessionStorage.setItem('rimtown_enter_now', '1'); } catch (e) {}
                location.reload(); return;
            }
            this.guestMode = false;
            this._hideGuestBanner();
            this._closeAuthModal();
            this._updateAccountButton();
            // v5.33.0 新帳號:把本機已設定的 AI 金鑰推上帳號雲端
            this._pushCloudSettings();
            // New user gets a fresh world — clear all old local data
            const oldTowns = this._getTownList();
            oldTowns.forEach(_tw => {
                localStorage.removeItem('rimtown_town_' + _tw.id);
                localStorage.removeItem('rimtown_town_' + _tw.id + '_archives');
            });
            localStorage.removeItem('rimtown_town_list');
            localStorage.removeItem('rimtown_last_town');
            localStorage.removeItem('rimtown_achievements');
            localStorage.removeItem('rimtown_raid_count');
            this.world.reset();
            if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
            const townName = `${user}的邊境鎮`;
            this.currentTownId = this._generateTownId(townName);
            this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
            this.state = this.world.getState();
            this._generateTileMapLayout();
            if (this.tileMap) this.tileMap.agentPositions = {};
            this._saveCurrentTown(townName);
            this.render();
            this._renderTownList();
            this.world.logMessage('system', `${t('註冊成功！歡迎，')}${this.auth.username}${t('！你的全新城鎮已建立。')}`);
            this._syncToCloud();
            // Show tutorial for new players after registration
            if (!localStorage.getItem('rimtown_tutorial_done')) {
                this.setupTutorial();
            }
        } catch (e) {
            if (errEl) errEl.textContent = e.message || t('註冊失敗');
        }
    }

    async _doResetPassword() {
        const user = document.getElementById('auth-reset-user')?.value?.trim();
        const email = document.getElementById('auth-reset-email')?.value?.trim();
        const pass = document.getElementById('auth-reset-pass')?.value;
        const pass2 = document.getElementById('auth-reset-pass2')?.value;
        const errEl = document.getElementById('auth-reset-error');
        const successEl = document.getElementById('auth-reset-success');
        if (errEl) errEl.textContent = '';
        if (successEl) successEl.textContent = '';
        if (!user) { if (errEl) errEl.textContent = t('請輸入使用者名稱'); return; }
        if (!email) { if (errEl) errEl.textContent = t('請輸入註冊時的電子郵件'); return; }
        if (!pass || pass.length < 6) { if (errEl) errEl.textContent = t('新密碼至少6個字元'); return; }
        if (pass !== pass2) { if (errEl) errEl.textContent = t('兩次密碼不一致'); return; }
        try {
            if (errEl) errEl.textContent = t('重設中...');
            const resp = await fetch(`${this.auth._restUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this.auth._nonce },
                body: JSON.stringify({ username: user, email, new_password: pass }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || t('重設失敗'));
            if (errEl) errEl.textContent = '';
            if (successEl) successEl.textContent = t('密碼已重設！請用新密碼登入');
            setTimeout(() => {
                document.getElementById('auth-reset-form')?.classList.add('hidden');
                document.getElementById('auth-login-form')?.classList.remove('hidden');
                document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.toggle('active', _tw.dataset.authTab === 'login'));
                if (successEl) successEl.textContent = '';
            }, 2000);
        } catch (e) {
            if (errEl) errEl.textContent = e.message || t('重設失敗');
        }
    }

    // =====================================================
    // TUTORIAL — New player intro & story guide
    // =====================================================
    // v6.0.0 B14：setupTutorial … 等方法移到 app-landing.js

    // ============================================================
    // v5.68.0 管理員:推薦碼管理(註冊必填,由管理員建立/停用/刪除)
    // ============================================================
    // v6.0.0 B14：_adminLoadInvites … 等方法移到 app-notify.js

    // v5.29.0 重建 ConversationEngine 時保留對話紀錄與節流狀態(對話紀錄要能存檔,不能因改設定而消失)
    _makeConversationEngine() {
        const prev = this.world?.conversationEngine;
        const eng = new ConversationEngine(this.llmClient);
        if (prev) {
            eng.npcConversationLog = prev.npcConversationLog;
            eng._lastNpcLlmTick = prev._lastNpcLlmTick;
            eng._lastNpcMsgTick = prev._lastNpcMsgTick;
        }
        return eng;
    }

    // Hook conversation engine to push speech bubbles to tilemap
    _hookConversationBubbles() {
        // Set up a periodic check since ConversationEngine may be re-created
        setInterval(() => {
            if (this.world.conversationEngine && !this.world.conversationEngine._bubbleHooked) {
                this.world.conversationEngine._bubbleHooked = true;
                this.world.conversationEngine.onConversation = (aId, bId, aName, bName, textA, textB) => {
                    if (this.tileMap) {
                        this.tileMap.addConversationBubble(aId, bId, aName, bName, textA, textB);
                    }
                };
                // v5.29.0 混合成本控制:注入「是否在玩家 8 格內」判定(與語音泡泡同範圍)
                this.world.conversationEngine.isNearPlayer = (agentId) => {
                    const positions = this.tileMap?.agentPositions;
                    if (!positions) return false;
                    const p = positions['player'], a = positions[agentId];
                    if (!p || !a) return false;
                    const range = TILE * 8;
                    return (a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y) <= range * range;
                };
            }
        }, 2000);
    }

    // === Auth Actions ===
    async _doLogout() {
        try {
            await this.auth.logout();
            if (this.auth._serverless) { location.reload(); return; } // v5.68.0 回到首頁
            this._updateAccountButton();
            this.world.logMessage('system', t('已登出。'));
        } catch(e) { console.error(e); }
    }

    async _showCloudSaves() {
        if (!this.auth.loggedIn) return;
        try {
            const saves = await this.auth.listSaves();
            if (!saves.length) {
                this._gameAlert(t('雲端沒有存檔。請先上傳存檔。'), '☁️');
                return;
            }
            // Show in town modal
            const modal = document.getElementById('town-modal');
            const container = document.getElementById('town-list-content');
            if (!modal || !container) return;
            modal.classList.remove('hidden');
            let html = t('<h3 style="margin-bottom:8px">雲端存檔</h3>');
            saves.forEach(s => {
                const date = new Date(s.updated_at).toLocaleString();
                html += `<div class="town-item">
                    <div class="town-info" data-action="load-cloud-save" data-val="${s.town_id}">
                        <div class="town-name">☁️ ${t(s.town_name)}</div>
                        <div class="town-meta">${t(s.season)}${t(' 第')}${s.year}${t('年 第')}${s.day}${t('天 | 人口')}${s.population} | ${date}</div>
                    </div>
                    <div class="town-actions">
                        <button data-action="delete-cloud-save" data-val="${s.town_id}" class="btn-danger" title="${t('刪除雲端存檔')}">🗑️</button>
                    </div>
                </div>`;
            });
            html += `<div class="town-modal-actions"><button class="town-btn town-btn-secondary" data-action="close-town-modal">${t('關閉')}</button></div>`;
            container.innerHTML = html;
        } catch(e) { this._gameAlert(t('載入雲端存檔失敗：') + e.message, '❌'); }
    }

    async _loadCloudSave(townId) {
        try {
            const saveData = await this.auth.cloudLoad(townId);
            if (this.world.loadSave(saveData)) {
                if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
                this.currentTownId = townId;
                this._saveCurrentTown();
                this.state = this.world.getState();
                this._generateTileMapLayout();
                if (this.tileMap) this.tileMap.agentPositions = {};
                this.render();
                this.world.logMessage('system', t('已從雲端載入存檔。'));
            }
            document.getElementById('town-modal')?.classList.add('hidden');
            this.world.paused = !!this._pausedBeforeTownModal;
        } catch(e) { this._gameAlert(t('載入失敗：') + e.message, '❌'); }
    }

    async _deleteCloudSave(townId) {
        if (!await this._gameConfirm(t('確定刪除雲端存檔？'), '🗑️')) return;
        try {
            await this.auth.cloudDelete(townId);
            this.world.logMessage('system', t('雲端存檔已刪除。'));
            this._showCloudSaves(); // Refresh list
        } catch(e) { this._gameAlert(t('刪除失敗：') + e.message, '❌'); }
    }

    // === Achievements Tab ===
    _showAchievementsTab() {
        this.activeTab = 'achievements';
        if (this._updateTabHighlight) this._updateTabHighlight('achievements');
        this.renderSidebar();
    }

    renderAchievements(container) {
        const categories = { social: t('社交'), romance: t('愛情'), economy: t('經濟'), survival: t('生存'), town: t('城鎮'), player: t('玩家'), special: t('特殊') };
        let html = t('<div class="achievements-panel"><h3>成就 <span class="ach-count">') +
            this._unlockedAchievements.size + '/' + Object.keys(ACHIEVEMENTS).length + '</span></h3>';

        for (const [catKey, catName] of Object.entries(categories)) {
            const achs = Object.entries(ACHIEVEMENTS).filter(([,a]) => a.category === catKey);
            if (!achs.length) continue;
            html += `<div class="ach-category"><h4>${catName}</h4><div class="ach-grid">`;
            achs.forEach(([key, def]) => {
                const unlocked = this._unlockedAchievements.has(key);
                html += `<div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
                    <span class="ach-icon">${unlocked ? def.icon : '🔒'}</span>
                    <div class="ach-info"><div class="ach-name">${unlocked ? def.name : '???'}</div>
                    <div class="ach-desc">${unlocked ? def.desc : t('尚未解鎖')}</div></div></div>`;
            });
            html += '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    // v5.61.0 玩家職業選擇系統已移除:玩家定位為鎮長/觀察者,職業欄位僅保留給參選鎮長玩法
    // v4.0: Shop buy/sell
    _shopBuy(itemKey, amount) {
        const result = this.world.shop.buy(itemKey, amount, this.world);
        if (!result.success) this.world.logMessage('economy', `❌ ${result.msg}`);
        this.state = this.world.getState(); this.renderSidebar();
    }

    _shopSell(itemKey, amount) {
        const result = this.world.shop.sell(itemKey, amount, this.world);
        if (!result.success) this.world.logMessage('economy', `❌ ${result.msg}`);
        this.state = this.world.getState(); this.renderSidebar();
    }

    // v4.0: News reaction
    _newsReaction(reaction) {
        const labels = { investigate: t('調查'), support: t('支持'), ignore: t('忽略') };
        const effects = {
            investigate: { mood_all: 1, reputation: 1 },
            support: { mood_all: 2 },
            ignore: {},
        };
        const eff = effects[reaction] || {};
        if (eff.mood_all) Object.values(this.world.agents).forEach(a => { a.moodModifier = (a.moodModifier || 0) + eff.mood_all; });
        this.world.logMessage('player_action', `📰 ${t('你對今日新聞選擇了「')}${labels[reaction] || reaction}${t('」')}`);
        this._newsReacted = true;
        this.state = this.world.getState(); this.renderSidebar();
    }

    // v4.0: Council vote
    _councilVote(choice) {
        if (!this.world.council) return;
        const success = this.world.council.playerVote(choice);
        if (success) {
            this.world.logMessage('council', `🏛️ ${t('你對議會提案投了')}${choice === 'for' ? t('贊成') : t('反對')}${t('票。')}`);
        }
        this.state = this.world.getState(); this.renderSidebar();
    }

    // v5.38.0 參選鎮長:挑一個主打政見後正式登記
    _showRunForMayorModal() {
        const elig = this.world.election?.playerEligibility?.(this.world);
        if (!elig?.ok) { this._gameAlert(elig?.msg || t('目前無法參選。'), '🗳️'); return; }
        document.getElementById('run-mayor-modal')?.remove();
        const POLICIES = [
            ['economy', '💰', t('經濟發展'), t('加強貿易與生產,讓鎮民富起來')],
            ['welfare', '🤝', t('社會福利'), t('照顧每一位居民,社區和諧')],
            ['defense', '🛡️', t('軍事防禦'), t('固若金湯,不再讓突襲得逞')],
            ['culture', '📚', t('文化教育'), t('研究與技藝,知識就是未來')],
            ['nature', '🌿', t('自然保育'), t('與自然共處,永續發展')],
            ['freedom', '🕊️', t('個人自由'), t('減少管束,自由發展')],
        ];
        const overlay = document.createElement('div');
        overlay.id = 'run-mayor-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `<div style="background:var(--bg-card,#20222c);border:1px solid var(--border,#444);border-radius:12px;max-width:340px;width:100%;padding:16px;max-height:80vh;overflow-y:auto">
            <div style="font-size:1rem;font-weight:700;margin-bottom:4px">👑 ${t('參選鎮長')}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary,#aaa);margin-bottom:10px">${t('選一個你要主打的政見。當選後施政方針會實際影響小鎮 30 天,之後每天的鎮政決策都由你拿主意。')}</div>
            ${POLICIES.map(([id, ic, lb, ds]) => `<button class="btn-vote" data-rm-policy="${id}" style="display:block;width:100%;margin-bottom:6px;text-align:left;padding:8px 10px">${ic} <b>${lb}</b><br><span style="font-size:0.68rem;opacity:0.75">${ds}</span></button>`).join('')}
            <button class="btn-vote" data-rm-close="1" style="display:block;width:100%;background:transparent;border:1px solid var(--border,#444)">${t('再想想')}</button>
        </div>`;
        overlay.addEventListener('click', (e) => {
            const p = e.target.closest?.('[data-rm-policy]');
            if (p) { overlay.remove(); this._confirmRunForMayor(p.dataset.rmPolicy); return; }
            if (e.target.closest?.('[data-rm-close]') || e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }

    _confirmRunForMayor(policyId) {
        const res = this.world.election?.registerPlayerCandidate?.(this.world, policyId);
        if (!res) return;
        if (!res.ok) { this._gameAlert(res.msg || t('登記失敗。'), '🗳️'); return; }
        this._showCornerNotice({ icon: '👑', title: t('你參選了！'), name: '', desc: t('去找村民聊天,用「說服」為自己拉票——每位村民一屆只能拉一次') });
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerVote(candidateId) {
        const election = this.world.election;
        if (!election || !election.active || election.phase !== 'voting') return;
        const candidate = election.candidates?.find(c => c.agentId === candidateId);
        if (!candidate) return;
        // Check if player already voted
        if (election._playerVoted) {
            this.world.logMessage('system', t('你已經投過票了。'));
            return;
        }
        candidate.votes = (candidate.votes || 0) + 1;
        election._playerVoted = true;
        this._unlockAchievement('voted');
        this.world.logMessage('player_action', `${t('你投票給了 ')}${t(candidate.name)}。`, 'player');
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerFlirt(targetId) {
        const player = this.world.agents['player'];
        const npc = this.world.agents[targetId];
        if (!player || !npc) return;
        if (player.currentLocation !== npc.currentLocation) {
            this.world.logMessage('system', t('你需要在對方身邊才能調情。'));
            return;
        }
        // Increase romantic interest based on charisma
        const rel = player.relationships?.get?.(targetId) || player.getRelationship?.(targetId);
        if (rel) {
            const boost = 5 + Math.floor(Math.random() * 10);
            rel.modifyRomantic(boost);
            rel.modifyAffinity(2);
            const npcRel = npc.relationships?.get?.('player') || npc.getRelationship?.('player');
            if (npcRel) {
                // NPC may or may not reciprocate
                const npcBoost = Math.floor(Math.random() * 8) + (npc.personality?.traits?.includes('romantic') ? 5 : 0);
                npcRel.modifyRomantic(npcBoost);
                npcRel.modifyAffinity(1);
            }
            this._flirtCount = (this._flirtCount || 0) + 1;
            this.world.logMessage('player_action', `${t('你對')}${t(npc.name)}${t('調情。')}`, player.name, npc.name);
            player.memory?.add?.(this.world.tickCount, this.world.clock.timeStr, 'social', `${t('對')}${t(npc.name)}${t('調情')}`, 3, [npc.name]);
        }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    _playerPropose(targetId) {
        const player = this.world.agents['player'];
        const npc = this.world.agents[targetId];
        if (!player || !npc) return;
        const rel = player.relationships?.get?.(targetId) || player.getRelationship?.(targetId);
        const npcRel = npc.relationships?.get?.('player') || npc.getRelationship?.('player');
        if (!rel || !npcRel) {
            this.world.logMessage('system', t('你跟這個人不夠熟。'));
            return;
        }
        this._unlockAchievement('proposed');
        // Check if NPC accepts (based on affinity and romantic interest)
        const accept = npcRel.affinity > 30 && npcRel.romantic > 20 && Math.random() < 0.7;
        if (accept) {
            // Start dating or upgrade to marriage
            if (rel.status === 'dating') {
                rel.status = 'married';
                if (npcRel) npcRel.status = 'married';
                this.world.logMessage('event', `${t(player.name)}${t('與')}${t(npc.name)}${t('結婚了！')}`, player.name, npc.name);
                this._unlockAchievement('first_marriage');
            } else {
                rel.status = 'dating';
                if (npcRel) npcRel.status = 'dating';
                this.world.logMessage('event', `${t(player.name)}${t('與')}${t(npc.name)}${t('開始交往！')}`, player.name, npc.name);
                this._unlockAchievement('first_dating');
            }
        } else {
            this.world.logMessage('event', `${t(npc.name)}${t('拒絕了你的告白。')}`, player.name, npc.name);
            this._unlockAchievement('rejected');
        }
        this.state = this.world.getState();
        this.renderSidebar();
    }

    // === Town Management ===
    // ============================================================
    // v5.57.0 雙城P2:玩家馬車過場拜訪
    // ============================================================
    // v5.59.4 像素馬車圖(與地圖馬車站同款配色):UI 各處不再用系統 emoji,改用方塊 SVG
    _coachPixelSvg(px) {
        const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
        const hx = 2, hy = 5, cx0 = 24, cy0 = 3;
        const wheel = (wx, wy) => R(wx - 3, wy - 4, 6, 8, '#3a2716') + R(wx - 4, wy - 3, 8, 6, '#3a2716') + R(wx - 1, wy - 1, 2, 2, '#8a6a44');
        const body =
            R(cx0 - 7, cy0 + 10, 8, 2, '#4a3020') + // 車轅
            R(cx0, cy0, 22, 14, '#7a5236') +        // 車廂
            R(cx0 - 1, cy0 - 2, 24, 4, '#5c3d26') + // 車頂
            R(cx0 + 4, cy0 + 4, 5, 5, '#2e1f12') + R(cx0 + 13, cy0 + 4, 5, 5, '#2e1f12') + // 車窗
            R(cx0, cy0 + 11, 22, 1, '#c9a86a') +    // 飾條
            wheel(cx0 + 6, cy0 + 16) + wheel(cx0 + 18, cy0 + 16) +
            R(hx + 4, hy - 2, 2, 2, '#3a2716') +    // 耳
            R(hx + 3, hy + 2, 5, 6, '#8a5a34') +    // 頸
            R(hx, hy, 6, 4, '#7a4c2a') +            // 頭
            R(hx - 2, hy + 2, 3, 2, '#7a4c2a') +    // 口鼻
            R(hx + 6, hy, 2, 7, '#3a2716') +        // 鬃毛
            R(hx + 4, hy + 6, 12, 6, '#8a5a34') +   // 軀幹
            R(hx + 16, hy + 6, 2, 7, '#3a2716') +   // 尾巴
            R(hx + 1, hy + 1, 1, 1, '#151515') +    // 眼
            R(hx + 5, hy + 12, 2, 5, '#6b4222') + R(hx + 8, hy + 12, 2, 5, '#6b4222') + R(hx + 12, hy + 12, 2, 5, '#6b4222') + R(hx + 14, hy + 12, 2, 5, '#6b4222') + // 四腿
            R(hx + 5, hy + 16, 2, 1, '#2e1f12') + R(hx + 8, hy + 16, 2, 1, '#2e1f12') + R(hx + 12, hy + 16, 2, 1, '#2e1f12') + R(hx + 14, hy + 16, 2, 1, '#2e1f12'); // 蹄
        return `<svg width="${48 * px}" height="${24 * px}" viewBox="0 0 48 24" shape-rendering="crispEdges" style="image-rendering:pixelated;vertical-align:middle">${body}</svg>`;
    }
    _showCoachDialog() {
        if (document.getElementById('coach-dialog')) return;
        // v5.59.5 最後一道防線:自己(同 id 或同名)絕不出現在目的地清單
        const towns = (this.world?.otherTowns || []).filter(tw => tw.id !== this.currentTownId && tw.name !== this.world?.townName);
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const ov = document.createElement('div');
        ov.id = 'coach-dialog';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,10,24,0.72);z-index:9999;display:flex;align-items:center;justify-content:center';
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:14px;padding:18px;max-width:330px;width:86%';
        let inner = `<div style="font-weight:bold;font-size:1rem;margin-bottom:6px;display:flex;align-items:center;gap:8px">${this._coachPixelSvg(1)}<span>${t('馬車站')}</span></div>`;
        if (!towns.length) {
            inner += `<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6">${t('車伕靠在車轅上打盹：「往海風鎮的沿海道路還封著呢——聽說鎮子發展起來，就會組修路隊把路打通。急的話，先跟商隊買點那邊的魚乾解解饞吧。」')}</div>`;
        } else {
            inner += `<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">${t('車伕拍拍車板：「要去哪兒？路上得顛個兩天。」')}</div>`;
            towns.forEach((twn, i) => {
                inner += `<button class="trade-btn coach-go" data-idx="${i}" style="width:100%;margin:3px 0;padding:9px;display:flex;align-items:center;justify-content:center;gap:7px">${this._coachPixelSvg(0.75)}<span>${t('前往')} ${esc(twn.name)}</span></button>`;
            });
        }
        if (towns.length) inner += `<button class="trade-btn coach-caravan" style="width:100%;margin-top:8px;padding:9px">🐪 ${t('押商隊')}${this.world?.playerCaravan?.active ? `（${t('在路上')}）` : ''}</button>`; // v5.92.0
        inner += `<button class="trade-btn coach-close" style="width:100%;margin-top:8px;padding:8px;opacity:0.8">${t('下次再說')}</button>`;
        card.innerHTML = inner;
        ov.appendChild(card);
        document.body.appendChild(ov);
        ov.addEventListener('click', (e) => {
            const go = e.target.closest?.('.coach-go');
            if (go) { const twn = towns[parseInt(go.dataset.idx, 10)]; ov.remove(); if (twn) this._coachTravelTo(twn.id, twn.name); return; }
            if (e.target.closest?.('.coach-caravan')) { ov.remove(); this._showCaravanDialog(); return; } // v5.92.0
            if (e.target.closest?.('.coach-close') || e.target === ov) ov.remove();
        });
    }
    // ============================================================
    // v5.92.0 押商隊(README H2):選貨/目的鎮/護衛/路線,即時報價,出發;小鎮分頁顯示進度與戰績
    // ============================================================
    // v5.98.0 季末回顧彈窗:換季那天自動彈,故事分頁也可重看;最多留 4 季
    // v6.0.0 B14：_showSeasonRecap … 等方法移到 app-loop.js

    // v6.0.0 B14：_getTownList … 等方法移到 app-towns.js

    setupTileMap() {
        const canvas = document.getElementById('town-map-canvas');
        const mapPanel = document.querySelector('.map-panel');
        const mainLayout = document.querySelector('.main-layout');
        console.log('[RimTown] setupTileMap: canvas=', !!canvas,
            'mapPanel=', mapPanel ? `${mapPanel.offsetWidth}x${mapPanel.offsetHeight}` : 'null',
            'mainLayout=', mainLayout ? `${mainLayout.offsetWidth}x${mainLayout.offsetHeight}` : 'null');
        if (mapPanel) {
            const rect = mapPanel.getBoundingClientRect();
            console.log('[RimTown] mapPanel rect:', JSON.stringify({top:rect.top,left:rect.left,width:rect.width,height:rect.height}));
        }
        this.tileMap = new PixelTileMap(canvas);
        this.tileMap.onClick = (locId) => { this._hideNpcCard(); this.playerMoveTo(locId); };
        this.tileMap.onAgentClick = (agentId) => this.onAgentClick(agentId);
        this.tileMap.onCoachClick = () => this._showCoachDialog(); // v5.57.0 馬車站
        // v4.2.0 礦石鎮式操作:手動移動時同步玩家邏輯位置(節流 400ms)
        this.tileMap.onPlayerMoved = (x, y) => {
            const now = Date.now();
            if (this._locSyncAt && now - this._locSyncAt < 400) return;
            this._locSyncAt = now;
            const loc = this.tileMap.getLocationAt(x, y);
            const player = this.world?.agents?.['player'];
            if (loc && player && player.currentLocation !== loc) { player.currentLocation = loc; this.world?.questSystem?.onVisit?.(loc); try { this.world?.requests?.onVisit(loc, this.world); } catch (e) {} } // v5.83.0 任務條件:到過哪;v5.91.0 委託跑腿
        };
        this._setupTownOverlays();
        this._generateTileMapLayout();
    }

    // v5.58.0 鎮名同步到全部三處標題(桌面 h1/手機標題/側欄標),不再永遠寫死邊境鎮
    _updateHeaderTownName(name) {
        const n = name || this.world?.townName || '邊境鎮';
        const title = document.querySelector('.mobile-title');
        if (title) title.textContent = n;
        const h1 = document.querySelector('.rimtown-container h1[data-i18n], .rimtown-container header h1, #rimtown-header h1');
        if (h1) h1.textContent = t(n);
        document.querySelectorAll('.rt-title-zh').forEach(el => { el.textContent = n; });
    }

    _generateTileMapLayout() {
        const locations = this.state.locations?.locations || {};
        console.log('[RimTown] _generateTileMapLayout: locationCount=', Object.keys(locations).length);
        // v5.75.0 依城鎮主題產圖(海風鎮=海岸版面:海面、沙灘、棧橋、燈塔)
        const theme = this.world?.townTheme || this.state?.townTheme || 'frontier';
        this.tileMap.generateLayout(locations, theme);
        this._mapGenerated = true;
    }

    _startRenderLoop() {
        let _renderLogCount = 0;
        let _guidanceFrameCount = 0;
        const loop = () => {
            // Update quest guidance banner every ~300 frames (~5 seconds)
            if (++_guidanceFrameCount % 300 === 0) this._updateQuestGuidance();
            if (this.tileMap && this._mapGenerated) {
                if (_renderLogCount < 3) {
                    const parent = this.tileMap.canvas?.parentElement;
                    const rect = parent?.getBoundingClientRect();
                    console.log('[RimTown] renderLoop frame', _renderLogCount, ': parent=', rect ? `${rect.width}x${rect.height}` : 'null',
                        'canvas=', `${this.tileMap.canvas?.width}x${this.tileMap.canvas?.height}`,
                        'grid=', !!this.tileMap.grid);
                    _renderLogCount++;
                }
                const agents = this.state?.agents || {};
                const player = agents['player'];
                this.tileMap.decorations = this.world?.decorations || [];
                this.tileMap.constructionSites = (this.world?.buildings?.projects || []).filter(p => Number.isFinite(p.siteX));
                // v5.60.1 工廠地基計算需避開玩家已蓋好的選址建築
                this.tileMap.sitedCompleted = (this.world?.buildings?.completed || []).filter(b => Number.isFinite(b.siteX));
                // v5.62.0 住房同步:夫妻同住、單身獨居,房子不夠就加蓋(每 5 秒檢查一次,兩鎮通用)
                if (!this._housingAt || Date.now() - this._housingAt > 5000) {
                    this._housingAt = Date.now();
                    try { this._syncHousing(); } catch (e) {}
                }
                // v4.9.0 相鄰組合發現慶祝(建築完工在 dailyUpdate 內觸發,這裡輪詢顯示)
                if (this.world?._pendingComboNotifs?.length) {
                    const c = this.world._pendingComboNotifs.shift();
                    this.bgm?.sfx?.('coin');
                    this.tileMap?.spawnFxOnAgent?.('player', c.icon, { color: '#ffd166', burst: '✨', burstCount: 8, size: 13 });
                    this._showCenterNotification({
                        icon: c.icon,
                        title: `✨ ${t('發現相鄰組合!')}`,
                        name: `${c.icon} ${t(c.name)}`,
                        desc: `${c.desc} — ${t('小鎮美觀與繁榮加成,全鎮心情大好!把相配的東西放在一起,還有更多組合等你發現')}`,
                        autoDismiss: 7000,
                    });
                }
                // v5.0.0 心動事件互動卡輪詢
                if (this.world?._pendingHeartEvents?.length) {
                    const h = this.world._pendingHeartEvents.shift();
                    this._showHeartEventCard(h);
                }
                // v5.1.0 名場面直播輪詢
                if (this.world?._pendingDramaScenes?.length) {
                    const ds = this.world._pendingDramaScenes.shift();
                    this._showDramaScene(ds);
                }
                // v5.3.0 本週小鎮頭條輪詢
                if (this.world?._pendingWeeklyDigest) {
                    const dg = this.world._pendingWeeklyDigest;
                    this.world._pendingWeeklyDigest = null;
                    this._showWeeklyDigest(dg);
                }
                // v5.4.0 夢想達成慶祝輪詢
                if (this.world?._pendingMilestones?.length) {
                    const ms = this.world._pendingMilestones.shift();
                    this._showMilestoneCard(ms);
                }
                this.tileMap.updateAgents(agents, this.state.locations?.locations || {}, this.chatTarget);
                // Pass time to tilemap for day/night cycle
                if (this.state.clock) {
                    this.tileMap.timeHour = this.state.clock.hour ?? 12;
                    this.tileMap.lighthouseUpgraded = !!this.world?.harborFlags?.lighthouseUpgraded; // v5.84.0
                    this.tileMap.timeMinute = this.state.clock.minute ?? 0;
                    this.tileMap.dayCount = this.world?.clock?.totalDays ?? 0; // v5.23.0 月相
                }
                this.tileMap.weatherType = this.world?.weather?.current || 'clear'; // v5.23.0 天氣粒子
                this.tileMap.season = this.state?.clock?.season || this.world?.clock?.season || '春季'; // v5.24.0 季節色調
                this.tileMap.explorationData = this.state.exploration || {};
                this.tileMap.graveyardData = (this.state.lifecycle || {}).graveyard || [];
                this.tileMap.festivalData = this.state.festivals || {};
                this.tileMap.render(agents, this.selectedAgent, player?.current_location, this.world?.buildings?.completed || [], {
                    farm: this.state?.farm, processing: this.state?.processing, industry: this.state?.industry,
                });
                this._updateTownOverlays();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    async loadSettings() {
        try {
            const speed = localStorage.getItem('sim_speed');
            if (speed) this.simSpeed = parseInt(speed);
            // v5.65.0 AI 全面內建:所有金鑰由伺服器(Vercel 環境變數)統一保管,玩家端不再有任何
            // 自備金鑰設定。舊版留在本機/擴充功能儲存區的金鑰一律清除。
            try {
                localStorage.removeItem('llm_api_key');
                localStorage.removeItem('fallback_groq_key');
                localStorage.removeItem('llm_model');
                if (typeof chrome !== 'undefined' && chrome.storage) chrome.storage.local.remove(['llm_provider', 'llm_api_key', 'fallback_groq_key']);
            } catch (e) {}
            // 有 /api/chat 的站(rimtown.cc)走內建 AI;WordPress 版沒有代理端點 → 模擬對話
            const provider = (typeof rimtownAuth === 'undefined' && location.protocol.startsWith('http')) ? 'server' : 'none';
            localStorage.setItem('llm_provider', provider);
            if (provider === 'server') {
                this.llmClient = new LLMClient('server', 'server');
                console.log('[RimTown] LLM client: 小鎮內建 AI(/api/chat)');
            } else {
                this.llmClient = null;
            }
        } catch(e) { console.log('[RimTown] Settings load error:', e); }
    }

    // v5.65.0 AI 全面內建:設定只剩模擬速度(AI 由伺服器統一提供,玩家端沒有可填的金鑰)
    async saveSettings(speed) {
        this.simSpeed = parseInt(speed);
        this.baseSimSpeed = this.simSpeed;
        // Reset speed buttons to 1x
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        const btn1x = document.querySelector('.btn-speed[data-speed="1"]');
        if (btn1x) btn1x.classList.add('active');
        if (!this.llmClient && typeof rimtownAuth === 'undefined' && location.protocol.startsWith('http')) {
            this.llmClient = new LLMClient('server', 'server');
        }
        this.world.conversationEngine = this.llmClient ? this._makeConversationEngine() : new ConversationEngine();
        this.restartSimulation();
        this._updateLLMStatus();
        localStorage.setItem('sim_speed', speed);
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) await chrome.storage.local.set({ sim_speed: speed });
        } catch(e) {}
        // v5.33.0 設定推上帳號雲端(額度隨帳號走)
        this._pushCloudSettings();
    }

    // v5.73.0 AI 對話語言:auto=跟隨介面(預設,不落地);zh/en 存本機並推上帳號
    _setDialogueLang(v) {
        try {
            if (v === 'zh' || v === 'en') localStorage.setItem('rimtown_dialogue_lang', v);
            else localStorage.removeItem('rimtown_dialogue_lang');
        } catch (e) {}
    }
    _saveSettingsFromTab() {
        const speed = document.getElementById('settings-tab-speed')?.value || '2000';
        // v5.29.0 NPC 每日 AI 額度(v5.37.0 留空=無上限)
        const npcBudgetEl = document.getElementById('settings-tab-npcbudget');
        if (npcBudgetEl) {
            const rawVal = String(npcBudgetEl.value || '').trim();
            if (rawVal === '') { try { localStorage.removeItem('rimtown_npc_llm_budget'); } catch (e) {} }
            else {
                const npcBudgetRaw = parseInt(rawVal, 10);
                if (Number.isFinite(npcBudgetRaw) && npcBudgetRaw >= 0) localStorage.setItem('rimtown_npc_llm_budget', String(Math.min(9999, npcBudgetRaw)));
            }
        }
        // v5.73.0 AI 對話語言
        const dlEl = document.getElementById('settings-tab-dialoglang');
        if (dlEl) this._setDialogueLang(dlEl.value);
        this.saveSettings(speed);
        const langSelect = document.getElementById('lang-select') || document.getElementById('settings-tab-lang');
        if (langSelect) {
            I18N.setLang(langSelect.value);
            if (typeof renderCurrentTab === 'function') renderCurrentTab();
        }
        this.world.logMessage('system', t('設定已儲存'));
        this.renderSidebar();
    }

    _updateLLMStatus() {
        const el = document.getElementById('llm-status');
        if (!el) return;
        if (this.llmClient && this.world.conversationEngine?.llm) {
            const hasFallback = !!this.llmClient.fallbackGroqKey;
            if (this.llmClient.provider === 'server') {
                // v5.64.0 內建小鎮 AI:徽章顯示「AI:小鎮內建」
                el.textContent = t('AI:小鎮內建');
                el.className = 'llm-status connected';
                el.title = t('🏘️ 內建小鎮 AI 已啟用，不需填任何金鑰（登入每日 100 則）');
            } else {
                const providerLabel = this.llmClient.provider + (hasFallback ? t('+備用') : '');
                el.textContent = 'AI:' + providerLabel;
                el.className = 'llm-status connected';
                el.title = t('AI 已連接：') + this.llmClient.provider + (hasFallback ? t('（備用：Groq）') : '');
            }
        } else {
            el.textContent = t('AI:未連接');
            el.className = 'llm-status disconnected';
            el.title = t('此站沒有內建 AI 代理端點，村民對話走內建模擬');
        }
    }

    startSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        // v5.43.0 小鎮編年史:換日時把整天的作息/行程/足跡/對話歸檔進 IndexedDB
        if (this.world) this.world.onDayArchive = (arc) => this._chroniclePut(arc);
        this.simInterval = setInterval(() => {
            this.world.tick();
            this.state = this.world.getState();
            this._updateBGMPhase();
            this.render();
            // Check for ending trigger
            if (this.world.multiEnding?.endingTriggered && !this._endingShown) {
                this._endingShown = true;
                this._showEndingOverlay();
            }
        }, this.simSpeed);
    }

    restartSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        this.startSimulation();
    }

    setupTabListeners() {
        // v5.20.0 三大入口收束:小鎮 / 居民 / 故事(+設定)。主鍵即該組的「頭」分頁。
        this._mobileTabGroups = {
            economy: [ // 小鎮
                { key: 'economy', label: t('經濟'), icon: '💰' },
                { key: 'industry', label: t('產業'), icon: '🏭' },
            ],
            residents: [ // 居民
                { key: 'residents', label: t('居民'), icon: '👥' },
                { key: 'chat', label: t('聊天'), icon: '💬' },
                { key: 'relmap', label: t('關係'), icon: '💞' },
            ],
            quest: [ // 故事
                { key: 'quest', label: t('任務'), icon: '⚔️' },
                { key: 'events', label: t('事件'), icon: '📰' },
                { key: 'records', label: t('紀錄'), icon: '📋' },
                { key: 'achievements', label: t('成就'), icon: '🏆' },
            ],
        };
        // Reverse lookup: sub-tab -> parent main tab
        this._mobileSubToMain = {};
        for (const [main, subs] of Object.entries(this._mobileTabGroups)) {
            for (const sub of subs) {
                this._mobileSubToMain[sub.key] = main;
            }
        }
        // 抽屜式細節/封存視圖歸屬「居民」組,讓對應主入口保持高亮
        this._mobileSubToMain['detail'] = 'residents';
        this._mobileSubToMain['chat-archives'] = 'residents';

        const updateTabHighlight = (tabName) => {
            document.querySelectorAll('.rt-sidebar-tabs > button[data-tab]').forEach(b => b.classList.remove('active'));
            // v5.20.0 兩種介面都把子分頁對應回三大主入口來高亮
            const highlightTab = this._mobileSubToMain[tabName] || tabName;
            const mainBtn = document.querySelector(`.rt-sidebar-tabs > button[data-tab="${highlightTab}"]`);
            if (mainBtn) mainBtn.classList.add('active');
        };

        // Main tab bar buttons (including hidden ones for desktop)
        document.querySelectorAll('.rt-sidebar-tabs > button[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sidebar = document.getElementById('rimtown-sidebar');
                const isMobile = window.innerWidth <= 768;

                // On mobile, clicking a main tab resets to the first sub-tab of the group
                const targetTab = isMobile && this._mobileTabGroups[btn.dataset.tab]
                    ? this._mobileTabGroups[btn.dataset.tab][0].key
                    : btn.dataset.tab;

                if (this._isTabLocked(btn.dataset.tab)) { this._lockedAlert(btn.dataset.tab); return; }
                if (isMobile) {
                    const currentMain = this._mobileSubToMain[this.activeTab] || this.activeTab;
                    if (currentMain === btn.dataset.tab && sidebar && !sidebar.classList.contains('mobile-collapsed')) {
                        sidebar.classList.add('mobile-collapsed');
                        return;
                    }
                    if (sidebar) sidebar.classList.remove('mobile-collapsed');
                }

                this.activeTab = targetTab;
                updateTabHighlight(targetTab);
                this.renderSidebar();
            });
        });

        // Store helper for external use (selectAgent, startChat etc.)
        this._updateTabHighlight = updateTabHighlight;
    }

    setupMobileSidebar() {
        const sidebar = document.getElementById('rimtown-sidebar');
        if (!sidebar) return;

        // Start collapsed on mobile (only tab bar visible)
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-collapsed');
            this._setupKairoUI();
        }

        // Drag handle: toggle expanded/collapsed
        const dragHandle = document.getElementById('mobile-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.toggle('mobile-collapsed');
                }
            });
            // Touch drag support: swipe up = expand, swipe down = collapse
            let startY = 0;
            dragHandle.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 768) return;
                startY = e.touches[0].clientY;
                e.preventDefault();
            }, { passive: false });
            dragHandle.addEventListener('touchend', (e) => {
                if (window.innerWidth > 768) return;
                const endY = e.changedTouches[0].clientY;
                const diff = startY - endY;
                if (diff > 30) {
                    sidebar.classList.remove('mobile-collapsed');
                } else if (diff < -30) {
                    sidebar.classList.add('mobile-collapsed');
                }
            });
        }
    }

    setupMobileInputFix() {
        if (window.innerWidth > 768) return;
        const sidebar = document.querySelector('.rt-sidebar');
        if (!sidebar) return;

        // When an input/select inside sidebar gains focus, scroll it into view
        // and expand sidebar so the virtual keyboard doesn't hide the field
        sidebar.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                sidebar.classList.add('keyboard-open');
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        });
        sidebar.addEventListener('focusout', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                sidebar.classList.remove('keyboard-open');
            }
        });
    }

    setupMobileHeader() {
        if (window.innerWidth > 768) return;

        // Pause/play toggle
        const mobilePauseBtn = document.getElementById('mobile-btn-pause');
        if (mobilePauseBtn) {
            mobilePauseBtn.addEventListener('click', () => {
                const wantPaused = this._notifCardOpen ? !this._pausedBeforeNotif : !this.world.paused;
                this._setPaused(wantPaused);
                mobilePauseBtn.textContent = wantPaused ? '▶' : '⏸';
                mobilePauseBtn.classList.toggle('paused', wantPaused);
            });
        }

        // Menu dropdown toggle
        const menuBtn = document.getElementById('mobile-btn-menu');
        const menuDropdown = document.getElementById('mobile-menu-dropdown');
        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.toggle('hidden');
            });
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!menuDropdown.contains(e.target) && e.target !== menuBtn) {
                    menuDropdown.classList.add('hidden');
                }
            });
        }

        // Wire mobile menu buttons to existing functionality
        // Close menu when any data-action button inside is clicked
        menuDropdown?.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => menuDropdown?.classList.add('hidden'));
        });
        document.getElementById('mobile-new-game')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-new-game')?.click();
        });
        document.getElementById('mobile-save')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-save')?.click();
        });
        document.getElementById('mobile-btn-settings')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-settings')?.click();
        });
        document.getElementById('mobile-btn-account')?.addEventListener('click', () => {
            menuDropdown?.classList.add('hidden');
            document.getElementById('btn-account')?.click();
        });

        // Speed controls in mobile menu
        menuDropdown?.querySelectorAll('.btn-speed').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const speed = btn.dataset.speed;
                // Sync with desktop speed buttons
                document.querySelectorAll('.controls .btn-speed').forEach(b => {
                    if (b.dataset.speed === speed) b.click();
                });
                // Update mobile speed button styles
                menuDropdown.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // Global event delegation - handles all dynamic clicks via data-action attributes
    setupEventDelegation() {
        const container = document.getElementById('rimtown-app') || document.body;
        container.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            const val = el.dataset.val || '';
            e.stopPropagation();
            switch(action) {
                // Town management
                case 'show-towns': this.showTownManager(); break;
                case 'switch-town': this.switchTown(val); break;
                case 'rename-town': this.renameTownPrompt(val); break;
                case 'delete-town': this.deleteTownConfirm(val); break;
                case 'delete-local-town': this.deleteLocalTownConfirm(val); break; // v5.96.0 B13
                case 'create-town': this.createNewTown(); break;
                case 'close-town-modal': document.getElementById('town-modal')?.classList.add('hidden'); this.world.paused = !!this._pausedBeforeTownModal; break;
                // Chat
                case 'start-chat': this.startChatWith(val); break;
                case 'edit-look': this._openLookEditor(val); break; // v5.89.0
                case 'req-act': this._requestAct(val); break; // v5.91.0 委託板
                case 'req-buy-ap': this._requestBuyAP(); break;
                case 'open-caravan': this._showCaravanDialog(); break; // v5.92.0
                case 'recap-open': this._showSeasonRecap(); break; // v5.98.0
                case 'recap-close': document.getElementById('season-recap')?.remove(); break;
                case 'perk-pick': { const r = this.world?.growth?.choose(val, this.world); if (r?.ok) { this.state = this.world.getState(); try { this.renderSidebar(); } catch (e) {} } break; } // v5.94.0
                case 'look-set': this._setLookDraft(val); break;
                case 'look-random': this._randomLookDraft(); break;
                case 'look-reset': this._applyLookDraft('reset'); break;
                case 'look-save': this._applyLookDraft('save'); break;
                case 'look-cancel': document.getElementById('look-modal')?.remove(); break;
                case 'send-chat': this._sendFromInput(); break;
                case 'chat-intent': this._sendIntent(val); break;
                case 'open-gift': this._showGiftPicker(); break;
                case 'chat-view': this._chatView = val === 'feed' ? 'feed' : 'dm'; if (val === 'feed') this.world._feedUnread = 0; this.renderSidebar(); break;
                case 'feed-like': this._feedLike(val); break;
                case 'feed-comment': this._feedCommentPost = this._feedCommentPost === val ? null : val; this.renderSidebar(); break;
                case 'feed-comment-send': this._feedCommentSend(val); break;
                case 'open-rumor': this._showRumorPicker(); break;
                case 'rumor-about': this._rumorPickTone(val); break;
                case 'rumor-send': this._sendRumor(val); break;
                case 'give-gift': this._giveGift(val); break;
                case 'show-leaderboard': this._showLeaderboard(); break;
                case 'decor-place': this._enterDecorMode(val); break;
                case 'relmap-filter':
                    if (this._relmapFilters) { this._relmapFilters[val] = !this._relmapFilters[val]; this.renderSidebar(); }
                    break;
                case 'show-archives': this.showChatArchives(); break;
                case 'manual-archive': this.manualArchiveChat(); break;
                case 'back-to-chat': this.activeTab = 'chat'; this.renderSidebar(); break;
                case 'view-archive': this.viewArchive(parseInt(val)); break;
                case 'export-archive': this.exportArchivedChat(parseInt(val)); break;
                case 'delete-archive': this.deleteArchivedChat(parseInt(val)); break;
                case 'back-to-archives': this._viewingArchive = null; this.activeTab = 'chat-archives'; this.renderSidebar(); break;
                case 'filter-archive-npc': this._archiveNpcFilter = val || null; this.renderSidebar(); break;
                // Agent
                case 'select-agent': this.selectAgent(val); break;
                // NPC conversation expand
                case 'toggle-convo': el.classList.toggle('expanded'); break;
                // Economy
                case 'trade': { const [idx, amount] = val.split(','); this.executeTrade(parseInt(idx), parseInt(amount)); this._unlockAchievement('first_trade'); this._tradeCount++; } break;
                case 'build': this.startBuilding(val); break;
                case 'upgrade-building': this.startBuildingUpgrade(val); break;
                case 'research': this.startResearch(val); break;
                case 'send-expedition': this.sendExpedition(val); break;
                // Auth & Cloud
                case 'cloud-sync-up': document.getElementById('account-menu-popup')?.remove(); this._syncToCloud(); break;
                case 'cloud-sync-down': document.getElementById('account-menu-popup')?.remove(); this._showCloudSaves(); break;
                case 'show-achievements': document.getElementById('account-menu-popup')?.remove(); this._showAchievementsTab(); break;
                case 'auth-logout': document.getElementById('account-menu-popup')?.remove(); this._doLogout(); break;
                case 'load-cloud-save': this._loadCloudSave(val); break;
                case 'delete-cloud-save': this._deleteCloudSave(val); break;
                // Player interaction
                case 'player-vote': this._playerVote(val); break;
                case 'run-for-mayor': this._showRunForMayorModal(); break;
                case 'rel-timeline': this._showRelTimeline(val); break; // v5.48.0 關係時間軸
                // v5.43.0 小鎮編年史
                case 'chronicle-view': this._chronicleGet(val).then(arc => { this._chronicleView = arc; this.renderSidebar(); }).catch(() => {}); break;
                case 'chronicle-export-json': this._chronicleExportJSON().catch(e => this._gameAlert(t('匯出失敗：') + e.message, '📚')); break;
                case 'chronicle-export-convo': this._chronicleExportConvoCSV().catch(e => this._gameAlert(t('匯出失敗：') + e.message, '📚')); break;
                case 'chronicle-export-sched': this._chronicleExportScheduleCSV().catch(e => this._gameAlert(t('匯出失敗：') + e.message, '📚')); break;
                case 'chronicle-clear':
                    if (confirm(t('確定要清空編年史資料庫嗎？此操作無法復原（不影響遊戲存檔）。'))) {
                        this._chronicleClear().then(() => this.renderSidebar()).catch(() => {});
                    }
                    break;
                case 'player-propose': this._playerPropose(val); break;
                case 'player-flirt': this._playerFlirt(val); break;
                // Mobile group sub-tab switching
                case 'mobile-group-tab':
                    if (this._isTabLocked(val)) { this._lockedAlert(val); break; }
                    this.activeTab = val;
                    if (this._updateTabHighlight) this._updateTabHighlight(val);
                    this.renderSidebar();
                    break;
                // Industry sub-tabs
                case 'industry-subtab': this._industrySubTab = val; this.renderSidebar(); break;
                case 'economy-subtab': this._economySubTab = val; this.renderSidebar(); break;
                // v5.51.0 勞動力排班:鎮長對加工線下休工/正常/加班指令
                case 'work-policy': {
                    const [good, mode] = (val || '').split(',');
                    if (this.world && good && ['off','normal','extra'].includes(mode)) {
                        if (!this.world.workPolicy) this.world.workPolicy = {};
                        this.world.workPolicy[good] = mode;
                        const modeLabel = mode === 'off' ? t('休工') : mode === 'extra' ? t('加班') : t('正常排班');
                        this.world.logMessage('economy', `${playerTitle(this.world)}${t('下令：')}${modeLabel}（${t('明日生效')}）`);
                        this.renderSidebar();
                    }
                    break;
                }
                case 'records-subtab': this._recordsSubTab = val; this.renderSidebar(); break;
                // Industry
                case 'choose-industry': this._chooseIndustry(val); break;
                case 'upgrade-industry': this._upgradeIndustry(val); break;
                // Farm
                case 'till-plot': this._tillPlot(parseInt(val)); break;
                case 'plant-crop': { const [plotId, cropKey] = val.split(','); this._plantCrop(parseInt(plotId), cropKey); } break;
                case 'water-plot': this._waterPlot(parseInt(val)); break;
                case 'fertilize-plot': this._fertilizePlot(parseInt(val)); break;
                case 'harvest-plot': this._harvestPlot(parseInt(val)); break;
                case 'clear-withered': this._clearWithered(parseInt(val)); break;
                // Factory
                case 'build-factory': this._buildFactory(val); break;
                case 'set-recipe': { const [fKey, rId] = val.split(','); this._setRecipe(fKey, rId); } break;
                case 'assign-worker': { const [fKey, aId] = val.split(','); this._assignWorker(fKey, aId); } break;
                case 'collect-product': { const [fKey, res, amt] = val.split(','); this._collectProduct(fKey, res, parseInt(amt)); } break;
                case 'sell-product': { const [fKey, res, amt] = val.split(','); this._sellProduct(fKey, res, parseInt(amt)); } break;
                case 'fulfill-order': this._fulfillOrder(val); break;
                // Newspaper
                case 'view-newspaper': this._viewNewspaper(parseInt(val)); break;
                case 'replay-drama': { const arc = this.world?.dramaArchive || this.state?.dramaArchive || []; const s = arc[parseInt(val, 10)]; if (s) this._showDramaScene(s); break; }
                case 'news-goto': this._newsGoto(val); this._firstDayMark('consequence'); break;
                case 'focus-go': this._focusGo(val); break; // v5.31.0 今日焦點
                case 'close-chat': this.chatTarget = null; this._whisperArmed = false; this.renderSidebar(); break; // v5.35.0 關閉對話回聯絡人
                case 'story-npc': { const ag = this.world?.agents?.[val]; if (ag) this._showNpcCard(val); break; } // v5.31.0 故事流→人物卡
                case 'firstday-skip': this._dismissFirstDay(); break;
                case 'show-identity': this._showTownIdentity(); break;
                case 'goto-tab': {
                    // v5.35.3 手機版:開浮動卡才看得到面板
                    if (this._kairoReady && window.innerWidth <= 768) this._kairoCardOpen = true;
                    this.activeTab = val; this._updateTabHighlight?.(val); this.state = this.world.getState(); this.renderSidebar(); break;
                }
                // Custom NPC
                case 'show-custom-npc': this._showCustomNPCModal(); break;
                case 'create-custom-npc': this._createCustomNPC(); break;
                case 'close-custom-npc': document.getElementById('custom-npc-modal')?.remove(); break;
                // Ending
                case 'close-ending': document.getElementById('ending-overlay')?.remove(); break;
                case 'start-newgame-plus': this._startNewGamePlus(); break;
                // v4.0: Shop
                case 'shop-buy': { const [item, amt] = val.split(','); this._shopBuy(item, parseInt(amt)||1); } break;
                case 'shop-sell': { const [item, amt] = val.split(','); this._shopSell(item, parseInt(amt)||1); } break;
                // v4.0: Job action
                // v4.0: Quest refresh
                case 'quest-refresh': if (this.world.questSystem) { this.world.questSystem.checkProgress(this.world); this.state = this.world.getState(); this.renderSidebar(); } break;
                // v4.0: News reaction
                case 'news-react': this._newsReaction(val); break;
                // v4.0: Council vote
                case 'council-vote': this._councilVote(val); break;
                // Settings tab actions
                case 'settings-save-all': this._saveSettingsFromTab(); break;
                case 'settings-login': document.getElementById('auth-modal')?.classList.remove('hidden'); break;
                case 'settings-register': {
                    document.getElementById('auth-modal')?.classList.remove('hidden');
                    document.querySelectorAll('.auth-tab').forEach(_tw => _tw.classList.toggle('active', _tw.dataset.authTab === 'register'));
                    document.getElementById('auth-login-form')?.classList.add('hidden');
                    document.getElementById('auth-register-form')?.classList.remove('hidden');
                    break;
                }
                case 'settings-logout': this._doLogout(); this.renderSidebar(); break;
                case 'settings-sync-cloud': this._syncToCloud(); break;
                case 'settings-save-game': this.saveGame(); break;
                case 'settings-export': this.exportSave(); break;
                case 'settings-import': this.importSave(); break;
                // v5.59.2 背景音樂靜音切換
                case 'settings-bgm-mute': { if (this.bgm) { this.bgm.toggleMute(); this.renderSidebar(); } break; }
                // v5.63.0 管理員操作
                case 'admin-load-users': this._adminLoadUsers(); break;
                case 'admin-load-invites': this._adminLoadInvites(); break;
                case 'admin-invite-create': this._adminInviteCreate(); break;
                case 'admin-invite-toggle': this._adminInviteToggle(val); break;
                case 'admin-invite-delete': this._adminInviteDelete(val); break;
                case 'admin-ban-user': this._adminDo('ban', val, t('確定要封鎖')); break;
                case 'admin-unban-user': this._adminDo('unban', val, t('確定要解除封鎖')); break;
                case 'admin-delete-user': this._adminDo('delete', val, t('⚠️ 確定要刪除帳號？會連同所有雲端存檔一起刪除且無法復原：')); break;
                case 'settings-toggle-pause': { const wantPaused = this._notifCardOpen ? !this._pausedBeforeNotif : !this.world.paused; this._setPaused(wantPaused); this.world.logMessage('system', wantPaused ? t('遊戲已暫停。') : t('遊戲已繼續。')); this.renderSidebar(); break; }
                case 'settings-speed-mult': {
                    const mult = parseFloat(val) || 1;
                    this._speedMultiplier = mult;
                    if (!this.baseSimSpeed) this.baseSimSpeed = this.simSpeed;
                    this.simSpeed = Math.round(this.baseSimSpeed / mult);
                    if (this.simInterval) clearInterval(this.simInterval);
                    this.simInterval = setInterval(() => {
                        this.world.tick(); this.state = this.world.getState(); this.render();
                    }, this.simSpeed);
                    this.renderSidebar();
                    break;
                }
                case 'settings-roster': { try { localStorage.setItem('rimtown_roster_mode', val === 'random' ? 'random' : 'scripted'); } catch(e){} this.renderSidebar(); break; }
                case 'settings-new-map': {
                    const name = prompt(t('為新城鎮命名：'), t('邊境鎮 ') + (this._getTownList().length + 1));
                    if (!name) break;
                    this.archiveChatHistory();
                    this._saveCurrentTown();
                    this.world.rosterMode = (localStorage.getItem('rimtown_roster_mode') === 'random') ? 'random' : 'scripted'; // v5.27.0 肉鴿隨機開局
                    this.world.reset();
                    if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
                    this.currentTownId = this._generateTownId(name);
                    this._saveCurrentTown(name);
                    this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
                    this.state = this.world.getState();
                    this._generateTileMapLayout();
                    if (this.tileMap) this.tileMap.agentPositions = {};
                    this._updateHeaderTownName(name);
                    this.world.logMessage('system', `${t('🏘️ 新城鎮「')}${name}${t('」已建立！')}`);
                    this.render();
                    break;
                }
                default: console.log('Unknown action:', action, val);
            }
        });
        // v5.35.4 手機鍵盤開啟時隱藏底部列(狀態帶/選單),避免蓋住聊天輸入框
        document.addEventListener('focusin', (e) => {
            if (e.target?.id === 'chat-input' && window.innerWidth <= 768) document.body.classList.add('rt-kb-open');
        });
        document.addEventListener('focusout', (e) => {
            if (e.target?.id === 'chat-input') {
                setTimeout(() => { if (document.activeElement?.id !== 'chat-input') document.body.classList.remove('rt-kb-open'); }, 120);
            }
        });
        // Handle Enter key in chat input via delegation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.id === 'chat-input') { this._sendFromInput(); return; }
            // Don't handle movement keys when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            // Only handle keys when game container is visible
            if (!document.getElementById('rimtown-app')) return;
            this._handleMovementKey(e);
        });
        // v4.2.0:keyup 釋放方向鍵;視窗失焦時清空避免卡鍵
        document.addEventListener('keyup', (e) => this._handleMovementKeyUp(e));
        window.addEventListener('blur', () => {
            if (this._keysDown) this._keysDown.clear();
            this._syncPlayerInput();
        });
    }

    // v5.54.0 統一暫停切換:按下立即有角落回饋;卡片顯示期間按的暫停/播放寫進
    // _pausedBeforeNotif,卡片關閉後套用你的選擇,不再被還原邏輯蓋掉
    _setPaused(v) {
        if (!this.world) return;
        if (this._notifCardOpen) {
            this._pausedBeforeNotif = v;
            this.world.paused = true; // 卡片顯示期間維持強制暫停
        } else {
            this.world.paused = v;
        }
        this._showCornerNotice({ icon: v ? '⏸' : '▶', title: v ? t('遊戲已暫停') : t('遊戲已繼續'), name: '', desc: '' });
        this.render();
    }

    setupControlListeners() {
        document.getElementById('btn-pause')?.addEventListener('click', () => {
            this._setPaused(true);
        });
        document.getElementById('btn-resume')?.addEventListener('click', () => {
            this._setPaused(false);
        });
        // Speed control buttons
        this.baseSimSpeed = this.simSpeed;
        const speedBtns = document.querySelectorAll('.btn-speed');
        console.log('[RimTown] Speed buttons found:', speedBtns.length, '| baseSimSpeed:', this.baseSimSpeed);
        speedBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const multiplier = parseFloat(btn.dataset.speed);
                console.log('[RimTown] Speed button clicked:', multiplier, 'x | baseSpeed:', this.baseSimSpeed, '| newSpeed:', Math.round(this.baseSimSpeed / multiplier));
                document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.simSpeed = Math.round(this.baseSimSpeed / multiplier);
                if (this.simInterval) clearInterval(this.simInterval);
                this.simInterval = setInterval(() => {
                    this.world.tick();
                    this.state = this.world.getState();
                    this.render();
                }, this.simSpeed);
            });
        });
        document.getElementById('btn-new-game')?.addEventListener('click', async () => {
            const name = prompt(t('為新城鎮命名：'), t('邊境鎮 ') + (this._getTownList().length + 1));
            if (!name) return;
            await this.archiveChatHistory();
            this._saveCurrentTown();
            this.world.reset();
            if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
            this.currentTownId = this._generateTownId(name);
            this._saveCurrentTown(name);
            this.chatTarget = null; this.selectedAgent = null; this.agentColors = {};
            this.state = this.world.getState();
            this._generateTileMapLayout();
            if (this.tileMap) this.tileMap.agentPositions = {};
            this.render();
        });
        document.getElementById('btn-save')?.addEventListener('click', async () => {
            await this.saveGame();
            this.state = this.world.getState();
            this.renderSidebar();
            this._renderTownList();
            // Sync to cloud if logged in
            if (this.auth.loggedIn) {
                this._syncToCloud();
            }
        });
        // Export/import buttons removed — save auto-syncs to cloud when logged in
    }

    setupSettingsListeners() {
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            document.getElementById('settings-modal')?.classList.remove('hidden');
            const speed = localStorage.getItem('sim_speed');
            if (speed) document.getElementById('sim-speed').value = speed;
            const langSelect = document.getElementById('lang-select');
            if (langSelect) langSelect.value = I18N.getLang();
            const dlSel = document.getElementById('dialog-lang-select'); // v5.73.0
            if (dlSel) { try { dlSel.value = localStorage.getItem('rimtown_dialogue_lang') || 'auto'; } catch (e) {} }
        });
        // 啟動時同步語言下拉選單,避免從設定頁籤儲存時被重設回預設值 zh
        {
            const langSelectInit = document.getElementById('lang-select');
            if (langSelectInit) langSelectInit.value = I18N.getLang();
        }
        document.getElementById('settings-save')?.addEventListener('click', () => {
            const speed = document.getElementById('sim-speed').value;
            const dlSel = document.getElementById('dialog-lang-select'); // v5.73.0
            if (dlSel) this._setDialogueLang(dlSel.value);
            this.saveSettings(speed);
            const langSelect = document.getElementById('lang-select');
            if (langSelect) {
                I18N.setLang(langSelect.value);
                if (typeof renderCurrentTab === 'function') renderCurrentTab();
            }
            document.getElementById('settings-modal')?.classList.add('hidden');
            this._gameAlert(t('設定已儲存。'), '✅');
        });
        document.getElementById('settings-cancel')?.addEventListener('click', () => {
            document.getElementById('settings-modal')?.classList.add('hidden');
        });
    }

    // --- BGM ---
    setupBGM() {
        this.bgm = new ChiptuneEngine();
        this.bgm.loadSettings();
        this._bgmPhase = null;

        // Update UI to match saved settings
        const volSlider = document.getElementById('bgm-volume');
        const toggleBtn = document.getElementById('bgm-toggle');
        if (volSlider) volSlider.value = Math.round(this.bgm.volume * 100);
        if (toggleBtn) toggleBtn.textContent = this.bgm.muted ? '🔇' : '🔊';

        // Volume slider
        volSlider?.addEventListener('input', (e) => {
            this.bgm.setVolume(parseInt(e.target.value) / 100);
            if (this.bgm.muted) {
                this.bgm.toggleMute();
                if (toggleBtn) toggleBtn.textContent = '🔊';
            }
        });

        // Mute toggle
        toggleBtn?.addEventListener('click', () => {
            const muted = this.bgm.toggleMute();
            toggleBtn.textContent = muted ? '🔇' : '🔊';
        });

        // Init AudioContext on first user interaction (browser requirement)
        const initOnce = () => {
            if (!this.bgm._initialized) {
                this.bgm.init();
                this.bgm.loadSettings(); // re-apply after init
                if (this.world?.clock) {
                    this.bgm.play(this.world.clock.timeOfDay);
                    this._bgmPhase = this.world.clock.timeOfDay;
                }
            }
            document.removeEventListener('click', initOnce);
            document.removeEventListener('touchstart', initOnce);
        };
        document.addEventListener('click', initOnce);
        document.addEventListener('touchstart', initOnce);
    }

    _updateBGMPhase() {
        if (!this.bgm?._initialized || !this.world?.clock) return;
        const phase = this.world.clock.timeOfDay;
        if (phase !== this._bgmPhase) {
            this._bgmPhase = phase;
            this.bgm.play(phase);
        }
    }

    // --- Save / Load ---
    async saveGame() {
        try {
            // Track save count for achievement
            const sc = parseInt(localStorage.getItem('rimtown_save_count') || '0') + 1;
            localStorage.setItem('rimtown_save_count', sc.toString());
            const saveData = this.world.serialize();
            if (this.auth?.loggedIn) {
                // v5.63.0 登入也同時寫本機:雲端寫入失敗時進度不再蒸發(重新整理後任務/進度回捲的根因)
                try { if (this.currentTownId) this._saveCurrentTown(); } catch (e) {}
                try {
                    const clock = saveData.clock || {};
                    const r = await this.auth.cloudSave(this.currentTownId, this._getCurrentTownName(), saveData, {
                        season: clock.season, year: clock.year, day: clock.day,
                        population: Object.keys(saveData.agents || {}).length,
                    });
                    this._lastCloudSaveAt = Date.now(); this._lastCloudTick = this.world.tickCount; // v5.63.2
                    if (r && r.stale) {
                        // v5.64.1 雲端已有較新進度,這份較舊的沒有蓋過去(保護玩家進度)
                        this.world.logMessage('system', t('雲端已有較新的進度，本次未覆寫。'));
                    } else {
                        this.world.logMessage('system', t('遊戲已儲存至雲端。'));
                    }
                } catch (e) {
                    console.error('[RimTown] Cloud save error:', e);
                    this.world.logMessage('system', t('雲端儲存失敗。'));
                }
            } else {
                // Not logged in — save locally
                if (this.currentTownId) {
                    this._saveCurrentTown();
                }
                const json = JSON.stringify(saveData);
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({ rimtown_save: json });
                } else {
                    localStorage.setItem('rimtown_save', json);
                }
                this.world.logMessage('system', t('遊戲已儲存。'));
            }
            return true;
        } catch(e) {
            console.error('Save failed:', e);
            this.world.logMessage('system', t('儲存失敗。'));
            return false;
        }
    }

    async tryLoadGame() {
        try {
            let json = null;
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const data = await chrome.storage.local.get(['rimtown_save']);
                json = data.rimtown_save;
            } else {
                json = localStorage.getItem('rimtown_save');
            }
            if (!json) return false;
            const saveData = JSON.parse(json);
            return this.world.loadSave(saveData);
        } catch(e) { console.error('Load failed:', e); return false; }
    }

    async deleteSave() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.remove('rimtown_save');
            } else {
                localStorage.removeItem('rimtown_save');
            }
        } catch(e) {}
    }

    setupAutoSave() {
        // Auto-save every 60 seconds (saveGame already handles cloud sync when logged in)
        // v5.63.2 雲端額度止血:本機每 60 秒存,雲端改為「有進度變化且距上次雲端存檔 ≥5 分鐘」
        // 才寫(關頁/手動存檔/切鎮仍立即寫雲端)——Vercel Blob 每月 2K 次寫入額度,原本每分鐘 2 次寫入撐不住
        this._autoSaveInterval = setInterval(() => {
            if (this.world.paused) return;
            if (this.auth?.loggedIn) {
                try { if (this.currentTownId) this._saveCurrentTown(); } catch (e) {}
                const due = Date.now() - (this._lastCloudSaveAt || 0) >= 300000;
                const changed = this.world.tickCount !== this._lastCloudTick;
                if (due && changed) this.saveGame();
            } else {
                this.saveGame();
            }
        }, 60000);
        // Also save when tab is closing
        // v5.67.1 手機版 beforeunload 幾乎不會觸發(切 App/滑掉分頁),改為 pagehide 與 visibilitychange(hidden)
        // 也一起沖存檔;同一個 tick 只沖一次,避免三個事件連發重複寫雲端
        const flushOnExit = () => this._flushSaveOnExit();
        window.addEventListener('beforeunload', flushOnExit);
        window.addEventListener('pagehide', flushOnExit);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushOnExit(); });
    }

    _flushSaveOnExit() {
        {
            try {
                if (!this.world) return;
                if (this._lastExitFlushTick === this.world.tickCount) return; // 同一 tick 已沖過
                this._lastExitFlushTick = this.world.tickCount;
                const saveData = this.world.serialize();
                const json = JSON.stringify(saveData);
                if (this.auth.loggedIn && this.auth._restUrl) {
                    // v5.63.0 關頁時也留一份本機(雲端 keepalive 請求不保證成功)
                    try { if (this.currentTownId) this._saveCurrentTown(); } catch (e) {}
                    const clock = saveData.clock || {};
                    const payload = JSON.stringify({
                        town_id: this.currentTownId,
                        town_name: this._getCurrentTownName(),
                        save_data: json,
                        season: clock.season || '',
                        year: clock.year || 1,
                        day: clock.day || 1,
                        population: Object.keys(saveData.agents || {}).length,
                    });
                    fetch(this.auth._restUrl + 'save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': this.auth._nonce, 'Authorization': 'Bearer ' + this.auth._nonce },
                        credentials: 'same-origin',
                        body: payload,
                        keepalive: true,
                    }).catch(() => {});
                    this._lastCloudSaveAt = Date.now(); this._lastCloudTick = this.world.tickCount;
                } else {
                    // Not logged in — save locally
                    if (this.currentTownId) {
                        this._saveCurrentTown();
                    }
                    if (typeof chrome !== 'undefined' && chrome.storage) {
                        chrome.storage.local.set({ rimtown_save: json });
                    } else {
                        localStorage.setItem('rimtown_save', json);
                    }
                }
            } catch(e) {}
        }
    }

    async exportSave() {
        const saveData = this.world.serialize();
        const json = JSON.stringify(saveData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ck = saveData.clock || {};
        a.download = `rimtown_save_${ck.season || 'unknown'}_Y${ck.year || 1}D${ck.day || 1}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._gameAlert(t('存檔已匯出。'), '✅');
    }

    importSave() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const saveData = JSON.parse(text);
                if (this.world.loadSave(saveData)) {
                    if (this.llmClient) this.world.conversationEngine = this._makeConversationEngine();
                    this.state = this.world.getState();
                    this._generateTileMapLayout();
                    if (this.tileMap) this.tileMap.agentPositions = {};
                    this.render();
                    this.auth.forceNextSave = true; // v5.64.1 匯入=玩家明確要用這份,允許覆寫較新的雲端存檔
                    await this.saveGame();
                    this._gameAlert(t('存檔已匯入。'), '✅');
                } else {
                    this._gameAlert(t('讀取存檔失敗。'), '❌');
                }
            } catch(err) { this._gameAlert(t('無效的存檔：') + err.message, '❌'); }
        };
        input.click();
    }

    // --- Chat Archive (per-town persistent storage) ---
    _getArchiveKey() {
        return this.currentTownId ? 'rimtown_town_' + this.currentTownId + '_archives' : 'rimtown_chat_archives';
    }
    _getArchives() {
        try { return JSON.parse(localStorage.getItem(this._getArchiveKey()) || '[]'); } catch(e) { return []; }
    }
    _saveArchives(archives) {
        localStorage.setItem(this._getArchiveKey(), JSON.stringify(archives));
    }

    async archiveChatHistory() {
        const player = this.world.agents?.get?.('player') || this.world.agents?.['player'];
        if (!player || !player.chatHistory || !player.chatHistory.length) return;

        const clock = this.world.clock;
        const archive = {
            id: Date.now(),
            savedAt: new Date().toISOString(),
            gameClock: `${t(clock.season || '春季')}${t(' 第')}${clock.year || 1}${t('年 第')}${clock.day || 1}${t('天')}`,
            townId: this.currentTownId,
            playerName: player.name,
            messageCount: player.chatHistory.length,
            npcNames: [...new Set(player.chatHistory.map(m => m.speaker === player.name ? m.target : m.speaker))],
            messages: [...player.chatHistory]
        };

        const archives = this._getArchives();
        archives.push(archive);
        while (archives.length > 30) archives.shift();
        this._saveArchives(archives);
        return archive;
    }

    async getChatArchives() {
        return this._getArchives();
    }

    async deleteChatArchive(archiveId) {
        const archives = this._getArchives().filter(a => a.id !== archiveId);
        this._saveArchives(archives);
    }

    exportChatLog(archive) {
        const lines = [];
        lines.push(t('=== 邊境鎮聊天記錄 ==='));
        lines.push(`${t('遊戲進度：')}${archive.gameClock}`);
        lines.push(`${t('玩家：')}${archive.playerName}`);
        lines.push(`${t('存檔時間：')}${archive.savedAt}`);
        lines.push(`NPC：${archive.npcNames.join('、')}`);
        lines.push(`${t('訊息數：')}${archive.messageCount}`);
        lines.push('');
        archive.messages.forEach(m => {
            lines.push(`[${m.time || '??:??'}] ${m.speaker} → ${m.target}: ${m.text}`);
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rimtown_chat_${archive.gameClock.replace(/\s+/g,'_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    assignAgentColor(agentId) {
        if (agentId === 'player') return '#ffffff';
        if (!this.agentColors[agentId]) {
            const idx = Object.keys(this.agentColors).length % this.colorPalette.length;
            this.agentColors[agentId] = this.colorPalette[idx];
        }
        return this.agentColors[agentId];
    }

    // --- Player Actions ---
    playerMoveTo(locationId) {
        const player = this.world.agents['player'];
        // Handle individual house sub-zone clicks — move to parent residential area
        let actualLocId = locationId;
        if (this.tileMap && this.tileMap._houseSubZones && this.tileMap._houseSubZones[locationId]) {
            actualLocId = this.tileMap._houseSubZones[locationId].parentLocId;
            this._selectedHouseSubZone = locationId; // Track which house was clicked
            // Show house detail panel after moving
            if (player && player.moveTo(actualLocId, this.world)) {
                this.state = this.world.getState();
                this.activeTab = 'detail';
                if (this._updateTabHighlight) this._updateTabHighlight('detail');
                this.selectedAgent = null; // Clear agent selection to show house view
                this.render();
            }
            return;
        }
        this._selectedHouseSubZone = null;
        if (player && player.moveTo(actualLocId, this.world)) {
            // Clear chat target when moving to a different location
            if (this.chatTarget && player.currentLocation !== this.state?.agents?.[this.chatTarget]?.current_location) {
                this.chatTarget = null;
                this.selectedAgent = null;
                if (this.activeTab === 'chat') {
                    this.activeTab = 'residents';
                    if (this._updateTabHighlight) this._updateTabHighlight('residents');
                }
            }
            this.state = this.world.getState();
            this.render();
        }
    }

    // v4.2.0 礦石鎮式操作:按住 WASD/方向鍵連續移動(keydown 記錄、keyup 釋放)
    _handleMovementKey(e) {
        if (!this.tileMap || !this.world) return;
        const key = e.key.toLowerCase();
        const DIR_KEYS = { w:1, arrowup:1, s:1, arrowdown:1, a:1, arrowleft:1, d:1, arrowright:1 };
        if (DIR_KEYS[key]) {
            e.preventDefault();
            if (!this._keysDown) this._keysDown = new Set();
            this._keysDown.add(key);
            this._syncPlayerInput();
            return;
        }
        // E 鍵:與身邊最近的 NPC 交談(2.5 格內)
        if (key === 'e') {
            e.preventDefault();
            this._interactNearby();
            return;
        }
    }

    _handleMovementKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this._keysDown && this._keysDown.delete(key)) this._syncPlayerInput();
    }

    _syncPlayerInput() {
        if (!this.tileMap) return;
        const k = this._keysDown || new Set();
        let x = 0, y = 0;
        if (k.has('a') || k.has('arrowleft')) x -= 1;
        if (k.has('d') || k.has('arrowright')) x += 1;
        if (k.has('w') || k.has('arrowup')) y -= 1;
        if (k.has('s') || k.has('arrowdown')) y += 1;
        this.tileMap.playerInput = { x, y };
    }

    // 與最近的 NPC 互動(E 鍵 / 互動提示點擊 / 手機互動鈕共用)
    _interactNearby() {
        const near = this.tileMap?.getNearbyNPC?.();
        if (near) this.startChatWith(near.agentId);
    }

    _getAdjacentLocation(direction) {
        if (!this.tileMap) return null;
        const player = this.world.agents['player'];
        if (!player) return null;
        const currentLoc = player.currentLocation;

        // Get all zone centers
        const allZones = { ...this.tileMap.buildingZones, ...this.tileMap.natureZones };
        const currentZone = allZones[currentLoc];
        if (!currentZone) return null;

        const cx = currentZone.x + currentZone.w / 2;
        const cy = currentZone.y + currentZone.h / 2;

        // Find the best location in the given direction
        // Very forgiving: allow up to 120 degrees cone in the direction
        let best = null;
        let bestScore = Infinity;

        for (const [locId, zone] of Object.entries(allZones)) {
            if (locId === currentLoc) continue;
            const tx = zone.x + zone.w / 2;
            const ty = zone.y + zone.h / 2;
            const dx = tx - cx;
            const dy = ty - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.5) continue;

            // Check direction with wide cone (120 degrees = cos(60) = 0.5)
            let valid = false;
            switch (direction) {
                case 'up': valid = dy < 0 && -dy / dist > 0.3; break;    // At least 30% upward
                case 'down': valid = dy > 0 && dy / dist > 0.3; break;
                case 'left': valid = dx < 0 && -dx / dist > 0.3; break;
                case 'right': valid = dx > 0 && dx / dist > 0.3; break;
            }
            if (!valid) continue;

            // Score: distance with slight alignment bonus (prefer more aligned)
            const alignment = direction === 'up' || direction === 'down'
                ? Math.abs(dx) / (Math.abs(dy) + 0.1)
                : Math.abs(dy) / (Math.abs(dx) + 0.1);
            const score = dist * (1 + alignment * 0.3);

            if (score < bestScore) {
                bestScore = score;
                best = locId;
            }
        }

        // If no location found in direction, try wrapping around (find ANY closest unused direction)
        if (!best) {
            let fallbackBest = null, fallbackDist = Infinity;
            for (const [locId, zone] of Object.entries(allZones)) {
                if (locId === currentLoc) continue;
                const tx = zone.x + zone.w / 2;
                const ty = zone.y + zone.h / 2;
                const dist = Math.sqrt((tx-cx)**2 + (ty-cy)**2);
                if (dist < fallbackDist) { fallbackDist = dist; fallbackBest = locId; }
            }
            // Only use fallback if the nearest location is reasonably close
            if (fallbackBest && fallbackDist < 20) best = fallbackBest;
        }

        return best;
    }

    // v6.0.0 B14：playerSendMessage … 等方法移到 app-chat.js

    // --- Render ---
    render() {
        if (!this.state) return;
        // Ensure NPC proactive message callback is set
        if (this.world?.conversationEngine && !this.world.conversationEngine.onNpcMessage) {
            this.world.conversationEngine.onNpcMessage = (npcId) => {
                if (!this._chatUnread) this._chatUnread = new Set();
                // Don't mark as unread if player is already chatting with this NPC
                if (this.activeTab === 'chat' && this.chatTarget === npcId) return;
                this._chatUnread.add(npcId);
                this._updateChatBadge();
            };
        }
        this.renderClock();
        this.renderMap();
        // Skip sidebar re-render when user is actively focused on any input/textarea/select
        // to prevent losing focus (especially on mobile where keyboard would dismiss)
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) {
            return; // preserve input focus
        }
        // Skip settings tab re-render during simulation ticks to prevent
        // unsaved form data (API keys etc.) from being wiped by innerHTML replacement
        if (this.activeTab === 'settings') return;
        // Skip full chat tab re-render during simulation ticks to prevent flickering.
        // Only update dynamic data (thoughts, mood, unread) in-place via DOM manipulation.
        // Full re-renders still happen via explicit renderSidebar() calls (e.g. startChatWith, sendChat).
        if (this.activeTab === 'chat') {
            this._updateChatContactsInPlace();
            return;
        }
        this.renderSidebar();
    }

    // v4.5.1 日夜階段圖示:一眼分辨現在是白天還是夜晚
    _dayPhaseIcon(hour) {
        if (hour >= 5 && hour < 7) return '🌅';
        if (hour >= 7 && hour < 17) return '☀️';
        if (hour >= 17 && hour < 19) return '🌆';
        return '🌙';
    }

    renderClock() {
        const clock = this.state.clock;
        const phaseIcon = this._dayPhaseIcon(clock.hour || 12);
        const clockEl = document.getElementById('clock-display');
        if (clockEl) clockEl.textContent = `${phaseIcon} ${clock.time_str}`;
        const pauseBtn = document.getElementById('btn-pause');
        const resumeBtn = document.getElementById('btn-resume');
        if (this.state.paused) { pauseBtn?.classList.add('active'); resumeBtn?.classList.remove('active'); }
        else { pauseBtn?.classList.remove('active'); resumeBtn?.classList.add('active'); }
        const agentCount = Object.keys(this.state.agents).length;
        const travelCount = (this.state.travelling_agents || []).length;
        const travelText = travelCount > 0 ? `（+${travelCount}${t(' 外出）')}` : '';
        // v5.59.0 TC-05:跨鎮訪客不灌水常住人口,分開顯示
        const visitorCount = Object.keys(this.world?.visitors || {}).length;
        const residentCount = Math.max(0, agentCount - visitorCount);
        const visitorText = visitorCount > 0 ? `（+${visitorCount}${t(' 訪客）')}` : '';
        const popEl = document.getElementById('population-count');
        if (popEl) popEl.textContent = `${t('人口：')}${residentCount}${visitorText}${travelText}`;

        // Weather display
        const weatherEl = document.getElementById('weather-display');
        if (weatherEl && this.state.weather) {
            const w = this.state.weather;
            weatherEl.textContent = `${w.icon} ${t(w.name)} ${w.temperature}°`;
            weatherEl.title = w.desc + (w.activeDisaster ? ` | 🚨 ${t(w.activeDisaster.name)}` : '');
            weatherEl.style.color = w.isExtreme ? 'var(--negative)' : 'var(--text-secondary)';
        }

        // Update town-info-bar in residents tab (real-time)
        const infoClockEl = document.querySelector('.town-info-clock');
        if (infoClockEl) infoClockEl.textContent = clock.time_str;
        const infoPopEl = document.querySelector('.town-info-pop');
        if (infoPopEl) infoPopEl.textContent = `👤 ${agentCount}${travelText}`;

        // Update mobile header clock & population
        const mobileClock = document.getElementById('mobile-clock');
        if (mobileClock) {
            const h = String(clock.hour || 0).padStart(2, '0');
            const m = String(clock.minute || 0).padStart(2, '0');
            mobileClock.textContent = `Y${clock.year} ${t(clock.season)} D${clock.day} ${this._dayPhaseIcon(clock.hour || 12)}${h}:${m}`;
        }
        const mobilePop = document.getElementById('mobile-population');
        if (mobilePop) mobilePop.textContent = `${agentCount}${t('人')}`;
        // Update mobile pause button state
        const mobilePauseBtn = document.getElementById('mobile-btn-pause');
        if (mobilePauseBtn) {
            mobilePauseBtn.textContent = this.state.paused ? '▶' : '⏸';
            mobilePauseBtn.classList.toggle('paused', this.state.paused);
        }
        // Sync mobile LLM status
        const mobileLlm = document.getElementById('mobile-llm-status');
        const desktopLlm = document.getElementById('llm-status');
        if (mobileLlm && desktopLlm) {
            mobileLlm.textContent = desktopLlm.textContent;
            mobileLlm.className = desktopLlm.className;
        }
    }

    renderMap() {
        // Map rendering is now handled by the canvas animation loop (_startRenderLoop)
        // This method is kept as a no-op for compatibility
    }

    // v4.2.0:點 NPC → 先開快速資訊卡(好感愛心 + 愛恨對象),卡上按「交談」才走過去聊
    onAgentClick(agentId) {
        this._showNpcCard(agentId);
    }

    _walkToAndChat(agentId) {
        const player = this.state?.agents?.['player'];
        const target = this.state?.agents?.[agentId];
        if (!player || !target) return;
        if (player.current_location !== target.current_location) {
            this.playerMoveTo(target.current_location);
        }
        this.startChatWith(agentId);
    }

    // =====================================================
    // v4.4.0 開羅式手機 UI:極簡底部列 + 左側浮動選單 + 置中浮動卡片
    // 地圖永遠全螢幕,UI 全部浮在上面(機場物語式)
    // =====================================================
    // v6.0.0 B14：_setupKairoUI … 等方法移到 app-mobile.js

    renderSidebar() {
        // 手機抽屜:聊天分頁給較高的面板(62vh),其他分頁 44vh 讓地圖為主
        const _sb = document.getElementById('rimtown-sidebar');
        if (_sb) _sb.classList.toggle('chat-open', this.activeTab === 'chat');
        // v5.49.3 桌面版:聊天分頁進入對話時側欄加寬成雙欄(地圖 canvas 由 ResizeObserver 自動重排)
        document.querySelector('.rimtown-container')?.classList.toggle('chat-wide', this.activeTab === 'chat' && !!this.chatTarget);
        this._syncKairoLayout();
        const content = document.getElementById('sidebar-content');

        // v5.20.0 三大入口的次級分頁列(桌面與手機皆顯示;手機聊天抽屜為全幅,不加列)
        const isMobile = window.innerWidth <= 768;
        const mainTab = this._mobileSubToMain?.[this.activeTab] || this.activeTab;
        const group = this._mobileTabGroups?.[mainTab];
        if (group && group.length > 1 && !(isMobile && this.activeTab === 'chat')) {
            let subBar = '<div class="sub-tab-bar mobile-group-tabs">';
            group.forEach(_tw => {
                const active = this.activeTab === _tw.key ? ' class="active"' : '';
                subBar += `<button${active} data-action="mobile-group-tab" data-val="${_tw.key}">${_tw.icon} ${_tw.label}</button>`;
            });
            subBar += '</div>';
            content.innerHTML = subBar;
            const subContent = document.createElement('div');
            content.appendChild(subContent);
            this._renderTabContent(subContent);
        } else {
            this._renderTabContent(content);
        }
    }

    _renderTabContent(content) {
        switch (this.activeTab) {
            case 'residents': this.renderResidentsList(content); break;
            case 'chat':
                if (this._viewingArchive) this.renderChatArchiveView(content);
                else this.renderChat(content);
                break;
            case 'chat-archives': this.renderChatArchiveList(content); break;
            case 'detail': this.renderAgentDetail(content); break;
            case 'economy': this.renderEconomy(content); break;
            case 'records': this.renderRecords(content); break;
            case 'events': this.renderEvents(content); break;
            case 'achievements': this.renderAchievements(content); break;
            case 'industry': this.renderIndustryAndFarm(content); break;
            case 'quest': this.renderQuest(content); break;
            case 'settings': this.renderSettings(content); break;
            case 'relmap': this.renderRelationMap(content); break;
        }
    }

    // =====================================================
    // v4.5.0 關係網總覽圖:一張圖看全鎮誰愛誰恨誰
    // =====================================================
    renderRelationMap(container) {
        if (!this.state) return;
        this._firstDayMark?.('relations'); // v5.18.0 第一天:發現一段關係
        if (!this._relmapFilters) this._relmapFilters = { love: true, crush: true, foe: true, friend: false };
        const f = this._relmapFilters;
        const chip = (k, icon, label, color) =>
            `<button data-action="relmap-filter" data-val="${k}" style="padding:3px 10px;border-radius:12px;font-size:0.7rem;border:1px solid ${color};background:${f[k] ? color : 'transparent'};color:${f[k] ? '#0b1020' : color};font-weight:700">${icon}${label}</button>`;
        let html = ''; // v5.20.0 次級分頁列已由 renderSidebar 統一渲染,不在此重複
        html += `<div class="econ-section"><h3>💞 ${t('全鎮關係網')}</h3>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                ${chip('love', '💕', t('戀愛'), '#ff6b9d')}
                ${chip('crush', '💘', t('單戀'), '#ff9ec6')}
                ${chip('foe', '💢', t('敵對'), '#e05555')}
                ${chip('friend', '💚', t('摯友'), '#5cc46a')}
            </div>
            <div style="font-size:0.68rem;color:var(--text-secondary);margin-bottom:6px">${this._relmapFocus ? t('👤 個人視角:再點一次空白處返回全鎮') : t('💡 點擊任何人,只看他的關係')}</div>
            <canvas id="relmap-canvas" style="width:100%;border:1px solid var(--border);border-radius:10px;background:#0d1426"></canvas>
            <div id="relmap-gossip" style="margin-top:8px"></div>
        </div>`;
        container.innerHTML = html;
        requestAnimationFrame(() => { this._drawRelationMap(); this._renderGossipDigest(); });
    }

    // 收集有戲劇性的關係邊(給圖與八卦摘要共用)
    _relmapEdges() {
        const npcs = Object.entries(this.state.agents);
        const edges = [];
        const seen = new Set();
        for (const [id, a] of npcs) {
            for (const r of Object.values(a.relationships || {})) {
                const tid = r.target_id;
                if (!this.state.agents[tid]) continue;
                const key = id < tid ? `${id}|${tid}` : `${tid}|${id}`;
                if (r.status === 'married' || r.status === 'dating') {
                    if (!seen.has('L' + key)) { seen.add('L' + key); edges.push({ type: 'love', a: id, b: tid, married: r.status === 'married', cheating: r.is_cheating }); }
                } else if ((r.romantic_interest || 0) > 55 && !r.status) {
                    edges.push({ type: 'crush', a: id, b: tid }); // 單戀有方向,各自畫
                } else if ((r.affinity || 0) < -55) {
                    if (!seen.has('F' + key)) { seen.add('F' + key); edges.push({ type: 'foe', a: id, b: tid }); }
                } else if ((r.affinity || 0) > 70) {
                    if (!seen.has('R' + key)) { seen.add('R' + key); edges.push({ type: 'friend', a: id, b: tid }); }
                }
            }
        }
        return edges;
    }

    _drawRelationMap() {
        const canvas = document.getElementById('relmap-canvas');
        if (!canvas || !this.state?.agents) return;
        const npcs = Object.entries(this.state.agents);
        const W = canvas.clientWidth || 320;
        const H = Math.max(300, Math.min(430, W));
        const dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.height = H + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 34;
        const posMap = {};
        npcs.forEach(([id], i) => {
            const ang = (i / npcs.length) * Math.PI * 2 - Math.PI / 2;
            posMap[id] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
        });
        this._relmapPos = posMap;
        this._relmapCanvasSize = { W, H };
        const f = this._relmapFilters;
        const focus = this._relmapFocus;
        const edges = this._relmapEdges().filter(e => f[e.type] && (!focus || e.a === focus || e.b === focus));
        const touched = new Set();
        edges.forEach(e => { touched.add(e.a); touched.add(e.b); });
        // 邊
        for (const e of edges) {
            const p1 = posMap[e.a], p2 = posMap[e.b];
            if (!p1 || !p2) continue;
            const style = {
                love:   { color: '#ff6b9d', width: e.married ? 2.6 : 2, dash: [] },
                crush:  { color: '#ff9ec6', width: 1.4, dash: [4, 3] },
                foe:    { color: '#e05555', width: 1.6, dash: [] },
                friend: { color: 'rgba(92,196,106,0.5)', width: 1, dash: [] },
            }[e.type];
            ctx.strokeStyle = style.color;
            ctx.lineWidth = style.width;
            ctx.setLineDash(style.dash);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            ctx.setLineDash([]);
            ctx.font = '10px serif'; ctx.textAlign = 'center';
            if (e.type === 'love') ctx.fillText(e.married ? '💍' : '💕', mx, my + 3);
            if (e.cheating) ctx.fillText('🖤', mx + 10, my + 3);
            if (e.type === 'foe') ctx.fillText('💢', mx, my + 3);
        }
        ctx.setLineDash([]);
        // 節點(焦點模式:無關的人變暗)
        for (const [id, a] of npcs) {
            const p = posMap[id];
            const isP = id === 'player';
            const dim = focus ? (id !== focus && !touched.has(id)) : false;
            ctx.globalAlpha = dim ? 0.22 : 1;
            ctx.fillStyle = id === focus ? '#ff6b9d' : isP ? '#ffd700' : '#3a5a94';
            ctx.beginPath();
            ctx.arc(p.x, p.y, id === focus ? 8 : isP ? 7 : 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = id === focus ? '#ff9ec6' : isP ? '#ffd700' : '#dde6f5';
            ctx.font = `${isP || id === focus ? 'bold ' : ''}10px sans-serif`;
            ctx.textAlign = 'center';
            const dx = p.x - cx, dy = p.y - cy;
            const len = Math.hypot(dx, dy) || 1;
            ctx.fillText(I18N.localizeNames(a.name || id), p.x + (dx / len) * 16, p.y + (dy / len) * 16 + 3);
            ctx.globalAlpha = 1;
        }
        // 點擊:選人進入個人視角/點空白返回
        if (!canvas._relmapBound) {
            canvas._relmapBound = true;
            canvas.addEventListener('click', (ev) => {
                const rect = canvas.getBoundingClientRect();
                const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
                let hit = null;
                for (const [id, p] of Object.entries(this._relmapPos || {})) {
                    if (Math.hypot(p.x - x, p.y - y) < 16) { hit = id; break; }
                }
                this._relmapFocus = hit === this._relmapFocus ? null : hit;
                this.bgm?.sfx?.('click');
                this.renderSidebar();
            });
        }
    }

    // 八卦頭條:把最有戲的關係用文字講出來
    _renderGossipDigest() {
        const el = document.getElementById('relmap-gossip');
        if (!el || !this.state?.agents) return;
        const name = id => this.state.agents[id]?.name || id;
        const edges = this._relmapEdges();
        const lines = [];
        const loves = edges.filter(e => e.type === 'love');
        loves.forEach(e => {
            lines.push(`${e.married ? '💍' : '💕'} ${name(e.a)} ${t('和')} ${name(e.b)} ${e.married ? t('是夫妻') : t('正在交往')}${e.cheating ? ` 🖤<span style="color:#ff9ec6">${t('(有人偷偷出軌...)')}</span>` : ''}`);
        });
        // 三角關係:C 單戀著已有伴侶的人
        const inCouple = new Set(loves.flatMap(e => [e.a, e.b]));
        edges.filter(e => e.type === 'crush' && inCouple.has(e.b)).slice(0, 3).forEach(e => {
            lines.push(`💔 ${name(e.a)} ${t('暗戀著名花有主的')} ${name(e.b)}${t('——三角關係醞釀中!')}`);
        });
        // 互相單戀(即將成真?)
        const crushSet = new Set(edges.filter(e => e.type === 'crush').map(e => `${e.a}|${e.b}`));
        edges.filter(e => e.type === 'crush' && crushSet.has(`${e.b}|${e.a}`) && e.a < e.b).slice(0, 3).forEach(e => {
            lines.push(`💘 ${name(e.a)} ${t('和')} ${name(e.b)} ${t('互有好感,就差一層窗戶紙!')}`);
        });
        edges.filter(e => e.type === 'foe').slice(0, 3).forEach(e => {
            lines.push(`💢 ${name(e.a)} ${t('和')} ${name(e.b)} ${t('是出了名的死對頭')}`);
        });
        el.innerHTML = lines.length
            ? `<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:4px">📰 ${t('本鎮八卦頭條')}</div>` +
              lines.slice(0, 8).map(l => `<div style="font-size:0.74rem;padding:3px 0;color:#ffd7e6">${l}</div>`).join('')
            : `<div style="font-size:0.72rem;color:var(--text-secondary)">${t('鎮上還很平靜...讓村民多相處幾天,八卦自然就來了。')}</div>`;
    }

    // 行動版群組子分頁列(關係圖共用居民群組)
    _renderMobileGroupTabs() {
        if (window.innerWidth > 768) return '';
        const main = this._mobileSubToMain?.[this.activeTab] || this.activeTab;
        const group = this._mobileTabGroups?.[main];
        if (!group) return '';
        let bar = '<div class="sub-tab-bar mobile-group-tabs">';
        group.forEach(_tw => {
            const active = _tw.key === this.activeTab ? ' class="active"' : '';
            bar += `<button${active} data-action="mobile-group-tab" data-val="${_tw.key}">${_tw.icon} ${_tw.label}</button>`;
        });
        bar += '</div>';
        return bar;
    }

    // v6.0.0 B14：renderChat … 等方法移到 app-chat.js

    // v6.0.0 B14：_renderSkills … 等方法移到 app-panels.js

    // v6.0.0 B14：_getExplorationZone … 等方法移到 app-economy.js

    // ============================================================
    // Records Tab (日報 + 日誌)
    // ============================================================
    // v6.0.0 B14：renderRecords … 等方法移到 app-records.js

    _locationLabel(locId) {
        if (!locId) return '';
        const labels = {
            town_hall: t('鎮公所'), clinic: t('診所'), workshop: t('工坊'),
            farm: t('農場'), tavern: t('酒館'), guardpost: t('哨站'),
            chapel: t('教堂'), library: t('圖書館'), general_store: t('雜貨店'),
            quarry: t('礦場'), town_square: t('廣場'), park: t('公園'),
            well: t('水井'), residential_north: t('北區住宅'),
            residential_south: t('南區住宅'), residential_east: t('東區住宅'),
            exploration: t('探險中'),
        };
        // Try the town map for custom location names
        if (this.state?.locations?.[locId]?.name) return this.state.locations[locId].name;
        return labels[locId] || locId.replace(/_/g, ' ');
    }

    _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}

// Initialize — only when the game container exists (WordPress shortcode loaded)
(function() {
    const init = () => {
        if (!document.getElementById('rimtown-app') && !document.getElementById('town-map-canvas')) return;
        if (typeof RimTownApp.prototype.renderQuest !== 'function') { console.error('[RimTown] app-*.js 分檔未載入（index.html / rimtown.php / sw.js 的腳本清單要含 app-landing/notify/loop/towns/chat/mobile/panels/economy/records）'); }
        const app = new RimTownApp();
        window.rimtownApp = app; // 除錯/測試用全域參照
        window.addEventListener('resize', () => { if (app.state) app.renderMap(); });
        if (I18N.getLang() !== 'zh') {
            I18N.setLang(I18N.getLang());
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
