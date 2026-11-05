// RimTown - sim-ideas.js（v6.46.0）：科技樹帶來的「人」的變化。
// 1) 觀念傳播：研究完成不是全鎮瞬間學會，而是帶來一個新觀念，從研究員開始靠聊天一個傳一個；每個人依個性、年紀、職業、鎮上民風決定接受或抗拒。
// 2) 保守派／革新派：接受和抗拒的觀念累積成立場，影響競選政見；工坊類技術上線時，被搶飯碗的手工匠人會不滿、提案抗議。
// 3) 發明家靈光：村民工作時偶爾想到點子，冠上名字（「陳偉式風箱」），推進研究、記進名人堂；愛嫉妒的同行可能說那是他先想到的。
// 全部規則式、零 AI 額度；變化寫進村民記憶，AI 對話會自然提起。載入順序：sim-systems.js 之後（只在執行期用到其他全域）。

// 觀念:每項研究帶來的新想法(中文是 i18n 鍵,英文在 i18n-en.js);c = 爭議度 0～1;threat = 被搶飯碗的職業
const TECH_IDEAS = {
    agriculture: { idea: '照節氣輪作，田才不會累', c: 0.2 },
    metallurgy: { idea: '好鐵要看火候，不是看運氣', c: 0.1 },
    medicine_research: { idea: '生病先看醫生，而不是先求神', c: 0.6 },
    fortification: { idea: '鎮子要有城牆才安全', c: 0.3 },
    commerce: { idea: '做生意要算帳，不能只靠交情', c: 0.4 },
    carpentry: { idea: '鋸木場一天鋸的木頭抵十個木匠', c: 0.5, threat: ['carpenter'] },
    pottery: { idea: '磚窯燒的磚比自己捏的牢', c: 0.2 },
    writing: { idea: '把事情寫下來，就不會吵誰說過什麼', c: 0.3 },
    architecture: { idea: '房子要先畫圖再蓋', c: 0.2 },
    brewing: { idea: '酒坊釀的酒比家釀穩定', c: 0.4, threat: ['cook'] },
    logistics: { idea: '貨要排好路線送，不是想到才送', c: 0.2 },
    masonry: { idea: '石頭房子比木屋耐住', c: 0.2 },
    education: { idea: '每個孩子都該讀書識字', c: 0.5 },
    textiles: { idea: '紡織坊織的布又快又便宜', c: 0.6, threat: ['tailor'] },
    herbalism: { idea: '草藥要煉成藥才有準頭', c: 0.4 },
    milling: { idea: '磨坊和麵包坊能養活更多人', c: 0.5, threat: ['cook', 'farmer'] },
    smithing: { idea: '鋼比鐵好，工坊比鐵匠舖快', c: 0.5, threat: ['blacksmith'] },
    cartography: { idea: '有了地圖，山野就沒那麼可怕', c: 0.2 },
    engineering: { idea: '機器可以替人做粗活', c: 0.8, threat: ['miner', 'carpenter', 'blacksmith'] },
    printing: { idea: '報紙寫的事大家都該知道', c: 0.6 },
    banking: { idea: '銀幣放銀行比藏床底安全', c: 0.7 },
    surgery: { idea: '有些病要開刀才治得好', c: 0.8 },
    civics: { idea: '鎮上的事每個人都有權說話', c: 0.6 },
    astronomy: { idea: '星星是可以算的，不是神諭', c: 0.7 },
    fine_arts: { idea: '畫畫唱歌也是正經事', c: 0.4 },
    sanitation: { idea: '飯前洗手、水要煮開，病就少一半', c: 0.5 },
    siegecraft: { idea: '要和平就得先有準備', c: 0.5 },
    trade_routes: { idea: '和遠方城鎮做生意，大家都會更好', c: 0.4 },
};
// 發明:職業 → 可能想到的東西(中文鍵,英文在 i18n-en.js)
const JOB_INVENTIONS = {
    farmer: ['輪作法', '水車', '新式犁'], miner: ['礦燈', '滑輪吊車'], cook: ['醬汁', '醃漬法'], blacksmith: ['風箱', '淬火法'],
    doctor: ['藥方', '夾板'], researcher: ['算盤', '星盤'], trader: ['帳本格式', '秤'], guard: ['哨笛', '盾牌'],
    carpenter: ['刨刀', '榫頭'], tailor: ['織機', '剪裁法'], priest: ['曆法', '香爐'], mayor: ['公文格式'], _: ['小工具'],
};

class IdeaSystem {
    constructor() { this.ideas = {}; this.inventions = []; this.lastInventDay = -99; this.protested = {}; }
    static fromDict(d) { const s = new IdeaSystem(); if (d && typeof d === 'object') { s.ideas = d.ideas || {}; s.inventions = Array.isArray(d.inventions) ? d.inventions.slice(-30) : []; s.lastInventDay = d.lastInventDay ?? -99; s.protested = d.protested || {}; } return s; }
    toDict() { return { ideas: this.ideas, inventions: this.inventions.slice(-30), lastInventDay: this.lastInventDay, protested: this.protested }; }
    _npcs(w) { return Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead && !(w.visitors && w.visitors[a.agentId]) && !(w.election?._isExploring?.(a))); }
    _day(w) { try { return w._absDay ? w._absDay() : (w.clock?.totalDays || 0); } catch (e) { return 0; } }
    _has(a, tr) { return Array.isArray(a?.personality?.traits) && a.personality.traits.includes(tr); }
    // 接受新事物的程度:個性、年紀、職業、鎮上民風
    openness(w, a, key) {
        let o = 0;
        if (this._has(a, 'creative')) o += 1; if (this._has(a, 'optimist')) o += 0.7; if (this._has(a, 'charismatic')) o += 0.3; if (this._has(a, 'kind')) o += 0.2; if (this._has(a, 'romantic')) o += 0.2;
        if (this._has(a, 'pessimist')) o -= 0.8; if (this._has(a, 'ascetic')) o -= 0.8; if (this._has(a, 'jealous')) o -= 0.4; if (this._has(a, 'stoic')) o -= 0.3; if (this._has(a, 'neurotic')) o -= 0.3;
        if ((a.age || 30) >= 50) o -= 0.8; else if ((a.age || 30) <= 27) o += 0.5;
        const job = a.job?.key; if (job === 'researcher') o += 1.5; if (job === 'priest' && ['medicine_research', 'surgery', 'astronomy'].includes(key)) o -= 1.5;
        if ((TECH_IDEAS[key]?.threat || []).includes(job)) o -= 1.5;
        const tm = w.townCulture?.temper; if (tm === 'dreamy' || tm === 'industrious') o += 0.4; if (tm === 'devout' || tm === 'brawler') o -= 0.4;
        return o;
    }
    // 研究完成:研究員(沒有就挑最開明的一兩位)先接受
    onResearchComplete(w, key) {
        const def = TECH_IDEAS[key]; if (!def || this.ideas[key]) return;
        const npcs = this._npcs(w); if (!npcs.length) return;
        let seeds = npcs.filter(a => a.job?.key === 'researcher');
        if (!seeds.length) seeds = npcs.slice().sort((a, b) => this.openness(w, b, key) - this.openness(w, a, key)).slice(0, 2);
        this.ideas[key] = { a: seeds.map(a => a.agentId), r: [], d: this._day(w), m: 0 };
        for (const a of seeds) a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'discovery', '研究出新東西，我開始相信：{idea}', { idea: def.idea }, 6, []);
        w.logMessageT?.('research', '💡 新觀念出現：「{idea}」——{who}開始到處講', { idea: def.idea, who: seeds.map(a => a.name).join(t('、')) });
        this._threat(w, key);
    }
    // 工坊類技術上線:被搶飯碗的匠人不滿,保守的人會提案抗議
    _threat(w, key) {
        const def = TECH_IDEAS[key]; if (!def?.threat || this.protested[key]) return;
        const hit = this._npcs(w).filter(a => def.threat.includes(a.job?.key)); if (!hit.length) return;
        for (const a of hit) { a.moodModifier = (a.moodModifier || 0) - 6; a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '鎮上有了「{tech}」，我的手藝還有人要嗎？', { tech: w.research?.projects?.[key]?.name || key }, 7, []); }
        const angry = hit.filter(a => this.stance(w, a) <= 0).sort((a, b) => this.openness(w, a, key) - this.openness(w, b, key))[0];
        if (!angry || !w.proposals?._createWith) return;
        this.protested[key] = this._day(w);
        const techName = w.research?.projects?.[key]?.name || key;
        const cand = { kind: 'policy', key: 'protest:' + key, jobs: [angry.job?.key], make: () => ({ kind: 'policy', key: 'protest:' + key, refKey: 'protest_' + key, tk: '保障手工匠人：{tech}暫緩擴產', tp: { tech: techName }, dk: '{who}說新技術搶了匠人的飯碗，要求先照顧靠手藝吃飯的人', dp: { who: angry.name }, cost: { silver: 20 }, effects: { silver: -20, mood_all: 2 }, category: 'welfare', jobBias: [angry.job?.key] }) };
        try { w.proposals._createWith(w, w.proposals._abs ? w.proposals._abs(w) : this._day(w), cand, angry); } catch (e) {}
        w.logMessageT?.('council', '✊ {who}帶頭抗議：「{tech}」搶了手工匠人的飯碗', { who: angry.name, tech: techName }, angry.name);
        w.dailyNews?.collectEvent?.('politics', t('✊ {who}帶頭抗議：「{tech}」搶了手工匠人的飯碗').replace('{who}', angry.name).replace('{tech}', t(techName)), 7, [angry.name]);
    }
    // 立場:接受多 → 革新,抗拒多 → 保守
    stance(w, a) {
        let s = 0; for (const x of Object.values(this.ideas)) { if (x.a.includes(a.agentId)) s += 1; if (x.r.includes(a.agentId)) s -= 1.4; }
        return s + this.openness(w, a, '') * 0.4;
    }
    stanceLabel(w, a) { const s = this.stance(w, a); return s >= 1.5 ? 'progressive' : s <= -0.8 ? 'conservative' : 'moderate'; }
    _refreshStances(w) { for (const a of this._npcs(w)) a.techStance = this.stanceLabel(w, a); }
    // 每天:觀念靠聊天傳開;偶爾有人靈光一閃
    daily(w) {
        const npcs = this._npcs(w); if (!npcs.length) return;
        const byId = Object.fromEntries(npcs.map(a => [a.agentId, a]));
        for (const [key, x] of Object.entries(this.ideas)) {
            const def = TECH_IDEAS[key]; if (!def) continue;
            const undecided = npcs.filter(a => !x.a.includes(a.agentId) && !x.r.includes(a.agentId));
            if (!undecided.length) continue;
            let tries = 0;
            const talkers = [...x.a.map(id => [id, 'a']), ...x.r.map(id => [id, 'r'])].sort(() => Math.random() - 0.5);
            for (const [id, side] of talkers) {
                if (tries >= 4) break; const sp = byId[id]; if (!sp) continue;
                const pool = undecided.filter(o => !x.a.includes(o.agentId) && !x.r.includes(o.agentId)); if (!pool.length) break;
                const near = pool.filter(o => o.currentLocation === sp.currentLocation);
                const o = (near.length ? near : pool)[Math.floor(Math.random() * (near.length ? near : pool).length)];
                tries++;
                const aff = sp.relationships?.relationships?.[o.agentId]?.affinity || 0;
                const op = this.openness(w, o, key);
                if (side === 'a') {
                    const p = Math.max(0.05, Math.min(0.85, 0.28 + op * 0.12 + aff / 300 - def.c * 0.15));
                    if (Math.random() < p) { x.a.push(o.agentId); o.memory?.addT?.(w.tickCount, w.clock.timeStr, 'idea', '{who}說服了我：{idea}', { who: sp.name, idea: def.idea }, 5, [sp.name]); }
                    else if (Math.random() < def.c * 0.45 + Math.max(0, -op) * 0.15) { x.r.push(o.agentId); o.memory?.addT?.(w.tickCount, w.clock.timeStr, 'idea', '{who}一直講「{idea}」，我才不信那一套', { who: sp.name, idea: def.idea }, 5, [sp.name]); }
                } else {
                    const p = Math.max(0, Math.min(0.5, 0.08 + def.c * 0.12 - op * 0.06 + aff / 400));
                    if (Math.random() < p) { x.r.push(o.agentId); o.memory?.addT?.(w.tickCount, w.clock.timeStr, 'idea', '{who}說「{idea}」根本是胡扯，聽起來也有道理', { who: sp.name, idea: def.idea }, 4, [sp.name]); }
                }
            }
            // 里程碑:一半、全鎮
            const here = new Set(npcs.map(a => a.agentId)); const share = x.a.filter(id => here.has(id)).length / npcs.length;
            const stage = share >= 0.95 ? 3 : share >= 0.5 ? 2 : (x.r.length >= 3 ? 1 : 0);
            if (stage > (x.m || 0)) {
                x.m = stage;
                const k = stage === 3 ? '💡 「{idea}」已經是全鎮的共識' : stage === 2 ? '💡 「{idea}」傳開了：鎮上一半的人都這麼想' : '🗣️ 「{idea}」在鎮上引起爭論，{n} 個人公開反對';
                w.logMessageT?.('research', k, { idea: def.idea, n: x.r.length });
                w.dailyNews?.collectEvent?.('research', t(k).replace('{idea}', t(def.idea)).replace('{n}', String(x.r.length)), stage === 1 ? 6 : 5, []);
            }
        }
        this._invent(w, npcs);
        this._refreshStances(w);
    }
    _invent(w, npcs) {
        const day = this._day(w); if (day - (this.lastInventDay ?? -99) < 7) return;
        for (const a of npcs.slice().sort(() => Math.random() - 0.5)) {
            if (!a.job || a.job.key === 'mayor') continue;
            let p = 0.0025; if (this._has(a, 'creative')) p *= 2.2; if (this._has(a, 'perfectionist')) p *= 1.3; if (this._has(a, 'hardworking')) p *= 1.2; if (this._has(a, 'lazy')) p *= 0.4; if (a.job.key === 'researcher') p *= 1.6;
            if (a.techStance === 'progressive') p *= 1.3;
            if (Math.random() >= p) continue;
            const list = JOB_INVENTIONS[a.job.key] || JOB_INVENTIONS._; const thing = list[Math.floor(Math.random() * list.length)];
            const R = w.research; let tech = null;
            if (R?.current && R.projects?.[R.current]?.status === 'researching') { const pr = R.projects[R.current]; pr.progress += Math.round(pr.cost * 0.15); tech = R.current; }
            else w.stockpile?.add?.('research_points', 15, w.tickCount, t('發明'), 'research');
            const inv = { by: a.name, id: a.agentId, thing, job: a.job.key, tech, day };
            this.inventions.push(inv); this.inventions = this.inventions.slice(-30); this.lastInventDay = day;
            a.moodModifier = (a.moodModifier || 0) + 8;
            a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'discovery', '我想出了「{name}式{thing}」！大家都在用', { name: a.name, thing }, 8, []);
            w.logMessageT?.('research', '✨ {name}靈光一閃，做出了「{name}式{thing}」', { name: a.name, thing }, a.name);
            w.dailyNews?.collectEvent?.('research', t('✨ {name}靈光一閃，做出了「{name}式{thing}」').split('{name}').join(a.name).replace('{thing}', t(thing)), 7, [a.name]);
            // 同行眼紅:愛嫉妒或刻薄的同行可能說那是他先想到的
            const rival = npcs.find(o => o !== a && o.job?.key === a.job.key && (this._has(o, 'jealous') || this._has(o, 'abrasive')));
            if (rival && Math.random() < 0.5) {
                const r1 = rival.relationships?.getOrCreate?.(a.agentId, a.name), r2 = a.relationships?.getOrCreate?.(rival.agentId, rival.name);
                if (r1) r1.modifyAffinity ? r1.modifyAffinity(-10) : (r1.affinity = (r1.affinity || 0) - 10); if (r2) r2.modifyAffinity ? r2.modifyAffinity(-8) : (r2.affinity = (r2.affinity || 0) - 8);
                rival.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '那個「{thing}」明明是我先想到的，{name}搶了功勞', { thing, name: a.name }, 7, [a.name]);
                a.memory?.addT?.(w.tickCount, w.clock.timeStr, 'social', '{rival}到處說「{thing}」是他先想到的', { rival: rival.name, thing }, 6, [rival.name]);
                w.logMessageT?.('social', '😤 {rival}不服氣：「{thing}明明是我先想到的！」', { rival: rival.name, thing }, rival.name);
                inv.disputedBy = rival.name;
            }
            return;
        }
    }
    // 給介面:某項科技的觀念現況
    summary(w, key) {
        const x = this.ideas[key]; const def = TECH_IDEAS[key]; if (!x || !def) return null;
        const ids = new Set(this._npcs(w).map(a => a.agentId)); // 只算現在在鎮上的人(搬走、過世、探險中的不算)
        return { idea: def.idea, adopt: x.a.filter(id => ids.has(id)).length, resist: x.r.filter(id => ids.has(id)).length, total: ids.size };
    }
    factions(w) { const out = { progressive: [], moderate: [], conservative: [] }; for (const a of this._npcs(w)) out[this.stanceLabel(w, a)].push(a.name); return out; }
}
if (typeof globalThis !== 'undefined') { globalThis.IdeaSystem = IdeaSystem; globalThis.TECH_IDEAS = TECH_IDEAS; }
