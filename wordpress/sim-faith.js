// v6.60.0 宗教:六種骨架(修真／禪修／通靈／聖堂／祖靈民俗／禮教哲學),只借結構,名字、神祇、經典全部隨機虛構,不醜化任何信仰
// - 每鎮依鎮名種子生成 1–3 個宗教:名稱、主神／主靈、經典、代表色、兩條戒律、一個節日、場所(依城鎮等級長大)
// - 村民有信仰與虔誠度(個性、家庭、遭遇決定);家人通常同信仰;約一成多不信
// - 每天:禮拜讓心情穩、捐獻進教團基金(聖堂型收什一)、禪修型與聖堂型拿基金濟貧、祖靈型讓同信仰的家人更親、禮教型讓人更敬重首長
// - 節日:信徒歡慶;祈禱:日子難過時向神祈求(上帝視角看得到),之後你打出好事卡 → 他相信祈禱應驗;打出災禍卡 → 依信仰解讀(天譴、祖靈不悅、共業…),信徒更虔誠或動搖
// - 喪親:有人更虔誠、有人失去信仰;傳教:虔誠的人勸朋友改宗,家人改宗會失和;神職貪污教團基金(真相頁)
// - AI 知道自己的信仰;鎮況頁有宗教一覽;角色卡有信仰標籤
const FAITH = (() => {
    const npcs = (w) => Object.values(w.agents || {}).filter(a => !a.isPlayer && !a.isDead);
    const day = (w) => { try { return w._absDay?.() ?? 0; } catch (e) { return 0; } };
    const en = () => typeof I18N !== 'undefined' && I18N.getLang?.() === 'en';
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const mem = (w, a, k, p, imp = 5) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'social', k, p || {}, imp, []); } catch (e) {} };
    const log = (w, k, p, who) => { try { w.logMessageT?.('social', k, p || {}, who || ''); } catch (e) {} };
    const reg = (zh, e) => { try { if (typeof I18N !== 'undefined' && zh && e) I18N.registerName(zh, e); } catch (x) {} };
    const money = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    const hash = (str) => { let h = 2166136261; for (const c of String(str || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
    const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
    // 骨架:A/B/C 為名稱詞庫(中英成對),place 依城鎮等級,cat 決定事件卡解讀
    const SK = {
        xiu: { icon: '☯️', zh: '修真', en: 'Way of Cultivation', A: [['玄', 'Mystic'], ['太', 'Supreme'], ['清', 'Pure'], ['虛', 'Void'], ['紫', 'Violet'], ['靈', 'Spirit']], B: [['霞', 'Dawn'], ['松', 'Pine'], ['雲', 'Cloud'], ['泉', 'Spring'], ['鶴', 'Crane'], ['山', 'Mountain']], C: [['道', 'Way'], ['觀', 'Abbey'], ['宗', 'School']],
            deity: (a, b) => [`${a[0]}${b[0]}真君`, `True Lord of ${b[1]}`], book: (a, b) => [`${b[0]}經`, `Scripture of ${b[1]}`], fest: (a, b) => [`${b[0]}醮`, `${b[1]} Rite`],
            place: [['神龕', 'Shrine'], ['道觀', 'Abbey'], ['大道觀', 'Great Abbey'], ['總壇', 'Head Temple']], color: '#5B7F6E',
            pre: [['順應天時，不逆自然', 'Follow the seasons; never fight nature'], ['每日靜坐調息', 'Sit in stillness every day'], ['不貪口腹之欲', 'Do not indulge the appetite']],
            bad: ['天道失衡，這是上天的警示。', 'The balance of heaven is broken. This is a warning.'], good: ['天時正好，這是祥瑞之兆。', 'Heaven smiles on us. This is an auspicious sign.'] },
        chan: { icon: '🪷', zh: '禪修', en: 'Path of Meditation', A: [['明', 'Bright'], ['淨', 'Pure'], ['慈', 'Merciful'], ['妙', 'Wondrous'], ['空', 'Empty'], ['圓', 'Whole']], B: [['月', 'Moon'], ['燈', 'Lamp'], ['蓮', 'Lotus'], ['心', 'Heart'], ['雲', 'Cloud'], ['海', 'Sea']], C: [['宗', 'Sect'], ['寺', 'Temple'], ['蓮社', 'Lotus Society']],
            deity: (a, b) => [`${a[0]}${b[0]}尊者`, `Venerable ${a[1]} ${b[1]}`], book: (a, b) => [`${b[0]}心經`, `Heart Sutra of the ${b[1]}`], fest: (a, b) => [`${b[0]}燈會`, `${b[1]} Lantern Fair`],
            place: [['佛龕', 'Shrine'], ['寺', 'Temple'], ['大寺', 'Great Temple'], ['祖庭', 'Mother Temple']], color: '#C98A2E',
            pre: [['不殺生，多吃素', 'Do not kill; eat mostly greens'], ['布施窮人', 'Give to the poor'], ['不妄語', 'Do not lie']],
            bad: ['這是眾生共業，要多行善積德。', 'This is the karma we all share. We must do more good.'], good: ['善有善報，這是大家積的福。', 'Good deeds bring good fortune. This is the merit we earned.'] },
        ling: { icon: '🪶', zh: '通靈', en: 'Spirit Ways', A: [['白狼', 'White Wolf'], ['火鴉', 'Fire Crow'], ['青鹿', 'Green Stag'], ['黑熊', 'Black Bear'], ['雷鷹', 'Thunder Hawk'], ['月狐', 'Moon Fox']], B: [['', '']], C: [['靈祭', 'Spirit Rite'], ['圖騰', 'Totem'], ['巫環', 'Circle']],
            deity: (a) => [`${a[0]}之靈`, `Spirit of the ${a[1]}`], book: () => ['口傳之歌', 'the Oral Songs'], fest: () => ['火祭', 'Fire Rite'],
            place: [['靈石', 'Spirit Stone'], ['祭壇', 'Altar'], ['大祭壇', 'Great Altar'], ['聖山祭場', 'Sacred Mountain Ground']], color: '#8A4B2E',
            pre: [['敬畏山林與河流', 'Revere the forests and rivers'], ['大事先問巫者占卜', 'Ask the seer before any great matter'], ['不浪費獵物', 'Waste nothing you hunt']],
            bad: ['山靈發怒了，得趕快獻祭。', 'The mountain spirits are angry. We must make offerings.'], good: ['靈們回應了我們的祭拜。', 'The spirits answered our offerings.'] },
        sheng: { icon: '✝️', zh: '聖堂', en: 'Holy Church', A: [['聖', 'Holy']], B: [['光', 'Light'], ['星', 'Star'], ['冠', 'Crown'], ['曦', 'Dawn'], ['泉', 'Spring'], ['焰', 'Flame']], C: [['教會', 'Church'], ['修會', 'Order'], ['聖團', 'Fellowship']],
            deity: (a, b) => [`聖${b[0]}之主`, `Lord of the Holy ${b[1]}`], book: (a, b) => [`聖${b[0]}典`, `Book of the Holy ${b[1]}`], fest: (a, b) => [`聖${b[0]}節`, `Feast of the Holy ${b[1]}`],
            place: [['小禮拜堂', 'Chapel'], ['教堂', 'Church'], ['大教堂', 'Cathedral'], ['總教堂', 'Mother Church']], color: '#3E5C9A',
            pre: [['每七日禮拜', 'Worship every seventh day'], ['奉獻什一', 'Give a tithe'], ['向神職告解過錯', 'Confess your wrongs to the clergy']],
            bad: ['這是天譴，我們得悔改。', 'This is divine punishment. We must repent.'], good: ['神蹟！主聽見了我們的禱告。', 'A miracle! The Lord heard our prayers.'] },
        zu: { icon: '🏮', zh: '祖靈', en: 'Ancestor Faith', A: [['', '']], B: [['青山', 'Green Hill'], ['長河', 'Long River'], ['老樹', 'Old Tree'], ['古井', 'Ancient Well'], ['石橋', 'Stone Bridge'], ['稻田', 'Rice Field']], C: [['祠會', 'Shrine Society'], ['香火會', 'Incense Guild'], ['祖靈社', 'Ancestor Circle']],
            deity: () => ['列祖列宗', 'the Ancestors'], book: () => ['族譜', 'the Clan Register'], fest: () => ['祭祖日', 'Ancestors Day'],
            place: [['土地祠', 'Wayside Shrine'], ['宗祠', 'Ancestral Hall'], ['大宗祠', 'Great Ancestral Hall'], ['總祠', 'Head Ancestral Hall']], color: '#A23B2E',
            pre: [['初一十五上香', 'Burn incense at each new and full moon'], ['孝敬長輩', 'Honor your elders'], ['不讓香火斷絕', 'Never let the family line end']],
            bad: ['祖先不高興了，是不是我們哪裡做錯了？', 'The ancestors are displeased. What did we do wrong?'], good: ['祖先保佑！', 'The ancestors are watching over us!'] },
        li: { icon: '📜', zh: '禮教', en: 'School of Rites', A: [['明德', 'Bright Virtue'], ['崇禮', 'Honored Rites'], ['守仁', 'Kept Benevolence'], ['致和', 'Harmony'], ['敬義', 'Reverent Duty'], ['弘文', 'Great Learning']], B: [['', '']], C: [['學', 'School'], ['書院', 'Academy'], ['禮社', 'Rites Society']],
            deity: () => ['先師', 'the First Teacher'], book: (a) => [`${a[0]}訓`, `Teachings of ${a[1]}`], fest: () => ['釋奠禮', 'Teachers Day'],
            place: [['講堂', 'Lecture Hall'], ['書院', 'Academy'], ['大書院', 'Great Academy'], ['太學', 'Imperial Academy']], color: '#6E5A8A',
            pre: [['尊師重道', 'Respect teachers and learning'], ['守禮知分', 'Keep the rites; know your place'], ['不欺暗室', 'Be honest even when unseen']],
            bad: ['這是失德之兆，上位者要反省。', 'This is a sign of lost virtue. Those in power must reflect.'], good: ['德行感天，才有這等好事。', 'Virtue moved heaven to bring us this.'] },
    };
    const KEYS = Object.keys(SK);
    for (const D of Object.values(SK)) { reg(D.zh, D.en); reg(D.bad[0], D.bad[1]); reg(D.good[0], D.good[1]); for (const p of D.place) reg(p[0], p[1]); for (const p of D.pre) reg(p[0], p[1]); } // 固定詞也登記中英對照(英文介面自動換)
    function makeReligion(r, sk, i) {
        const D = SK[sk]; const a = pick(r, D.A), b = pick(r, D.B), c = pick(r, D.C);
        const zh = `${a[0]}${b[0]}${c[0]}`, enName = [a[1], b[1], c[1]].filter(Boolean).join(' ');
        const deity = D.deity(a, b), book = D.book(a, b), fest = D.fest(a, b);
        const pre = D.pre.slice().sort(() => r() - 0.5).slice(0, 2);
        const R = { id: 'R' + (i + 1), sk, name: [zh, enName], deity, book, fest, pre, color: D.color, fund: 0, festDay: 3 + Math.floor(r() * 10), festSeason: Math.floor(r() * 4) };
        regNames(R); return R;
    }
    function regNames(R) { reg(R.name[0], R.name[1]); reg(R.deity[0], R.deity[1]); reg(R.book[0], R.book[1]); reg(R.fest[0], R.fest[1]); for (const p of R.pre || []) reg(p[0], p[1]); for (const p of SK[R.sk]?.place || []) reg(p[0], p[1]); }
    function initPiety(a, r) {
        let p = 35 + r() * 30; if (a.job?.key === 'priest') p = 80 + r() * 15; if (has(a, 'ascetic')) p += 15; if (has(a, 'stoic')) p += 5; if (has(a, 'neurotic') || has(a, 'pessimist')) p += 5;
        if (['doctor', 'researcher'].includes(a.job?.key)) p -= 15; if (has(a, 'creative')) p -= 5; return Math.max(5, Math.min(100, Math.round(p)));
    }
    function S(w) {
        if (!w.faith || !Array.isArray(w.faith.rels)) {
            const r = rng(hash(w.townName || 'town') ^ 0x9e37);
            const n = npcs(w).length >= 30 ? 2 + (r() < 0.4 ? 1 : 0) : 1 + (r() < 0.5 ? 1 : 0);
            const sks = KEYS.slice().sort(() => r() - 0.5).slice(0, n);
            w.faith = { rels: sks.map((k, i) => makeReligion(r, k, i)), of: {}, prayers: {}, lastGrave: (w.lifecycle?.graveyard || []).length, lastDay: null };
        }
        const F = w.faith; F.of = F.of || {}; F.prayers = F.prayers || {};
        if (!F._reg) { F._reg = true; for (const R of F.rels) regNames(R); }
        // 新來的人(出生、移民)也要有信仰:先跟父母,沒有就依鎮上比例
        for (const a of npcs(w)) if (!F.of[a.agentId]) assign(w, F, a);
        return F;
    }
    function assign(w, F, a) {
        const r = Math.random; let rel = null;
        const parents = (a._parentNames || []).map(n => npcs(w).find(o => o.name === n)).filter(Boolean);
        const pf = parents.map(p => F.of[p.agentId]?.rel).find(Boolean);
        if (pf && r() < 0.85) rel = pf;
        else if (a.job?.key === 'priest') rel = F.rels[0]?.id;
        else if (r() > 0.13) { const x = r(); rel = F.rels.length === 1 ? F.rels[0].id : x < 0.6 ? F.rels[0].id : x < 0.88 || F.rels.length < 3 ? F.rels[1].id : F.rels[2].id; }
        F.of[a.agentId] = { rel, piety: rel ? initPiety(a, r) : Math.round(5 + r() * 15) };
    }
    const relOf = (w, a) => { const F = w.faith; const f = F?.of?.[a?.agentId]; return f?.rel ? F.rels.find(R => R.id === f.rel) || null : null; };
    const pietyOf = (w, a) => w.faith?.of?.[a?.agentId]?.piety ?? 0;
    const N = (pair) => (en() ? pair[1] : pair[0]);
    const bumpP = (w, a, n) => { const f = w.faith?.of?.[a.agentId]; if (f) f.piety = Math.max(0, Math.min(100, f.piety + n)); };
    const tierLv = (w) => (typeof TIERS !== 'undefined' ? TIERS.level(w) : 0);
    const placeOf = (w, R) => SK[R.sk].place[Math.max(0, Math.min(3, tierLv(w)))];
    const believers = (w, R) => npcs(w).filter(a => w.faith.of[a.agentId]?.rel === R.id);
    function daily(w) {
        const F = S(w), d = day(w); if (F.lastDay === d) return; F.lastDay = d;
        const all = npcs(w);
        // 禮拜與捐獻
        for (const a of all) {
            const f = F.of[a.agentId]; const R = relOf(w, a); if (!R || !f) continue;
            if (f.piety >= 50 && (a.mood || 50) < 50) a.moodModifier = (a.moodModifier || 0) + 1; // 信仰讓人撐得住
            const cash = money(w, a);
            if (typeof WALLET !== 'undefined' && w.wallet && cash > 20) {
                const rate = R.sk === 'sheng' && d % 7 === 0 ? 0.05 : (f.piety >= 60 && Math.random() < 0.15 ? 0.02 : 0); // 聖堂型每七天什一(簡化為 5%)
                const n = Math.floor(cash * rate); if (n >= 1 && WALLET.take(w, a, n)) R.fund = (R.fund || 0) + n;
            }
        }
        for (const R of F.rels) {
            const bs = believers(w, R);
            // 濟貧:禪修型、聖堂型用教團基金救濟最窮的信徒與鄰人
            if ((R.sk === 'chan' || R.sk === 'sheng') && R.fund >= 10 && typeof WALLET !== 'undefined' && w.wallet) {
                const poor = all.filter(a => money(w, a) < 8).sort((x, y) => money(w, x) - money(w, y)).slice(0, 2);
                for (const p of poor) { const n = Math.min(8, Math.floor(R.fund / 2)); if (n < 1) break; R.fund -= n; WALLET.add(w, p, n); p.moodModifier = (p.moodModifier || 0) + 3; mem(w, p, '{r}接濟了我 {n} 銀幣。', { r: R.name[0], n }, 5); }
            }
            // 祖靈型:同信仰的家人更親
            if (R.sk === 'zu') for (const a of bs) for (const pn of a._parentNames || []) { const p = bs.find(o => o.name === pn); if (p) { a.relationships.getOrCreate(p.agentId, p.name).modifyAffinity(0.3); } }
            // 禮教型:敬重首長(王都時國王民心微升)
            if (R.sk === 'li' && bs.length && w.crown && w.crown.king && !w.crown.republic) w.crown.legit = Math.min(100, (w.crown.legit || 50) + 0.05 * bs.length / Math.max(1, all.length) * 10);
            // 神職貪污(偶爾,真相頁看得到)
            const priest = bs.find(a => a.job?.key === 'priest');
            if (priest && R.fund >= 40 && Math.random() < 0.04 && !has(priest, 'ascetic')) { const n = Math.floor(R.fund * 0.3); R.fund -= n; try { WALLET.add(w, priest, n); DARK.secret(w, { kind: 'scheme', culprit: priest.agentId, victim: priest.agentId, k: '{a}從{r}的奉獻裡私吞了 {n} 銀幣', p: { a: priest.name, r: R.name[0], n } }); } catch (e) {} }
            // 節日
            const season = ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock?.season); if (season === R.festSeason && w.clock?.day === R.festDay && R._festDay !== d) {
                R._festDay = d; for (const a of bs) { a.moodModifier = (a.moodModifier || 0) + 6; bumpP(w, a, 2); }
                log(w, '{i} {r}過{f}，{n} 位信徒齊聚{p}。', { i: SK[R.sk].icon, r: R.name[0], f: R.fest[0], n: bs.length, p: placeOf(w, R)[0] });
                try { w.dailyNews?.collectEvent?.('event', `${t(R.name[0])}${t('：')}${t(R.fest[0])}`, 6, []); } catch (e) {}
            }
        }
        grief(w, F);
        pray(w, F, d);
        preach(w, F);
    }
    // 喪親:有人更虔誠,有人失去信仰
    function grief(w, F) {
        const g = w.lifecycle?.graveyard || []; if (g.length <= (F.lastGrave || 0)) { F.lastGrave = g.length; return; }
        const dead = g.slice(F.lastGrave || 0); F.lastGrave = g.length;
        for (const x of dead) for (const a of npcs(w)) {
            const rel = Object.values(a.relationships?.relationships || {}).find(r => r.targetName === x.name); if (!rel || rel.affinity < 40) continue;
            const f = F.of[a.agentId]; if (!f) continue;
            if (f.rel && (f.piety < 35 || Math.random() < 0.3)) { const R = relOf(w, a); f.rel = null; f.piety = Math.max(0, f.piety - 25); mem(w, a, '{x}走了以後，我再也不信{r}了。', { x: x.name, r: R?.name[0] || '' }, 7); log(w, '🥀 {a}失去了信仰。', { a: a.name }, a.name); }
            else if (f.rel) { bumpP(w, a, 15); mem(w, a, '{x}走了，我只能更虔誠地祈禱，求祂讓{x}安息。', { x: x.name }, 7); }
            else if (F.rels.length && Math.random() < 0.3) { f.rel = F.rels[0].id; f.piety = 45; mem(w, a, '{x}走了以後，我開始去{p}了。', { x: x.name, p: placeOf(w, F.rels[0])[0] }, 7); log(w, '🕯️ {a}在喪親之後信了{r}。', { a: a.name, r: F.rels[0].name[0] }, a.name); }
        }
    }
    // 祈禱:日子難過時向神祈求
    function pray(w, F, d) {
        for (const id of Object.keys(F.prayers)) if (d - F.prayers[id].day > 4) delete F.prayers[id];
        for (const a of npcs(w)) {
            const R = relOf(w, a); const f = F.of[a.agentId]; if (!R || !f || f.piety < 40 || F.prayers[a.agentId]) continue;
            const th = (a.thoughts || []).map(x => x.kind || x.type || x);
            const hungry = th.includes('hungry'), poor = money(w, a) < 5 && !!w.wallet, low = (a.mood || 50) < 35, sick = (a.health ?? 100) < 50;
            if (!(hungry || poor || low || sick) || Math.random() > 0.25) continue;
            const wish = hungry ? '別讓家裡斷糧' : sick ? '讓病快點好起來' : poor ? '能有份穩定的收入' : '讓日子好過一點';
            F.prayers[a.agentId] = { day: d, wish, rel: R.id };
            mem(w, a, '我向{g}祈求：{wish}。', { g: R.deity[0], wish }, 6);
            log(w, '🙏 {a}向{g}祈禱：「{wish}」', { a: a.name, g: R.deity[0], wish }, a.name);
        }
    }
    // 傳教:虔誠的人勸朋友改宗;家人改宗會失和
    function preach(w, F) {
        if (F.rels.length < 1) return;
        for (const a of npcs(w)) {
            const R = relOf(w, a); const f = F.of[a.agentId]; if (!R || !f || f.piety < 70) continue;
            const zeal = R.sk === 'sheng' ? 0.06 : R.sk === 'chan' ? 0.03 : 0.02; if (Math.random() > zeal) continue;
            const friends = Object.values(a.relationships?.relationships || {}).filter(r => r.affinity >= 30).map(r => w.agents[r.targetId]).filter(o => o && !o.isDead && !o.isPlayer && F.of[o.agentId]?.rel !== R.id);
            const o = friends[Math.floor(Math.random() * friends.length)]; if (!o) continue;
            const of = F.of[o.agentId]; const resist = (of.rel ? of.piety : 10) / 100 + (has(o, 'stoic') ? 0.2 : 0);
            if (Math.random() < 0.5 - resist * 0.6) {
                const oldR = relOf(w, o); of.rel = R.id; of.piety = 45;
                mem(w, o, '{a}帶我認識了{r}，我決定改信。', { a: a.name, r: R.name[0] }, 7);
                log(w, '{i} {o}在{a}的勸說下改信{r}。', { i: SK[R.sk].icon, o: o.name, a: a.name, r: R.name[0] }, o.name);
                // 家人失和
                if (oldR) for (const fam of npcs(w)) if (F.of[fam.agentId]?.rel === oldR.id && F.of[fam.agentId].piety >= 50 && ((fam._parentNames || []).includes(o.name) || (o._parentNames || []).includes(fam.name) || fam.relationships?.relationships?.[o.agentId]?.status === 'married')) {
                    fam.relationships.getOrCreate(o.agentId, o.name).modifyAffinity(-12); mem(w, fam, '{o}背棄了{r}，家裡吵得很兇。', { o: o.name, r: oldR.name[0] }, 7);
                }
            } else mem(w, o, '{a}一直勸我信{r}，我不想。', { a: a.name, r: R.name[0] }, 4);
        }
    }
    // 你打出的事件卡,在信徒眼裡是神意
    function onCard(w, card) {
        const F = S(w), d = day(w); const good = card?.cat === 'fortune', bad = card?.cat === 'disaster' || card?.cat === 'mishap'; if (!good && !bad) return;
        let answered = 0;
        for (const a of npcs(w)) {
            const R = relOf(w, a); const f = F.of[a.agentId]; if (!R || !f) continue;
            const pr = F.prayers[a.agentId];
            if (good && pr) { delete F.prayers[a.agentId]; bumpP(w, a, 15); answered++; mem(w, a, '我的祈禱應驗了！{g}聽見了。', { g: R.deity[0] }, 8); log(w, '✨ {a}相信自己的祈禱應驗了。', { a: a.name }, a.name); continue; }
            if (bad && pr && f.piety < 60) { delete F.prayers[a.agentId]; bumpP(w, a, -12); mem(w, a, '我祈禱了，換來的卻是災禍……', {}, 7); continue; }
            if (Math.random() > 0.35) continue;
            const line = (good ? SK[R.sk].good : SK[R.sk].bad)[0];
            mem(w, a, line, {}, 5);
            if (good) bumpP(w, a, 3); else if (f.piety >= 50) bumpP(w, a, 4); else bumpP(w, a, -4);
        }
        return answered;
    }
    function brief(w, a) { const R = relOf(w, a); if (!R) return a && w.faith ? t('信仰：沒有信仰') : ''; const p = pietyOf(w, a); return `${t('信仰')}${t('：')}${N(R.name)}${t('（')}${N([SK[R.sk].zh, SK[R.sk].en])}${t('，')}${t('虔誠')} ${p}/100${t('）')}`; }
    function townBrief(w) { const F = w.faith; if (!F) return ''; return `${t('宗教')}${t('：')}${F.rels.map(R => `${N(R.name)}${t('（')}${believers(w, R).length}${t('人')}${t('）')}`).join(t('、'))}`; }
    function chip(w, a) { const R = relOf(w, a); if (!R) return w.faith ? `🚫 ${t('沒有信仰')}` : ''; const p = pietyOf(w, a); return `${SK[R.sk].icon} ${N(R.name)} · ${t(p >= 70 ? '虔誠' : p >= 40 ? '一般' : '淡薄')}`; }
    function view(w) {
        const F = S(w);
        return F.rels.map(R => ({ id: R.id, icon: SK[R.sk].icon, name: N(R.name), sk: N([SK[R.sk].zh, SK[R.sk].en]), deity: N(R.deity), book: N(R.book), fest: N(R.fest), festWhen: `${t(['春季', '夏季', '秋季', '冬季'][R.festSeason])} ${t('第')} ${R.festDay} ${t('天')}`, place: N(placeOf(w, R)), pre: (R.pre || []).map(N), color: R.color, n: believers(w, R).length, fund: Math.round(R.fund || 0) }))
            .concat([]);
    }
    const nonBelievers = (w) => npcs(w).filter(a => !S(w).of[a.agentId]?.rel).length;
    return { S, SK, KEYS, daily, onCard, relOf, pietyOf, brief, townBrief, chip, view, nonBelievers, makeReligion, rng, hash, bumpP, placeOf, believers };
})();
if (typeof EventCardSystem !== 'undefined') {
    const _play = EventCardSystem.prototype.play;
    EventCardSystem.prototype.play = function (w, id, ...rest) { const r = _play.call(this, w, id, ...rest); try { if (r && r.ok !== false && w.observerMode) FAITH.onCard(w, this.card(id)); } catch (e) { console.warn('[Faith] card', e); } return r; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) FAITH.daily(w); } catch (e) { console.warn('[Faith] daily', e); } return r; };
}
// 微服出巡的神明:越虔誠越容易察覺旅人不是凡人
if (typeof TRAVELER !== 'undefined') {
    const _p = TRAVELER.piety;
    TRAVELER.piety = function (a) { const base = _p.call(this, a); try { const w = typeof window !== 'undefined' ? window.rimtownApp?.world : null; if (w?.faith?.of?.[a.agentId]) return base * (0.5 + FAITH.pietyOf(w, a) / 60); } catch (e) {} return base; };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype;
    const _ab = CE._agentBrief; CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { if (world.faith) { const s = FAITH.brief(world, a); if (s) { const m = b.mem || []; b.mem = [...m.slice(0, 1), s, ...m.slice(1)]; } } } catch (e) {} return b; };
    const _tb = CE._townBrief; CE._townBrief = function (world) { const s = _tb.call(this, world); try { const f = FAITH.townBrief(world); return f ? `${s}${t('；')}${f}` : s; } catch (e) { return s; } };
    const _cp = CE._buildCharacterProfile; CE._buildCharacterProfile = function (agent) { const p = _cp.call(this, agent); try { const w = this._world || (typeof window !== 'undefined' && window.rimtownApp?.world); const s = w?.faith && FAITH.brief(w, agent); if (s) p.values = `${p.values}${t('；')}${s}`; } catch (e) {} return p; };
}
if (typeof World !== 'undefined') {
    const _reset = World.prototype.reset;
    World.prototype.reset = function (...args) { const r = _reset.apply(this, args); this.faith = null; return r; };
    const _ser = World.prototype.serialize;
    World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.faith) { const { _reg, ...f } = this.faith; d.faith = f; } return d; };
    const _load = World.prototype.loadSave;
    World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.faith = (data?.faith && Array.isArray(data.faith.rels)) ? Object.assign({}, data.faith) : null; } catch (e) {} return r; };
}
if (typeof globalThis !== 'undefined') globalThis.FAITH = FAITH;
