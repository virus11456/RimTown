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
    // 神職私吞奉獻(擲骰版與決策核心共用):拿走基金的三成,真相頁看得到
    function embezzle(w, R, priest) { const n = Math.floor(R.fund * 0.3); R.fund -= n; try { WALLET.add(w, priest, n); DARK.secret(w, { kind: 'scheme', culprit: priest.agentId, victim: priest.agentId, k: '{a}從{r}的奉獻裡私吞了 {n} 銀幣', p: { a: priest.name, r: R.name[0], n } }); } catch (e) {} return n; }
    // v9.26.0 給決策核心:管奉獻箱的神職(跟以前擲骰的是同一批人:基金有 40 銀幣以上、不是苦行的人)
    function embezzleInfo(w, a) {
        if (!a || a.job?.key !== 'priest' || has(a, 'ascetic') || typeof WALLET === 'undefined' || !w.wallet) return null; const R = relOf(w, a); if (!R || !(R.fund >= 40)) return null;
        if (believers(w, R).find(x => x.job?.key === 'priest') !== a) return null; // 一個教團只有一位管錢的
        return { R, fund: Math.floor(R.fund), n: Math.floor(R.fund * 0.3) };
    }
    function embezzleBy(w, a) { const I = embezzleInfo(w, a); if (!I) return null; const n = embezzle(w, I.R, a); mem(w, a, '我從{r}的奉獻箱裡拿了 {n} 銀幣，沒有人知道。', { r: I.R.name[0], n }, 6); return { n, R: I.R }; }
    const believers = (w, R) => npcs(w).filter(a => w.faith.of[a.agentId]?.rel === R.id);
    // v7.0.0 宗教財務:捐獻進基金(若已課稅,15% 交公庫);基金付維護、辦節日、濟貧,太多就蓋場所
    const TAX_RATE = 0.15;
    function give(w, F, R, n) { const tax = F.tax ? Math.round(n * TAX_RATE * 100) / 100 : 0; if (tax > 0) { w.stockpile?.add?.('silver', tax, w.tickCount, t('宗教捐獻稅')); F.taxPaid = Math.round(((F.taxPaid || 0) + tax) * 100) / 100; } R.fund = Math.round(((R.fund || 0) + n - tax) * 100) / 100; R.got = Math.round(((R.got || 0) + n) * 100) / 100; }
    const payLocal = (w, k, n, why) => { if (!(n > 0)) return; if (typeof MARKET !== 'undefined' && w.market && MARKET.sell) MARKET.sell(w, k, n, why); else w.stockpile?.add?.('silver', n, w.tickCount, why); };
    function spend(w, F, R, bs, d) {
        if (!(typeof WALLET !== 'undefined' && w.wallet)) return; const take = (n) => { n = Math.min(R.fund || 0, Math.round(n * 100) / 100); if (n <= 0) return 0; R.fund = Math.round((R.fund - n) * 100) / 100; return n; };
        // 場所維護:每天 0.3 ＋ 每位信徒 0.03(付給木作坊)
        const up = take(0.3 + bs.length * 0.03); if (up) { payLocal(w, 'timber', up, t('宗教場所維護')); R.upkeep = Math.round(((R.upkeep || 0) + up) * 100) / 100; }
        // 節日辦桌(付給食堂與農莊)
        const season = ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock?.season);
        if (season === R.festSeason && w.clock?.day === R.festDay && R._feastDay !== d) { R._feastDay = d; const n = take(Math.min((R.fund || 0) * 0.4, bs.length * 1.5)); if (n) { if (typeof MARKET !== 'undefined' && w.market && MARKET.sale) MARKET.sale(w, 'meal', n); else w.stockpile?.add?.('silver', n, w.tickCount, t('節日辦桌')); R.feasts = Math.round(((R.feasts || 0) + n) * 100) / 100; } }
        // 基金太多:超過(100 ＋ 每位信徒 8)的部分,每天拿一成出來,一半修建場所(付給木作坊與礦場)、一半救濟鎮上最窮的人
        const cap = 100 + bs.length * 8; if ((R.fund || 0) > cap) { const n = take(((R.fund || 0) - cap) * 0.1); if (n) { const r2 = (x) => Math.round(x * 100) / 100; const wood = r2(n * 0.3), stone = r2(n * 0.2), rest = r2(n - wood - stone); // 三份都算到分、最後一份拿剩下的(以前各自四捨五入,每次多出或少掉一兩分)
            payLocal(w, 'timber', wood, t('修建宗教場所')); payLocal(w, 'mine', stone, t('修建宗教場所'));
            const poor = npcs(w).filter(a => money(w, a) < 15).sort((x, y) => money(w, x) - money(w, y)).slice(0, 3);
            if (poor.length) { const each = Math.floor(rest / poor.length * 100) / 100; poor.forEach((p, i) => WALLET.add(w, p, i === 0 ? r2(rest - each * (poor.length - 1)) : each)); } else payLocal(w, 'timber', rest, t('修建宗教場所')); R.built = Math.round(((R.built || 0) + n) * 100) / 100; } }
    }
    // v9.22.0 要不要奉獻、奉獻多少，交給信徒本人決定(sim-decide-life.js)；這裡只剩結算。聖堂型每七天的什一是教規，照舊。擲骰的版本留給直接呼叫 daily() 的情況
    // 大筆捐獻:神職與同信仰的人對他更有好感(捐錢換聲望)
    function bigGift(w, F, R, a, big) {
        give(w, F, R, big); R.big = (R.big || 0) + 1;
        for (const o of believers(w, R)) if (o !== a && (o.job?.key === 'priest' || Math.random() < 0.3)) o.relationships?.getOrCreate?.(a.agentId, a.name)?.modifyAffinity?.(o.job?.key === 'priest' ? 6 : 2);
        log(w, '🙏 {a}捐了 {n} 銀幣給{r}。', { a: a.name, n: big, r: R.name[0] }, a.name); mem(w, a, '我捐了 {n} 銀幣給{r}，大家看我的眼神都不一樣了。', { n: big, r: R.name[0] }, 5);
    }
    // 這個信徒現在拿得出多少：{ R, piety, cash, small(隨手奉獻), big(大筆捐獻，手上不到 150 就是 0) }
    function giftInfo(w, a) {
        if (!(typeof WALLET !== 'undefined' && w.wallet) || !a) return null; const F = S(w); const f = F.of[a.agentId]; const R = relOf(w, a); if (!R || !f) return null;
        const cash = money(w, a); if (cash <= 20) return null; const big = cash >= 150 ? Math.min(40, Math.floor(cash * 0.08)) : 0;
        return { R, piety: f.piety, cash, small: Math.max(1, Math.floor(cash * 0.02)), big: big >= 5 ? big : 0 };
    }
    // 本人決定奉獻(由決策核心呼叫)。回傳實際奉獻的銀幣
    function donate(w, a, big) {
        const I = giftInfo(w, a); if (!I) return 0; const F = S(w); const n = big ? I.big : I.small; if (!(n >= 1) || !WALLET.take(w, a, n)) return 0;
        if (big) bigGift(w, F, I.R, a, n); else { give(w, F, I.R, n); mem(w, a, '我奉獻了 {n} 銀幣給{r}。', { n, r: I.R.name[0] }, 3); }
        return n;
    }
    function daily(w) {
        const F = S(w), d = day(w); if (F.lastDay === d) return; F.lastDay = d;
        const all = npcs(w);
        try { if (d % 5 === 2) taxProposal(w, F, d); } catch (e) {}
        // 禮拜與捐獻
        for (const a of all) {
            const f = F.of[a.agentId]; const R = relOf(w, a); if (!R || !f) continue;
            if (f.piety >= 50 && (a.mood || 50) < 50) a.moodModifier = (a.moodModifier || 0) + 1; // 信仰讓人撐得住
            const cash = money(w, a);
            if (typeof WALLET !== 'undefined' && w.wallet && cash > 20) {
                const rate = R.sk === 'sheng' && d % 7 === 0 ? 0.05 : 0; // 聖堂型每七天什一(簡化為 5%)；平常的奉獻、大筆捐獻由本人決定(giftBy)
                const n = Math.floor(cash * rate); if (n >= 1 && WALLET.take(w, a, n)) give(w, F, R, n);
            }
        }
        for (const R of F.rels) {
            const bs = believers(w, R);
            // v7.0.0 教團基金要花:場所維護付給木作坊、節日辦桌付給食堂、太多就蓋場所與濟貧(錢回到鎮上,不會憑空消失)
            spend(w, F, R, bs, d);
            // 濟貧:禪修型、聖堂型用教團基金救濟最窮的信徒與鄰人
            if (R.fund >= 10 && typeof WALLET !== 'undefined' && w.wallet) { // v7.0.0 每個宗教都濟貧:禪修、聖堂救全鎮最窮的兩人,其他宗教照顧最窮的一位自己信徒
                const wide = R.sk === 'chan' || R.sk === 'sheng';
                const poor = (wide ? all : bs).filter(a => money(w, a) < 8).sort((x, y) => money(w, x) - money(w, y)).slice(0, wide ? 2 : 1);
                for (const p of poor) { const n = Math.min(wide ? 8 : 3, Math.floor(R.fund / 2)); if (n < 1) break; R.fund -= n; WALLET.add(w, p, n); R.relief = (R.relief || 0) + n; p.moodModifier = (p.moodModifier || 0) + 3; mem(w, p, '{r}接濟了我 {n} 銀幣。', { r: R.name[0], n }, 5); }
            }
            // 祖靈型:同信仰的家人更親
            if (R.sk === 'zu') for (const a of bs) for (const pn of a._parentNames || []) { const p = bs.find(o => o.name === pn); if (p) { a.relationships.getOrCreate(p.agentId, p.name).modifyAffinity(0.3); } }
            // 禮教型:敬重首長(王都時國王民心微升)
            if (R.sk === 'li' && bs.length && w.crown && w.crown.king && !w.crown.republic) w.crown.legit = Math.min(100, (w.crown.legit || 50) + 0.05 * bs.length / Math.max(1, all.length) * 10);
            // 神職貪污(真相頁看得到):拿不拿由神職自己決定(embezzleBy)
            // 節日
            const season = ['春季', '夏季', '秋季', '冬季'].indexOf(w.clock?.season); if (season === R.festSeason && w.clock?.day === R.festDay && R._festDay !== d) {
                R._festDay = d; for (const a of bs) { a.moodModifier = (a.moodModifier || 0) + 6; bumpP(w, a, 2); }
                log(w, '{i} {r}過{f}，{n} 位信徒齊聚{p}。', { i: SK[R.sk].icon, r: R.name[0], f: R.fest[0], n: bs.length, p: placeOf(w, R)[0] });
                try { w.dailyNews?.collectEvent?.('event', `${t(R.name[0])}${t('：')}${t(R.fest[0])}`, 6, []); } catch (e) {}
            }
        }
        grief(w, F);
        pray(w, F, d);
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
    const WISH = { hungry: '別讓家裡斷糧', sick: '讓病快點好起來', poor: '能有份穩定的收入', low: '讓日子好過一點' };
    function trouble(w, a) {
        const th = (a.thoughts || []).map(x => x.kind || x.type || x);
        const hungry = th.includes('hungry'), poor = money(w, a) < 5 && !!w.wallet, low = (a.mood || 50) < 35, sick = (a.health ?? 100) < 50;
        return hungry ? 'hungry' : sick ? 'sick' : poor ? 'poor' : low ? 'low' : null;
    }
    function prayDo(w, F, a, R, why, d) {
        const wish = WISH[why] || WISH.low;
        F.prayers[a.agentId] = { day: d, wish, rel: R.id };
        mem(w, a, '我向{g}祈求：{wish}。', { g: R.deity[0], wish }, 6);
        log(w, '🙏 {a}向{g}祈禱：「{wish}」', { a: a.name, g: R.deity[0], wish }, a.name);
        return wish;
    }
    function pray(w, F, d) {
        for (const id of Object.keys(F.prayers)) if (d - F.prayers[id].day > 4) delete F.prayers[id]; // 要不要祈禱由本人決定(prayBy)
    }
    // v9.27.0 給決策核心:這個人現在是不是日子難過、又夠虔誠(跟以前擲骰的是同一批人)
    function prayInfo(w, a) { const F = S(w); const R = relOf(w, a); const f = F.of[a?.agentId]; if (!a || !R || !f || f.piety < 40 || F.prayers[a.agentId]) return null; const why = trouble(w, a); return why ? { R, why, wish: WISH[why], piety: Math.round(f.piety) } : null; }
    function prayBy(w, a) { const I = prayInfo(w, a); return I ? prayDo(w, S(w), a, I.R, I.why, day(w)) : null; }
    // 傳教:虔誠的人勸朋友改宗;家人改宗會失和
    const zealOf = (R) => (R.sk === 'sheng' ? 0.06 : R.sk === 'chan' ? 0.03 : 0.02);
    const preachFriends = (w, F, a, R) => Object.values(a.relationships?.relationships || {}).filter(r => r.affinity >= 30).map(r => w.agents[r.targetId]).filter(o => o && !o.isDead && !o.isPlayer && F.of[o.agentId] && F.of[o.agentId].rel !== R.id);
    const resistOf = (F, o) => { const of = F.of[o.agentId]; return (of.rel ? of.piety : 10) / 100 + (has(o, 'stoic') ? 0.2 : 0); };
    function convertDo(w, F, a, o, R) {
        const of = F.of[o.agentId]; const oldR = relOf(w, o); of.rel = R.id; of.piety = 45;
        mem(w, o, '{a}帶我認識了{r}，我決定改信。', { a: a.name, r: R.name[0] }, 7);
        log(w, '{i} {o}在{a}的勸說下改信{r}。', { i: SK[R.sk].icon, o: o.name, a: a.name, r: R.name[0] }, o.name);
        // 家人失和
        if (oldR) for (const fam of npcs(w)) if (F.of[fam.agentId]?.rel === oldR.id && F.of[fam.agentId].piety >= 50 && ((fam._parentNames || []).includes(o.name) || (o._parentNames || []).includes(fam.name) || fam.relationships?.relationships?.[o.agentId]?.status === 'married')) {
            fam.relationships.getOrCreate(o.agentId, o.name).modifyAffinity(-12); mem(w, fam, '{o}背棄了{r}，家裡吵得很兇。', { o: o.name, r: oldR.name[0] }, 7);
        }
    }
    const refuseDo = (w, a, o, R) => mem(w, o, '{a}一直勸我信{r}，我不想。', { a: a.name, r: R.name[0] }, 4);
    // v9.27.0 給決策核心:很虔誠、又有信別的(或不信)的好朋友的人,可以去勸;被勸的人自己決定改不改
    function preachInfo(w, a) {
        const F = S(w); const R = relOf(w, a); const f = F.of[a?.agentId]; if (!a || !R || !f || f.piety < 70) return null;
        const friends = preachFriends(w, F, a, R).sort((x, y) => (a.relationships.relationships[y.agentId]?.affinity || 0) - (a.relationships.relationships[x.agentId]?.affinity || 0)).slice(0, 2);
        return friends.length ? { R, zeal: zealOf(R), friends } : null;
    }
    function preachBy(w, a, oid) {
        const I = preachInfo(w, a); const o = I ? I.friends.find(x => x.agentId === oid) : null; if (!o) return null;
        mem(w, a, '我去勸{o}信{r}。', { o: o.name, r: I.R.name[0] }, 5);
        try { DECIDE.enqueue(w, o, 'convert', { by: a.agentId, rel: I.R.id }); } catch (e) {}
        return o;
    }
    function convertInfo(w, o, c) {
        const F = S(w); const a = w.agents[c?.by]; const R = F.rels.find(x => x.id === c?.rel); const of = F.of[o?.agentId]; if (!o || !a || a.isDead || !R || !of || of.rel === R.id) return null;
        return { a, R, oldR: relOf(w, o), piety: Math.round(of.piety || 0), p: Math.max(0.02, 0.5 - resistOf(F, o) * 0.6) };
    }
    function convertBy(w, o, c, yes) { const I = convertInfo(w, o, c); if (!I) return null; if (yes) convertDo(w, S(w), I.a, o, I.R); else refuseDo(w, I.a, o, I.R); return I; }
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
    // v7.0.0 宗教課稅:預設免稅;公庫吃緊、教團基金又很多時,不信教或看重財富的人提案「宗教捐獻課 15% 稅」;課了之後神職會提案取消
    function taxProposal(w, F, d) {
        const P = w.proposals; if (!P?._createWith || !w.wallet || d - (F.lastTaxProp || -99) < 30) return;
        if ((P.items || []).some(p => (p.kind === 'faith_tax' || p.kind === 'faith_untax') && ['open', 'shelved', 'approved'].includes(p.status))) return;
        const funds = F.rels.reduce((s, R) => s + (R.fund || 0), 0), tr = w.stockpile?.get?.('silver') || 0, all = npcs(w);
        let kind = null, who = null;
        if (!F.tax && funds >= 100 && (tr < 250 || nonBelievers(w) >= all.length * 0.3 || funds > tr * 0.4)) { kind = 'faith_tax'; who = all.filter(a => !F.of[a.agentId]?.rel || has(a, 'greedy')).sort((x, y) => (y.job?.key === 'mayor' ? 1 : 0) - (x.job?.key === 'mayor' ? 1 : 0))[0]; }
        else if (F.tax && d - (F.taxDay || 0) >= 30) { kind = 'faith_untax'; who = all.find(a => a.job?.key === 'priest' && F.of[a.agentId]?.rel) || all.filter(a => pietyOf(w, a) >= 70)[0]; }
        if (!kind || !who) return; F.lastTaxProp = d;
        const cand = { kind, key: kind + ':' + d, jobs: [], make: () => kind === 'faith_tax'
            ? { kind, key: kind + ':' + d, tk: '宗教捐獻課稅 {n}%', tp: { n: Math.round(TAX_RATE * 100) }, dk: '{who}說各教團存了 {f} 銀幣卻一毛稅都不繳，公庫只剩 {s}。提議捐給宗教的錢抽 {n}% 進公庫。', dp: { who: who.name, f: Math.round(funds), s: Math.round(tr), n: Math.round(TAX_RATE * 100) }, cost: {}, category: 'economy' }
            : { kind, key: kind + ':' + d, tk: '取消宗教捐獻稅', tp: {}, dk: '{who}說信徒的奉獻是給神的，不該被公庫抽成，提議取消宗教捐獻稅。', dp: { who: who.name }, cost: {}, category: 'economy' } };
        return P._createWith(w, d, cand, who);
    }
    // 投票:虔誠的信徒反對課稅、支持取消;不信教的人與看重財富的人相反;公庫越窮越多人贊成課稅
    function taxVote(w, p, a) {
        const F = S(w), rel = F.of[a.agentId]?.rel, pi = rel ? pietyOf(w, a) : 0; const tr = w.stockpile?.get?.('silver') || 0;
        let s = rel ? -(pi / 25) : 1.5; if (has(a, 'greedy')) s += 0.8; if (tr < 60) s += 0.8; if (a.job?.key === 'priest') s -= 3; s += (Math.random() - 0.5) * 1.5;
        if (p.kind === 'faith_untax') s = -s;
        return { v: s > 0 ? 'for' : 'against', why: rel && pi >= 40 ? 'faith' : 'purse' };
    }
    function setTax(w, on) { const F = S(w); F.tax = !!on; F.taxDay = day(w); return on ? tplf('宗教捐獻開始抽 {n}% 稅', { n: Math.round(TAX_RATE * 100) }) : t('宗教捐獻稅取消了'); }
    const tplf = (k, p) => t(k).replace(/\{(\w+)\}/g, (m, x) => p[x] ?? m);
    function brief(w, a) { const R = relOf(w, a); if (!R) return a && w.faith ? t('信仰：沒有信仰') : ''; const p = pietyOf(w, a); return `${t('信仰')}${t('：')}${N(R.name)}${t('（')}${N([SK[R.sk].zh, SK[R.sk].en])}${t('，')}${t('虔誠')} ${p}/100${t('）')}`; }
    function townBrief(w) { const F = w.faith; if (!F) return ''; return `${t('宗教')}${t('：')}${F.rels.map(R => `${N(R.name)}${t('（')}${believers(w, R).length}${t('人')}${t('）')}`).join(t('、'))}`; }
    function chip(w, a) { const R = relOf(w, a); if (!R) return w.faith ? `🚫 ${t('沒有信仰')}` : ''; const p = pietyOf(w, a); return `${SK[R.sk].icon} ${N(R.name)} · ${t(p >= 70 ? '虔誠' : p >= 40 ? '一般' : '淡薄')}`; }
    function view(w) {
        const F = S(w);
        return F.rels.map(R => ({ id: R.id, icon: SK[R.sk].icon, name: N(R.name), sk: N([SK[R.sk].zh, SK[R.sk].en]), deity: N(R.deity), book: N(R.book), fest: N(R.fest), festWhen: `${t(['春季', '夏季', '秋季', '冬季'][R.festSeason])} ${t('第')} ${R.festDay} ${t('天')}`, place: N(placeOf(w, R)), pre: (R.pre || []).map(N), color: R.color, n: believers(w, R).length, fund: Math.round(R.fund || 0), spent: Math.round((R.upkeep || 0) + (R.feasts || 0) + (R.relief || 0) + (R.built || 0)) }))
            .concat([]);
    }
    const nonBelievers = (w) => npcs(w).filter(a => !S(w).of[a.agentId]?.rel).length;
    return { S, SK, KEYS, daily, setTax, taxVote, TAX_RATE, onCard, relOf, pietyOf, brief, townBrief, chip, view, nonBelievers, makeReligion, rng, hash, bumpP, placeOf, believers, giftInfo, donate, embezzleInfo, embezzleBy, prayInfo, prayBy, preachInfo, preachBy, convertInfo, convertBy };
})();
if (typeof PROPOSAL_KINDS !== 'undefined') { PROPOSAL_KINDS.faith_tax = { icon: '⛪', label: '宗教稅' }; PROPOSAL_KINDS.faith_untax = { icon: '⛪', label: '宗教稅' }; }
if (typeof VOTE_WHY !== 'undefined') { VOTE_WHY.faith = VOTE_WHY.faith || '信仰的立場'; VOTE_WHY.purse = VOTE_WHY.purse || '看自己的荷包'; }
if (typeof EventCardSystem !== 'undefined') {
    const _play = EventCardSystem.prototype.play;
    EventCardSystem.prototype.play = function (w, id, ...rest) { const r = _play.call(this, w, id, ...rest); try { if (r && r.ok !== false && w.observerMode) FAITH.onCard(w, this.card(id)); } catch (e) { console.warn('[Faith] card', e); } return r; };
}
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) FAITH.daily(w); } catch (e) { console.warn('[Faith] daily', e); } return r; };
    const _rv = PS._ruleVote; // v7.0.0 宗教課稅提案的投票
    PS._ruleVote = function (w, p, a, ...rest) { if ((p.kind === 'faith_tax' || p.kind === 'faith_untax') && w.faith) { const r = FAITH.taxVote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
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
