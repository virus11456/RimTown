// RimTown - sim-decide-crowd.js：v9.27.0 決策核心批次 E（信仰與群眾行動）
// 以前：日子難過的信徒每天 25% 機率祈禱；很虔誠的人每天 2～6% 機率去勸朋友改宗、被勸的人照「抗拒程度」擲骰；
//       討厭鎮上某樣新東西的人每天照「看法強度」擲骰，骰到了可能去勸常去的家人朋友、也可能帶頭抗議；有人號召抗議時每個人擲骰決定跟不跟、
//       支持的人 30% 機率到場聲援；朋友被新東西害慘了 25% 機率有人拿錢給他；出了怪事純人派 60% 機率連夜搜捕；
//       國王失了民心時每天 20% 機率有人起意政變、被拉的人每天 25% 機率加入；提案被大比數否決後 15% 機率嘴硬、50% 機率朋友出面給台階。
// 現在：這些事由本人決定。能動念頭的還是同一批人（各系統說「他現在做得到哪幾件事」），做不做是他自己選：
//   日子難過(pray)                      靠自己想辦法／向神祈求
//   要不要勸朋友信教(preach)             不去勸／去勸某個朋友
//   朋友勸你改信(convert)               不改／改信                          ← 由朋友來勸那一刻引發
//   鎮上有你看不慣的東西(thing)          不特別做什麼／去勸常去的自己人別去／貼告示號召大家抗議   ← 去用、推薦、抱怨是日常閒聊，維持原樣
//   有人號召抗議(rally)                 不去／跟著去抗議（或到場聲援）        ← 由貼告示那一刻引發，隔天才集合
//   朋友被害慘了(rescue)                現在幫不上／拿錢拉他一把
//   要不要帶隊搜捕(hunt)                沒有證據不抓人／帶隊連夜搜捕          ← 由出事那一刻引發；抓到誰、抓得對不對仍然是運氣
//   國王失了民心(plot)                  按兵不動／開始密謀
//   有人拉你推翻國王(joinplot)           不加入／加入
//   提案被大比數否決(rejected)           不多說什麼／說自己只是隨口提提        ← 由否決那一刻引發
//   朋友的提案被否決(step)              不特別去說什麼／去給他一個台階下      ← 由否決那一刻引發
// 結算全部在原本的系統裡（sim-faith.js、sim-things.js、sim-myth2.js、sim-crown.js、sim-ways.js），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數：用 tilt() 把「以前大概多常發生」換成起跑分數，再加上個性、交情與處境。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const names = (list) => list.map(o => o.name).join(t('、'));
    const FA = () => (typeof FAITH !== 'undefined' ? FAITH : null);
    const TH = () => (typeof THINGS !== 'undefined' ? THINGS : null);
    const MS = () => (typeof MYTHSOC !== 'undefined' ? MYTHSOC : null);
    const CR = () => (typeof CROWN !== 'undefined' ? CROWN : null);
    const WY = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    const on = (w) => { try { return !!DECIDE.on?.(w); } catch (e) { return false; } };
    const safe = (f) => { try { return f() || null; } catch (e) { return null; } };
    // 兩個選項、當天心情起伏 ±0.9 時，起跑分數差多少會讓這個選項大約有 P 的機會被選中
    const tilt = (P) => { P = clampN(P, 0.004, 0.996); return P <= 0.5 ? Math.sqrt(6.48 * P) - 1.8 : 1.8 - Math.sqrt(6.48 * (1 - P)); };
    const within = (p, days) => 1 - Math.pow(1 - p, days); // 每天 p 的事，幾天內至少發生一次的機會
    const REF = 1; // 「不做」這個選項的起跑分數
    DECIDE.crowd = true; // 其他系統看到這個，就知道祈禱、傳教、抗議、政變這些事交給本人決定、不擲骰

    // ================= 日子難過：要不要祈禱 =================
    const PWHY = { hungry: '家裡快斷糧了。', sick: '你的身體很差。', poor: '你身上幾乎沒有錢。', low: '你最近心情很低落。' };
    const prayInfo = (w, a) => (on(w) ? safe(() => FA()?.prayInfo?.(w, a)) : null);
    DECIDE.kind('pray', {
        title: '日子難過', cool: 3, pri: 0.6,
        when(w, a) { const I = prayInfo(w, a); return I ? { why: I.why } : null; },
        facts(w, a) {
            const I = prayInfo(w, a); if (!I) return '';
            return fill('{why}你信{r}（虔誠度 {p}／100）。向{g}祈求不花什麼，只是把心事交出去；會不會應驗沒有人知道。', { why: PWHY[I.why] || '', r: I.R.name[0], p: I.piety, g: I.R.deity[0] });
        },
        options(w, a) {
            const I = prayInfo(w, a); if (!I) return []; const g = I.R.deity[0];
            return [
                { id: 'skip', quiet: true, mute: true, text: '不祈禱，靠自己想辦法', say: '沒有祈禱', why: '求神不如求自己', base: REF, run: () => null },
                { id: 'pray', quiet: true, text: { k: '向{g}祈求：{wish}', p: { g, wish: I.wish } }, say: { k: '向{g}祈禱', p: { g } }, why: { k: '日子難過的時候，至少還有{g}可以說', p: { g } },
                    base: REF + tilt(within(0.25, 3)) + clampN((I.piety - 60) / 100, -0.2, 0.3), lean: { safe: 0.2, gain: -0.2 },
                    run: (w2, a2) => (FA().prayBy(w2, a2) ? { k: '把心事交給了{g}', p: { g } } : { k: '沒有祈禱成' }) },
            ];
        },
    });

    // ================= 要不要勸朋友信教 =================
    const preachInfo = (w, a) => (on(w) ? safe(() => FA()?.preachInfo?.(w, a)) : null);
    DECIDE.kind('preach', {
        title: '要不要勸朋友信教', cool: 10, pri: 0.5,
        when(w, a) { const I = preachInfo(w, a); return I ? { n: I.friends.length } : null; },
        facts(w, a) {
            const I = preachInfo(w, a); if (!I) return '';
            return fill('你很信{r}。{o}跟你交情不錯，信的卻不是{r}。去勸他，他可能改信，也可能嫌你煩；他要是改信了，他家裡信別的神的人會跟他吵。', { r: I.R.name[0], o: { raw: names(I.friends) } });
        },
        options(w, a) {
            const I = preachInfo(w, a); if (!I) return []; const r = I.R.name[0]; const P = within(I.zeal, 10);
            const out = [{ id: 'no', quiet: true, mute: true, text: '不去勸，各人信各人的', say: '沒有去勸朋友信教', why: '信不信是他自己的事', base: REF, lean: { safe: 0.1 }, run: () => null }];
            for (const o of I.friends) out.push({ id: 'go:' + o.agentId, quiet: true, text: { k: '去勸{o}信{r}', p: { o: o.name, r } }, say: { k: '去勸{o}信{r}', p: { o: o.name, r } }, why: '好東西要讓好朋友也知道',
                base: REF + tilt(P) + 0.15 - (I.friends.length > 1 ? 0.3 : 0) + (has(a, 'charismatic') ? 0.15 : 0) - (has(a, 'shy') ? 0.3 : 0), lean: { bond: 0.2, safe: -0.2 },
                run: (w2, a2) => (FA().preachBy(w2, a2, o.agentId) ? { k: '去找{o}談了', p: { o: o.name } } : { k: '沒有去成' }) });
            return out;
        },
    });

    // ================= 朋友勸你改信（由朋友來勸那一刻引發） =================
    const convInfo = (w, a, c) => (on(w) ? safe(() => FA()?.convertInfo?.(w, a, c)) : null);
    DECIDE.kind('convert', {
        title: '朋友勸你改信', scan: false, pri: 1.5,
        when() { return null; },
        facts(w, a, c) {
            const I = convInfo(w, a, c); if (!I) return '';
            return fill('你的好朋友{a}來勸你信{r}。{cur}{fam}', { a: I.a.name, r: I.R.name[0],
                cur: I.oldR ? { k: '你現在信{o}（虔誠度 {p}／100）。', p: { o: I.oldR.name[0], p: I.piety } } : '你現在什麼都不信。',
                fam: I.oldR ? { k: '改信的話，家裡還很信{o}的人會跟你吵。', p: { o: I.oldR.name[0] } } : { raw: '' } });
        },
        options(w, a, c) {
            const I = convInfo(w, a, c); if (!I) return []; const r = I.R.name[0];
            return [
                { id: 'no', quiet: true, mute: true, text: '不改，謝謝他的好意', say: { k: '沒有聽{a}的勸改信', p: { a: I.a.name } }, why: '我有我自己信的', base: REF,
                    run: (w2, a2) => { FA().convertBy(w2, a2, c, false); return null; } },
                { id: 'yes', quiet: true, text: { k: '改信{r}', p: { r } }, say: { k: '改信了{r}', p: { r } }, why: { k: '{a}說的有道理，我想試試', p: { a: I.a.name } },
                    base: REF + tilt(I.p) + 0.3 + clampN((aff(a, I.a) - 40) / 200, -0.1, 0.25), lean: { bond: 0.2, safe: -0.2 },
                    run: (w2, a2) => (FA().convertBy(w2, a2, c, true) ? { k: '開始信{r}了', p: { r } } : { k: '沒有改成' }) },
            ];
        },
    });

    // ================= 鎮上有你看不慣的東西 =================
    // 去用、跟朋友推薦、跟朋友抱怨是日常閒聊（城市裡一天好幾次），維持原樣；這裡只問兩件有後果的事：勸常去的自己人別去、帶頭號召抗議
    const actInfo = (w, a) => (on(w) ? safe(() => TH()?.actInfo?.(w, a)) : null);
    DECIDE.kind('thing', {
        title: '鎮上有你看不慣的東西', cool: 5, pri: 1.0,
        when(w, a) { const I = actInfo(w, a); return I ? { tid: I.T.id } : null; },
        facts(w, a) {
            const I = actInfo(w, a); if (!I) return '';
            const L = [fill('鎮上的{t}，你{f}。鎮上喜歡它的有 {p} 人、不喜歡的有 {c} 人。', { t: { raw: I.name }, f: I.v <= -60 ? '很討厭' : '不太喜歡', p: I.pro, c: I.con })];
            if (I.owner) L.push(fill('它是{o}的。', { o: I.owner.name }));
            if (I.victim) L.push(t('你自己就被它害過。'));
            if (I.acts.includes('persuade')) L.push(fill('{o}常往那裡跑。你可以去勸：勸得動，他會答應不再去；勸不動，你們會大吵一架。', { o: { raw: names(I.who) } }));
            if (I.acts.includes('protest')) L.push(t('你也可以貼告示號召大家去抗議：隔天到場三個人以上才成；帶頭和到場的人會被老闆記恨。'));
            return L.join('');
        },
        options(w, a) {
            const T = TH(); const I = actInfo(w, a); if (!I) return []; const nm = { raw: I.name }; const hasP = I.acts.includes('protest'), hasQ = I.acts.includes('persuade');
            const run = (act) => (w2, a2) => (T.actBy(w2, a2, I.T.id, act) ? null : { k: '沒有做成' });
            const out = [{ id: 'quiet', quiet: true, mute: true, text: '不特別做什麼', say: { k: '對{t}沒有特別做什麼', p: { t: nm } }, why: '各過各的日子', base: REF, run: () => null }];
            // 以前：討厭的人每天照看法強度擲骰，骰到了有三成五（夠格時）去抗議、其餘一半去勸人
            if (hasQ) out.push({ id: 'persuade', quiet: true, text: { k: '去勸{o}別再去', p: { o: { raw: names(I.who) } } }, say: { k: '打算勸自己人別再去{t}', p: { t: nm } }, why: '不能看著自己人陷進去',
                base: REF + tilt(within(I.p * (hasP ? 0.325 : 0.5), 5)) + (has(a, 'kind') ? 0.2 : 0) + (I.victim ? 0.2 : 0), lean: { bond: 0.3, safe: -0.3 }, run: run('persuade') });
            if (hasP) out.push({ id: 'protest', quiet: true, text: '貼告示號召大家去抗議', say: { k: '打算號召大家去抗議{t}', p: { t: nm } }, why: '光抱怨沒有用，要讓大家看見',
                base: REF + tilt(within(I.p * 0.35, 5)) + (has(a, 'charismatic') ? 0.2 : 0) + (has(a, 'abrasive') ? 0.2 : 0) - (has(a, 'shy') ? 0.4 : 0) + (I.victim ? 0.3 : 0), lean: { face: 0.2, safe: -0.3 }, run: run('protest') });
            return out;
        },
    });

    // ================= 有人號召抗議（由貼告示那一刻引發；隔天才集合） =================
    const rallyInfo = (w, a, c) => (on(w) ? safe(() => TH()?.rallyInfo?.(w, a, c)) : null);
    DECIDE.kind('rally', {
        title: '有人號召抗議', scan: false, pri: 1.6,
        when() { return null; },
        facts(w, a, c) {
            const I = rallyInfo(w, a, c); if (!I) return '';
            return I.side === 'con'
                ? fill('{o}在公告欄貼了告示，號召大家明天去抗議{t}，目前有 {n} 個人要去。你也不喜歡{t}。到場三個人以上才成得了事；去的人會被老闆記恨。', { o: I.org.name, t: { raw: I.name }, n: I.n })
                : fill('{o}號召大家明天去抗議{t}，目前有 {n} 個人要去。你很喜歡{t}。{own}你可以到場替它說話；支持的人到了三個以上，兩邊會隔著街對喊，你跟抗議的人交情會變差。', { o: I.org.name, t: { raw: I.name }, n: I.n, own: I.owner ? { k: '它是{o}的。', p: { o: I.owner.name } } : { raw: '' } });
        },
        options(w, a, c) {
            const T = TH(); const I = rallyInfo(w, a, c); if (!I) return []; const nm = { raw: I.name }; const con = I.side === 'con';
            return [
                { id: 'stay', quiet: true, mute: true, text: '不去', say: { k: '沒有去{t}門口', p: { t: nm } }, why: '這種場合我不想露面', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'join', quiet: true, text: con ? '明天跟著去抗議' : '明天到場替它說話', say: { k: con ? '答應明天去抗議{t}' : '答應明天去聲援{t}', p: { t: nm } },
                    why: con ? { k: '{o}都站出來了，我不能躲在後面', p: { o: I.org.name } } : '喜歡的東西被人這樣說，我看不下去',
                    base: REF + tilt(I.p) + (con ? 0 : 0.25), lean: con ? { bond: 0.2, safe: -0.2 } : { face: 0.2, safe: -0.2 },
                    run: (w2, a2) => (T.rallyBy(w2, a2, c) ? { k: '明天會到場' } : { k: '來不及了' }) },
            ];
        },
    });

    // ================= 朋友被害慘了 =================
    const rescueInfo = (w, a) => (on(w) ? safe(() => TH()?.rescueInfo?.(w, a)) : null);
    DECIDE.kind('rescue', {
        title: '朋友被害慘了', cool: 4, pri: 0.8,
        when(w, a) { const I = rescueInfo(w, a); return I ? { v: I.a.agentId } : null; },
        facts(w, a) {
            const I = rescueInfo(w, a); if (!I) return '';
            return fill('{a}被{t}害慘了，日子快過不下去。你們交情不錯，你身上有 {c} 銀幣。拿 {n} 銀幣給他，他會記你這份情，也會答應不再碰{t}。', { a: I.a.name, t: { raw: I.name }, c: I.cash, n: I.n });
        },
        options(w, a) {
            const T = TH(); const I = rescueInfo(w, a); if (!I) return [];
            return [
                { id: 'wait', quiet: true, mute: true, text: '現在幫不上', say: { k: '沒有拿錢給{a}', p: { a: I.a.name } }, why: '我自己手頭也不寬', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'give', quiet: true, text: { k: '拿 {n} 銀幣給他', p: { n: I.n } }, say: { k: '拿了 {n} 銀幣拉{a}一把', p: { n: I.n, a: I.a.name } }, why: '他最落魄的時候，我不能裝作沒看見',
                    base: REF + tilt(clampN(within(0.25, 4) / (1 + I.others * 0.5), 0.25, 0.68)) + (has(a, 'kind') ? 0.2 : 0) + (has(a, 'generous') ? 0.2 : 0) - (has(a, 'greedy') ? 0.4 : 0) + clampN((aff(a, I.a) - 50) / 150, -0.15, 0.3), lean: { bond: 0.3, gain: -0.3 },
                    run: (w2, a2) => { const n = T.rescueBy(w2, a2, I.a.agentId); return n ? { k: '給了 {n} 銀幣', p: { n } } : { k: '沒有給成' }; } },
            ];
        },
    });

    // ================= 要不要帶隊搜捕（由出事那一刻引發） =================
    const KN = { wolf: '狼人', night: '吸血鬼' };
    const huntInfo = (w, a, c) => (on(w) ? safe(() => MS()?.huntInfo?.(w, a, c)) : null);
    DECIDE.kind('hunt', {
        title: '要不要帶隊搜捕', scan: false, pri: 2,
        when() { return null; },
        facts(w, a, c) {
            const I = huntInfo(w, a, c); if (!I) return '';
            return fill('昨晚又出事了，傷人的是{k}，沒有人知道是誰。你是純人派帶頭的，可以帶 {n} 個人連夜搜捕。抓對了大家會說你們立了大功；抓錯了，過幾天真相大白，被冤枉的人會要你負責。{r}到現在獵人隊抓對 {c} 次、抓錯 {x} 次。',
                { k: KN[I.kind] || '怪物', n: I.n, r: I.rights ? '平權令禁止私刑，抓到的人只能交給守衛問話。' : '抓到的人會被拖出來痛打。', c: I.caught, x: I.wrongful });
        },
        options(w, a, c) {
            const I = huntInfo(w, a, c); if (!I) return []; const k = KN[I.kind] || '怪物';
            return [
                { id: 'hold', quiet: true, mute: true, text: '先不動手，沒有證據不抓人', say: '沒有帶隊搜捕', why: '抓錯人的話，我們跟怪物有什麼兩樣', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'hunt', quiet: true, text: '帶隊連夜搜捕', say: { k: '帶隊搜捕{k}', p: { k } }, why: '再不動手，下一個受害的就是我們的家人',
                    base: REF + tilt(0.6) + (has(a, 'abrasive') ? 0.2 : 0) + (has(a, 'neurotic') ? 0.15 : 0) - (has(a, 'kind') ? 0.4 : 0) - Math.min(0.45, I.wrongful * 0.15), lean: { face: 0.2, bond: -0.2 },
                    run: (w2, a2) => { const h = MS().huntBy(w2, a2, c); const s = h ? w2.agents[h.sus] : null; return s ? { k: '抓了{s}', p: { s: s.name } } : { k: '沒有成行' }; } },
            ];
        },
    });

    // ================= 國王失了民心 =================
    const plotInfo = (w, a) => (on(w) ? safe(() => CR()?.plotInfo?.(w, a)) : null);
    DECIDE.kind('plot', {
        title: '國王失了民心', cool: 4, pri: 1.2,
        when(w, a) { const I = plotInfo(w, a); return I ? { l: I.legit } : null; },
        facts(w, a) {
            const I = plotInfo(w, a); if (!I) return '';
            return fill('國王{k}的民心只剩 {l}／100。你在鎮上聲望不低，跟他又處不來。現在動手的話，可以暗中聯絡信得過的人，準備六到十天後衝進王宮：人越多、他的民心越低，越容易成。失敗或被忠臣識破，你會丟掉職位、被審判。', { k: I.k.name, l: I.legit });
        },
        options(w, a) {
            const I = plotInfo(w, a); if (!I) return [];
            return [
                { id: 'wait', quiet: true, mute: true, text: '按兵不動', say: '沒有動推翻國王的念頭', why: '時機還沒到，輸了就什麼都沒了', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'plot', quiet: true, text: '開始暗中聯絡人，準備推翻國王', say: '開始密謀推翻國王', why: '他已經失了民心，是時候了',
                    base: REF + tilt(within(0.2, 4)) + (has(a, 'ambitious') ? 0.3 : 0) + clampN((25 - I.legit) / 100, -0.1, 0.25) + clampN(-aff(a, I.k) / 200, -0.1, 0.3), lean: { face: 0.3, safe: -0.3 },
                    run: (w2, a2) => (CR().plotBy(w2, a2) ? { k: '開始聯絡信得過的人' } : { k: '沒有動手' }) },
            ];
        },
    });

    // ================= 有人拉你推翻國王 =================
    const joinInfo = (w, a) => (on(w) ? safe(() => CR()?.joinInfo?.(w, a)) : null);
    DECIDE.kind('joinplot', {
        title: '有人拉你推翻國王', cool: 5, pri: 1.8,
        when(w, a) { const I = joinInfo(w, a); return I ? { l: I.L.agentId } : null; },
        facts(w, a) {
            const I = joinInfo(w, a); if (!I) return '';
            return fill('{l}私下找你，說要推翻國王{k}：已經有 {n} 個人，大概 {d} 天後動手。你跟{l}交情不錯，也看國王不順眼（他的民心只剩 {g}／100）。加入的話，成了你是功臣；敗了同謀全數落網。', { l: I.L.name, k: I.k.name, n: I.n, d: I.left, g: I.legit });
        },
        options(w, a) {
            const I = joinInfo(w, a); if (!I) return [];
            return [
                { id: 'refuse', quiet: true, mute: true, text: '不加入，也不說出去', say: { k: '沒有加入{l}的計畫', p: { l: I.L.name } }, why: '這是掉腦袋的事', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'join', quiet: true, text: '加入', say: { k: '加入了{l}推翻國王的計畫', p: { l: I.L.name } }, why: '這個國王早該換了',
                    base: REF + tilt(0.6) + 0.1 + clampN((aff(a, I.L) - 40) / 200, -0.1, 0.25) + clampN(-aff(a, I.k) / 200, 0, 0.3), lean: { face: 0.2, safe: -0.3 },
                    run: (w2, a2) => (CR().joinBy(w2, a2) ? { k: '答應了{l}', p: { l: I.L.name } } : { k: '沒有加入成' }) },
            ];
        },
    });

    // ================= 提案被大比數否決（由否決那一刻引發） =================
    const casInfo = (w, a, c) => (on(w) ? safe(() => WY()?.casualInfo?.(w, a, c)) : null);
    DECIDE.kind('rejected', {
        title: '提案被大比數否決', scan: false, pri: 1.5,
        when() { return null; },
        facts(w, a, c) { const I = casInfo(w, a, c); return I ? fill('你提的「{t}」被大比數否決了，很沒面子（你現在的面子 {f}／100）。', { t: { raw: I.t }, f: I.face }) : ''; },
        options(w, a, c) {
            const I = casInfo(w, a, c); if (!I) return [];
            return [
                { id: 'quiet', quiet: true, mute: true, text: '不多說什麼', say: '提案被否決，沒有多說什麼', why: '輸了就輸了，多說只會更難看', base: REF, lean: { safe: 0.1 }, run: () => null },
                { id: 'casual', quiet: true, text: '逢人就說「我本來就只是隨口提提」', say: '跟大家說自己只是隨口提提', why: '面子總要顧一下',
                    base: REF + tilt(0.15) + (has(a, 'charismatic') || has(a, 'jealous') ? 0.2 : 0) - (has(a, 'stoic') ? 0.3 : 0) + clampN((40 - I.face) / 100, -0.1, 0.2), lean: { face: 0.3, safe: -0.3 },
                    run: (w2, a2) => (WY().casualBy(w2, a2, c) ? { k: '逢人就這麼說' } : { k: '沒有說出口' }) },
            ];
        },
    });

    // ================= 朋友的提案被否決（由否決那一刻引發） =================
    const stepInfo = (w, a, c) => (on(w) ? safe(() => WY()?.stepInfo?.(w, a, c)) : null);
    DECIDE.kind('step', {
        title: '朋友的提案被否決', scan: false, pri: 1.5,
        when() { return null; },
        facts(w, a, c) { const I = stepInfo(w, a, c); return I ? fill('{a}提的「{t}」被大比數否決了，他很沒面子。你們交情很好。你出面跟他說幾句話，他會好過一點，也會記得這份情。', { a: I.a.name, t: { raw: I.t } }) : ''; },
        options(w, a, c) {
            const I = stepInfo(w, a, c); if (!I) return [];
            return [
                { id: 'stay', quiet: true, mute: true, text: '不特別去說什麼', say: { k: '沒有去找{a}', p: { a: I.a.name } }, why: '這時候說什麼都不對', base: REF, run: () => null },
                { id: 'step', quiet: true, text: '去跟他說「這次是時機不對，不是你的問題」', say: { k: '去給{a}一個台階下', p: { a: I.a.name } }, why: '朋友丟了面子，總要有人說句話',
                    base: REF + tilt(0.5) + (has(a, 'kind') ? 0.2 : 0) - (has(a, 'shy') ? 0.2 : 0) + clampN((aff(a, I.a) - 50) / 150, -0.2, 0.3), lean: { bond: 0.3, safe: -0.3 },
                    run: (w2, a2) => (WY().stepBy(w2, a2, c) ? { k: '{a}好過了一點', p: { a: I.a.name } } : { k: '沒有說成' }) },
            ];
        },
    });
})();
