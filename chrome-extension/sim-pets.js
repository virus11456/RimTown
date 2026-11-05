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
        pet_lost:    { mood: -8, opinion: 0, days: 5, label: t('寵物走失了，好擔心') },
        pet_found:   { mood: 6, opinion: 0, days: 3, label: t('走失的寵物找回來了') },
        pet_died:    { mood: -15, opinion: 0, days: 10, label: t('心愛的寵物走了') },
        pet_gift:    { mood: 5, opinion: 1, days: 3, label: t('收到鄰居送的小寵物') },
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
    const today = (w) => w.proposals?._abs?.(w) ?? 0;
    const friendOf = (w, a, pool) => pool.slice().sort((x, y) => (a.relationships?.relationships?.[y.agentId]?.affinity || 0) - (a.relationships?.relationships?.[x.agentId]?.affinity || 0))[0];
    // v6.52.0 生小寶寶分送鄰居、走失大家幫忙找、老了或生病離開
    function lifeEvents(w, S, all) {
        const d = today(w); const spring = w.clock?.season === '春季';
        for (const p of S.list.slice()) {
            if (p.sp === 'chicken') continue;
            if (p.born === undefined) p.born = d - Math.floor(Math.random() * 120);
            const o = p.owner && w.agents[p.owner];
            // 走失 → 大家幫忙找
            if (p.lost !== undefined && p.lost !== null) {
                if (!o) { p.lost = null; continue; }
                const helpers = all.filter(a => a !== o);
                if (Math.random() < 0.4 && helpers.length) {
                    const h = friendOf(w, o, helpers) && Math.random() < 0.6 ? friendOf(w, o, helpers) : pick(helpers);
                    p.lost = null; o.addThought?.('pet_found', w);
                    o.relationships?.getOrCreate?.(h.agentId, h.name)?.modifyAffinity?.(8); h.relationships?.getOrCreate?.(o.agentId, o.name)?.modifyAffinity?.(3);
                    mem(w, o, '{h}幫我找回了走失的{pet}，真的太感謝了！', { h: h.name, pet: petName(p) }, 7);
                    mem(w, h, '在{place}找到了{o}走失的{pet}。', { place: t(pick(['河邊', '樹林裡', '倉庫後面', '酒館門口'])), o: o.name, pet: petName(p) }, 5);
                    w.logMessageT?.('social', '🔎 {h}找到了{o}走失的{pet}！', { h: h.name, o: o.name, pet: petName(p) }, h.name);
                    try { DARK?.bump?.(w, h, 'helped'); } catch (e) {}
                } else if (d - p.lost >= 5) {
                    S.list = S.list.filter(x => x !== p); o.addThought?.('pet_died', w);
                    mem(w, o, '找了好多天，{pet}還是沒有回來……', { pet: petName(p) }, 8);
                    w.logMessageT?.('social', '🕯️ {o}的{pet}走失好幾天，一直沒有找回來。', { o: o.name, pet: petName(p) }, o.name);
                }
                continue;
            }
            if (o && Math.random() < 0.01) {
                p.lost = d; o.addThought?.('pet_lost', w);
                mem(w, o, '{pet}不見了！到處都找不到，好擔心。', { pet: petName(p) }, 7);
                w.logMessageT?.('social', '🔎 {o}的{pet}走失了，大家幫忙找。', { o: o.name, pet: petName(p) }, o.name);
                w.dailyNews?.collectEvent?.('social', `🔎 ${o.name}${t('的')}${petName(p)}${t('走失了，大家幫忙找。')}`, 4, [o.name]);
                continue;
            }
            // 老了或生病離開
            const life = p.sp === 'dog' ? 300 : 360;
            if (d - p.born > life || Math.random() < 0.0008) {
                S.list = S.list.filter(x => x !== p);
                if (o) {
                    o.addThought?.('pet_died', w); mem(w, o, '{pet}今天安靜地走了。謝謝你陪了我這麼久。', { pet: petName(p) }, 9);
                    w.logMessageT?.('social', '🕯️ {o}的{pet}走了，{o}很難過。', { o: o.name, pet: petName(p) }, o.name);
                    w.dailyNews?.collectEvent?.('social', `🕯️ ${o.name}${t('的')}${petName(p)}${t('走了。')}`, 6, [o.name]);
                    for (const f of all.filter(a => a !== o && (a.relationships?.relationships?.[o.agentId]?.affinity || 0) >= 30).slice(0, 2)) { mem(w, f, '{o}的{pet}走了，我去陪他坐了一會兒。', { o: o.name, pet: petName(p) }, 5); o.relationships?.getOrCreate?.(f.agentId, f.name)?.modifyAffinity?.(4); }
                } else w.logMessageT?.('social', '🕯️ 廣場的流浪{sp}{pet}好幾天沒出現了。', { sp: spName(p.sp), pet: petName(p) });
                continue;
            }
            // 生小寶寶 → 分送給沒有寵物的鄰居(交情好的優先)
            const room = MAX - S.list.filter(x => x.sp !== 'chicken').length;
            if (o && room >= 2 && Math.random() < (spring ? 0.015 : 0.005)) {
                const want = all.filter(a => a !== o && !owned(w, a)); if (!want.length) continue;
                const n = Math.min(room, want.length, 1 + Math.floor(Math.random() * 2)); const got = [];
                for (let i = 0; i < n; i++) { const pool = want.filter(a => !got.includes(a)); const a = friendOf(w, o, pool); if (!a) break; const kid = make(w, p.sp, a); kid.color = Math.random() < 0.6 ? p.color : kid.color; kid.parent = p.id; got.push(a); a.addThought?.('pet_gift', w, o.agentId, o.name); mem(w, a, '{o}家的{pet}生了小{sp}，送了我一隻，我叫牠{kid}。', { o: o.name, pet: petName(p), sp: spName(p.sp), kid: petName(kid) }, 6); a.relationships?.getOrCreate?.(o.agentId, o.name)?.modifyAffinity?.(5); o.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(3); }
                if (got.length) {
                    mem(w, o, '{pet}生了小{sp}，分送給了{list}。', { pet: petName(p), sp: spName(p.sp), list: got.map(a => a.name).join(t('、')) }, 6);
                    w.logMessageT?.('social', '🐣 {o}家的{pet}生了小{sp}，分送給{list}。', { o: o.name, pet: petName(p), sp: spName(p.sp), list: got.map(a => a.name).join(t('、')) }, o.name);
                    w.dailyNews?.collectEvent?.('social', fill('🐣 {o}家的{pet}生了小{sp}，分送給{list}。', { o: o.name, pet: petName(p), sp: spName(p.sp), list: got.map(a => a.name).join(t('、')) }), 5, [o.name]);
                }
            }
        }
    }
    const fill = (k, p) => { let s = t(k); for (const [x, v] of Object.entries(p || {})) s = s.split('{' + x + '}').join(String(v)); return s; };
    function daily(w) {
        const S = ensure(w); const all = npcs(w); if (!all.length) return;
        try { lifeEvents(w, S, all); } catch (e) { console.warn('[Pets] life', e); }
        const alive = new Set(all.map(a => a.agentId));
        for (const p of S.list) {
            if (p.sp === 'chicken' || (p.lost !== undefined && p.lost !== null)) continue;
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
        return S.list.filter(p => p.lost === undefined || p.lost === null).map(p => ({ id: p.id, sp: p.sp, name: petName(p), color: p.color, owner: p.owner, home: p.owner ? (w.agents[p.owner]?.homeLocation || p.home) : p.home }));
    }
    const describe = (w, a) => { const p = owned(w, a); return p ? `${SP[p.sp].icon} ${t('養了一隻{sp}「{pet}」').replace('{sp}', spName(p.sp)).replace('{pet}', petName(p))}${(p.lost !== undefined && p.lost !== null) ? t('（走失了，正在找）') : ''}` : ''; };
    return { SP, ensure, daily, view, owned, describe, make, lifeEvents };
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
