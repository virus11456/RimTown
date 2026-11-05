// RimTown - sim-pets.js（v6.51.0）：寵物與動物。
// 貓狗有主人（跟著主人走、在家門口等）、流浪貓狗在廣場（村民會摸、會領養）、農場有一群雞（每天下蛋）。
// 主人有寵物陪伴心情會好一點、不那麼寂寞；AI 知道自己養了什麼（_agentBrief／_buildCharacterProfile）。
// 3D 由 town3d.js 的 _updatePets3D 畫（位置在畫面端算，模擬只存資料）。
// 載入順序：sim-issues.js 之後。
'use strict';
const PETS = (() => {
    const MAX = 12;
    const SP = {
        cat:     { icon: '🐈', zh: '貓', colors: ['#E08A3C', '#2B2B2B', '#EDE6DA', '#8A8A8A', '#C9A26B'], names: ['小橘', '咪咪', '黑糖', '湯圓', '芝麻', '麻糬', '花捲', '布丁', '雪球', '可可'] },
        dog:     { icon: '🐕', zh: '狗', colors: ['#C9A26B', '#6B4A2B', '#E8E0D0', '#3A3A3A', '#B5651D'], names: ['小黑', '阿福', '旺財', '豆豆', '皮蛋', '來福', '饅頭', '黃金', '阿虎', '球球'] },
        chicken: { icon: '🐔', zh: '雞', colors: ['#F4F1E8', '#B5651D', '#E8D8B0'], names: ['咕咕', '小花', '蛋蛋', '阿啼', '白白', '紅冠'] },
    };
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const has = (a, tr) => (a.personality?.traits || []).includes(tr);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const spName = (sp) => t(SP[sp]?.zh || sp);
    const petName = (p) => t(p.name);
    const mem = (w, a, k, p, imp) => { try { a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', k, p || {}, imp || 4, []); } catch (e) {} };
    if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
        pet_company: { mood: 3, opinion: 0, days: 1, label: t('有寵物陪著') },
        adopted_pet: { mood: 8, opinion: 0, days: 4, label: t('領養了新寵物') },
    });
    const freeName = (w, sp) => { const used = new Set((w.pets?.list || []).map(p => p.name)); const pool = SP[sp].names.filter(n => !used.has(n)); return pool.length ? pick(pool) : pick(SP[sp].names); };
    function make(w, sp, owner, home) {
        const S = w.pets; S.n = (S.n || 0) + 1;
        const p = { id: 'pet' + S.n, sp, name: freeName(w, sp), owner: owner ? owner.agentId : null, home: owner ? (owner.homeLocation || null) : (home || 'town_square'), color: pick(SP[sp].colors), bond: owner ? 20 : 0 };
        S.list.push(p); return p;
    }
    const owned = (w, a) => (w.pets?.list || []).find(p => p.owner === a.agentId);
    // 第一次(新遊戲或舊存檔)放幾隻:有主人的貓狗、廣場的流浪貓、農場的雞
    const henCheck = (w) => { const S = w.pets; if (!S.hens && w.townMap?.locations?.farm) { S.hens = true; if (!S.list.some(p => p.sp === 'chicken')) for (let i = 0; i < 4; i++) make(w, 'chicken', null, 'farm'); } return S; };
    function ensure(w) {
        if (w.pets && Array.isArray(w.pets.list)) return henCheck(w);
        w.pets = { list: [], n: 0, lastDay: null };
        const all = npcs(w);
        const fond = all.filter(a => has(a, 'kind') || has(a, 'romantic') || has(a, 'shy') || has(a, 'optimist')).sort(() => Math.random() - 0.5);
        for (const a of fond.slice(0, 4)) make(w, Math.random() < 0.55 ? 'dog' : 'cat', a);
        if (w.pets.list.length < 2) for (const a of all.sort(() => Math.random() - 0.5).slice(0, 2 - w.pets.list.length)) make(w, 'dog', a);
        make(w, 'cat', null, 'town_square'); make(w, 'cat', null, 'town_square');
        return henCheck(w);
    }
    function daily(w) {
        const S = ensure(w); const all = npcs(w); if (!all.length) return;
        const alive = new Set(all.map(a => a.agentId));
        for (const p of S.list) {
            if (p.sp === 'chicken') continue;
            if (p.owner && !alive.has(p.owner)) { // 主人搬走或過世 → 變成流浪的
                const nm = p.ownerName || '';
                p.owner = null; p.home = 'town_square'; p.bond = 0;
                w.logMessageT?.('social', '🐾 {pet}的主人不在了，牠在廣場徘徊，成了流浪{sp}。', { pet: petName(p), sp: spName(p.sp) });
                continue;
            }
            if (!p.owner) continue;
            const a = w.agents[p.owner]; p.ownerName = a.name;
            a.addThought?.('pet_company', w);
            if (a.needs) a.needs.social = Math.min(100, (a.needs.social || 0) + 8);
            p.bond = Math.min(100, (p.bond || 0) + 2);
            if ((a.mood || 50) < 30 && Math.random() < 0.5) { a.moodModifier = (a.moodModifier || 0) + 3; mem(w, a, '心情很差的時候，{pet}靠過來蹭我，好像知道我不開心。', { pet: petName(p) }, 5); }
            else if (Math.random() < 0.2) mem(w, a, pick(p.sp === 'dog'
                ? ['回家時{pet}衝過來迎接我，尾巴搖個不停。', '帶{pet}去散步，心情好多了。', '{pet}今天把鄰居的鞋子叼回家，真拿牠沒辦法。']
                : ['{pet}今天一直窩在我腿上睡覺。', '{pet}把一隻老鼠叼到門口，好像在跟我邀功。', '{pet}又打翻了桌上的杯子，還一臉無辜。']), { pet: petName(p) }, 3);
        }
        // 雞每天下蛋
        const hens = S.list.filter(p => p.sp === 'chicken').length;
        if (hens && w.stockpile) w.stockpile.add('food', hens, w.tickCount, t('雞蛋'));
        // 流浪貓狗:有人去摸、有人領養
        const strays = S.list.filter(p => !p.owner && p.sp !== 'chicken');
        for (const p of strays) {
            if (Math.random() < 0.2) { const a = pick(all); mem(w, a, '在廣場摸了流浪{sp}{pet}，牠還蹭了蹭我的手。', { sp: spName(p.sp), pet: petName(p) }, 3); a.moodModifier = (a.moodModifier || 0) + 1; }
            const want = all.filter(a => !owned(w, a) && (has(a, 'kind') || has(a, 'shy') || (a.needs?.social ?? 100) < 35));
            if (want.length && Math.random() < 0.06) {
                const a = pick(want); p.owner = a.agentId; p.ownerName = a.name; p.home = a.homeLocation || 'town_square'; p.bond = 10;
                a.addThought?.('adopted_pet', w);
                mem(w, a, '我領養了廣場上的流浪{sp}，叫牠{pet}。從今天起家裡多了一個伴。', { sp: spName(p.sp), pet: petName(p) }, 6);
                w.logMessageT?.('social', '🐾 {who}領養了流浪{sp}「{pet}」。', { who: a.name, sp: spName(p.sp), pet: petName(p) }, a.name);
                w.dailyNews?.collectEvent?.('social', `🐾 ${a.name}${t('領養了流浪')}${spName(p.sp)}${t('「')}${petName(p)}${t('」')}`, 4, [a.name]);
            }
        }
        // 偶爾有新的流浪貓狗出現
        const pets = S.list.filter(p => p.sp !== 'chicken');
        if (pets.length < MAX && strays.length < 2 && Math.random() < 0.05) {
            const p = make(w, Math.random() < 0.6 ? 'cat' : 'dog', null, 'town_square');
            w.logMessageT?.('social', '🐾 鎮上出現了一隻流浪{sp}，大家叫牠「{pet}」。', { sp: spName(p.sp), pet: petName(p) });
        }
    }
    // 給畫面:每隻的種類、顏色、主人、要待的地方
    function view(w) {
        const S = w.pets; if (!S) return [];
        return S.list.map(p => ({ id: p.id, sp: p.sp, name: petName(p), color: p.color, owner: p.owner, home: p.owner ? (w.agents[p.owner]?.homeLocation || p.home) : p.home }));
    }
    const describe = (w, a) => { const p = owned(w, a); return p ? `${SP[p.sp].icon} ${t('養了一隻{sp}「{pet}」').replace('{sp}', spName(p.sp)).replace('{pet}', petName(p))}` : ''; };
    return { SP, ensure, daily, view, owned, describe, make };
})();

// ---- 每日、存檔 ----
if (typeof ProposalSystem !== 'undefined') {
    const _daily = ProposalSystem.prototype.daily;
    ProposalSystem.prototype.daily = function (w) {
        try { const day = this._abs(w); if (w.observerMode && this._petDay !== day) { this._petDay = day; PETS.daily(w); } } catch (e) { console.warn('[Pets] daily', e); }
        return _daily.call(this, w);
    };
}
if (typeof World !== 'undefined') {
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.pets) d.pets = { list: this.pets.list, n: this.pets.n, hens: !!this.pets.hens }; return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r && data?.pets && Array.isArray(data.pets.list)) this.pets = { list: data.pets.list.slice(0, 30), n: data.pets.n || data.pets.list.length, hens: !!data.pets.hens }; else if (r) this.pets = null; } catch (e) {} return r; };
}
// ---- AI 知道自己養了什麼 ----
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    const _ab = CE._agentBrief;
    CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = PETS.describe(world, a); if (s) b.mem = [...(b.mem || []).slice(0, 1), s, ...(b.mem || []).slice(1)]; } catch (e) {} return b; };
    const _cp = CE._buildCharacterProfile;
    CE._buildCharacterProfile = function (agent) { const p = _cp.call(this, agent); try { const w = this._world || (typeof window !== 'undefined' && window.rimtownApp?.world); const s = w && PETS.describe(w, agent); if (s) p.status = `${p.status}${t('；')}${s}`; } catch (e) {} return p; };
}
if (typeof globalThis !== 'undefined') globalThis.PETS = PETS;
