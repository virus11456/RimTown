// RimTown - sim-decide-share.js：v9.24.0 決策核心批次 B（股份與借貸）
// 以前：當家要不要買斷處不來的股東、要不要在帳上動手腳、誰帶頭合股買公營產業、哪個工人認股、屋主要不要拿房子抵押、
//       擠兌時誰去領錢、誰買銀行債券，都是各系統擲骰決定的
//       （例如「當家和股東翻臉，每週 50% 機率買斷」「擠兌時每個存戶每天 60% 機率把錢領光」）。
// 現在：這些事由本人決定。各系統只說「他現在遇到什麼事、做得到哪幾件事」和「做了之後怎麼結算」：
//   合夥的股東處不來(buyout)          先忍著／出錢買斷
//   這週的帳要不要少報一點(cook)       照實分紅／帳上動手腳              ← 決定了，下次分紅才生效
//   要不要帶頭合股買下公營產業(syndicate)  不出這個頭／帶頭
//   要不要認購自家店的股份(staffshare)   錢留著／認購 5%
//   手頭很緊(pinch) 多一個選項         拿自己的房子去銀行抵押
//   銀行在擠兌(bankrun)              不領／領一半／全部領出來
//   銀行在賣債券(bond)               不買／買
// 結算全部在原本的系統裡（sim-shares.js、sim-bank.js、sim-estate.js），這裡不動任何數字。
// AI 開著由 AI 依帳本選（也可以選「其他」）；AI 不在時算每個選項的傾向分數（個性、處境、交情），不是固定機率。
// 必須在 sim-decide.js 之後載入。
'use strict';

(() => {
    if (typeof DECIDE === 'undefined') return;
    const has = (a, tr) => (a?.personality?.traits || []).includes(tr);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const aff = (a, b) => (a && b ? a.relationships?.relationships?.[b.agentId]?.affinity || 0 : 0);
    const cash = (w, a) => (typeof WALLET !== 'undefined' && w.wallet ? WALLET.get(w, a) : 0);
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : x));
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const amb = (w, a) => w.mind?.amb?.[a.agentId]?.key || '';
    const tie = (a, b) => { const v = aff(a, b); return v >= 40 ? '交情很好' : v >= 10 ? '還算熟' : v > -10 ? '沒什麼交情' : '處不來'; };
    const MK = () => (typeof MARKET !== 'undefined' ? MARKET : null);
    const SH = () => (typeof SHARES !== 'undefined' ? SHARES : null);
    const BK = () => (typeof BANK !== 'undefined' ? BANK : null);
    const ES = () => (typeof ESTATE !== 'undefined' ? ESTATE : null);
    const sName = (k) => { try { return MK().name(k); } catch (e) { return k; } };
    DECIDE.share = true; // 其他系統看到這個，就知道股份與借貸的事交給本人決定、不擲骰

    // ================= 股份 =================
    // ---------- 合夥的股東處不來：要不要出錢買斷 ----------
    const buyoutInfo = (w, a) => { const S = SH(); return S && w.market && DECIDE.on(w) ? S.buyoutInfo(w, a) : null; };
    DECIDE.kind('buyout', {
        title: '合夥的股東處不來', cool: 7, pri: 1.2,
        when(w, a) { const I = buyoutInfo(w, a); return I ? { k: I.k, o: I.o.agentId } : null; },
        facts(w, a, ctx) {
            const I = buyoutInfo(w, a); if (!I || I.k !== ctx.k || I.o.agentId !== ctx.o) return '';
            return fill('你是{s}的當家，{o}手上有 {p}% 的股份，每週都要分紅給他，可是你們兩個處不來。照行情買斷他的股份要 {n} 銀幣；你身上有 {c} 銀幣。買斷以後這家店不用再看他臉色，你們大概也不會再往來。',
                { s: sName(I.k), o: I.o.name, p: I.pct, n: I.price, c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const S = SH(); const I = buyoutInfo(w, a); if (!I || I.k !== ctx.k || I.o.agentId !== ctx.o) return []; const o = I.o; const tight = cash(w, a) - I.price < 20;
            return [
                { id: 'bear', quiet: true, mute: true, text: '先忍著，繼續合夥', why: '撕破臉對生意沒有好處', base: 1.2 + (has(a, 'kind') ? 0.3 : 0) + (tight ? 0.4 : 0), lean: { safe: 0.3, bond: 0.2 }, run: () => null },
                { id: 'buy', text: { k: '出 {n} 銀幣買斷{o}手上的股份', p: { n: I.price, o: o.name } }, say: { k: '買斷{o}在{s}的股份', p: { o: o.name, s: sName(I.k) } }, why: '合不來的人，早點分清楚',
                    base: 1.2 + (has(a, 'abrasive') ? 0.3 : 0) + (has(a, 'stubborn') ? 0.2 : 0) + clampN(-aff(a, o) / 60, 0, 1) * 0.4, lean: { face: 0.3, gain: 0.1 },
                    run: (w, a) => (S.buyoutBy(w, a, I.k, o.agentId) ? { k: '買斷了，從此各走各的' } : { k: '後來沒談成' }) },
            ];
        },
    });

    // ---------- 這週的帳要不要少報一點 ----------
    const cookInfo = (w, a) => { const S = SH(); return S && w.market && DECIDE.on(w) ? S.cookInfo(w, a) : null; };
    DECIDE.kind('cook', {
        title: '這週的帳要不要少報一點', cool: 7, pri: 1,
        when(w, a) { const I = cookInfo(w, a); return I ? { k: I.k } : null; },
        facts(w, a, ctx) {
            const I = cookInfo(w, a); if (!I || I.k !== ctx.k) return '';
            return fill('你是{s}的當家，這一週大約賺了 {x} 銀幣，照規矩要拿出 {pool} 銀幣依持股分給 {n} 位股東。帳是你在記的：少報一些，自己可以多留 {keep} 銀幣左右。{audit}被抓到要把錢吐出來、名聲掃地，股東也可能聯手把你趕下當家的位子。你身上有 {c} 銀幣。',
                { s: sName(I.k), x: Math.round(I.profit), pool: Math.round(I.pool), n: I.others, keep: Math.round(I.keep), audit: I.audit ? '鎮上已經規定各產業的帳本要公開，很容易被查到。' : '細心的股東有時候會翻帳本。', c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const S = SH(); const I = cookInfo(w, a); if (!I || I.k !== ctx.k) return [];
            return [
                { id: 'honest', quiet: true, mute: true, text: '照實分紅', why: '錢要賺得心安', base: 1.6 + (I.audit ? 1.0 : 0) + (has(a, 'kind') ? 0.4 : 0) + (has(a, 'perfectionist') ? 0.3 : 0), lean: { safe: 0.4, bond: 0.3 }, run: () => null },
                { id: 'cook', quiet: true, text: '帳上少報一點，自己多留一些', say: { k: '在{s}的帳上動手腳', p: { s: sName(I.k) } }, why: '店是我在顧的，他們又不出力',
                    base: 1.3 + (has(a, 'greedy') ? 0.5 : 0) + (a?.dark?.liar ? 0.4 : 0) + (cash(w, a) < 20 ? 0.4 : 0), lean: { gain: 0.6, safe: -0.3 },
                    run: (w, a) => (S.cookBy(w, a, I.k) ? { k: '這週的帳會少報一些' } : null) },
            ];
        },
    });

    // ---------- 要不要帶頭合股買下公營產業 ----------
    const synInfo = (w, a) => { const S = SH(); return S && w.market && DECIDE.on(w) ? S.synInfo(w, a) : null; };
    DECIDE.kind('syndicate', {
        title: '要不要帶頭合股買下公營產業', cool: 7, pri: 1.3,
        when(w, a) { const I = synInfo(w, a); return I ? { k: I.k } : null; },
        facts(w, a, ctx) {
            const I = synInfo(w, a); if (!I || I.k !== ctx.k) return '';
            return fill('{s}現在是公營的，鎮公所要賣，估價 {n} 銀幣，鎮上沒有人一個人買得起。你身上有 {c} 銀幣，可以出 {m}；跟你交情好的{names}應該願意一起出錢湊足。買下來由你當家，每週賺的錢照出資比例分；生意不好的話，大家出的錢都會賠進去。',
                { s: sName(I.k), n: I.price, c: Math.floor(cash(w, a)), m: Math.round(I.mine), names: { raw: I.parts.slice(1).map(([o]) => t(o.name)).join(t('、')) } });
        },
        options(w, a, ctx) {
            const S = SH(); const I = synInfo(w, a); if (!I || I.k !== ctx.k) return []; let mine = false; try { mine = MK().JOB2S[a.job?.key] === I.k; } catch (e) {}
            return [
                { id: 'pass', quiet: true, mute: true, text: '不出這個頭', why: '把錢全押在一家店上太冒險', base: 1.4 + (has(a, 'thrifty') ? 0.3 : 0), lean: { safe: 0.5 }, run: () => null },
                { id: 'lead', text: { k: '帶頭找朋友合股，買下{s}', p: { s: sName(I.k) } }, say: { k: '帶頭合股買下{s}', p: { s: sName(I.k) } }, why: '這是難得的機會，自己當家作主',
                    base: 1.4 + (has(a, 'ambitious') ? 0.4 : 0) + (has(a, 'greedy') ? 0.2 : 0) + (amb(w, a) === 'rich' ? 0.3 : 0) + (mine ? 0.3 : 0), lean: { gain: 0.5, safe: -0.3 },
                    run: (w, a) => (S.synBy(w, a, I.k) ? { k: '湊足了錢，買下來了' } : { k: '錢沒湊齊，沒買成' }) },
            ];
        },
    });

    // ---------- 要不要認購自家店的股份 ----------
    const staffInfo = (w, a) => { const S = SH(); return S && w.market && DECIDE.on(w) ? S.staffInfo(w, a) : null; };
    DECIDE.kind('staffshare', {
        title: '要不要認購自家店的股份', cool: 14, pri: 1,
        when(w, a) { const I = staffInfo(w, a); return I ? { k: I.k } : null; },
        facts(w, a, ctx) {
            const I = staffInfo(w, a); if (!I || I.k !== ctx.k) return '';
            return fill('鎮上通過了員工認股：你在{o}的{s}做工，可以用 {n} 銀幣認購 5% 的股份，以後每週照持股分紅（這一週這家賺了 {x} 銀幣）。你身上有 {c} 銀幣。生意不好的時候沒有分紅，股份也不一定賣得回原價。',
                { o: I.boss.name, s: sName(I.k), n: I.price, x: Math.round(I.profit), c: Math.floor(cash(w, a)) });
        },
        options(w, a, ctx) {
            const S = SH(); const I = staffInfo(w, a); if (!I || I.k !== ctx.k) return [];
            return [
                { id: 'keep', quiet: true, mute: true, text: '錢留著，不買', why: '辛苦存的錢，放在身邊比較安心', base: 1.5 + (has(a, 'thrifty') ? 0.3 : 0), lean: { safe: 0.5 }, run: () => null },
                { id: 'buy', text: { k: '花 {n} 銀幣認購 5% 的股份', p: { n: I.price } }, say: { k: '認購{s} 5% 的股份', p: { s: sName(I.k) } }, why: '自己上工的店，自己也當個股東',
                    base: 1.1 + (has(a, 'hardworking') ? 0.3 : 0) + (has(a, 'ambitious') ? 0.3 : 0) + (amb(w, a) === 'rich' ? 0.3 : 0) + clampN(aff(a, I.boss) / 60, -1, 1) * 0.3 + (I.profit > 30 ? 0.3 : 0), lean: { gain: 0.5 },
                    run: (w, a) => (S.staffBy(w, a, I.k) ? { k: '成了{s}的股東', p: { s: sName(I.k) } } : { k: '後來沒買成' }) },
            ];
        },
    });

    // ================= 借貸 =================
    // ---------- 手頭很緊：名下有房子的人，多一個「拿房子去抵押」的選項 ----------
    { const K = DECIDE.KINDS.pinch;
      if (K && !K._mort) { K._mort = true; const _opts = K.options;
        K.options = function (w, a, ctx) {
            const out = _opts.call(this, w, a, ctx) || []; const E = ES(); let I = null; try { I = E && DECIDE.on(w) ? E.mortInfo(w, a) : null; } catch (e) {}
            if (I) out.push({ id: 'mortgage', text: { k: '拿自己的房子去銀行抵押，借 {n} 銀幣（20 天內還清；還不出來房子會被銀行收走）', p: { n: I.n } }, say: '拿房子去銀行抵押借錢', why: '房子還在，總比餓肚子好',
                base: 1.6, lean: { safe: -0.2, face: 0.3 }, // 有房子又手頭很緊的人，大約四次裡有一次會選抵押(沒有朋友可以開口時更常)；以前是每天四成機率直接押
                run: (w2, a2) => { const got = E.mortBy(w2, a2); return got ? { k: '抵押借到 {n} 銀幣', p: { n: got } } : { k: '銀行不肯借' }; } });
            return out;
        }; } }

    // ---------- 銀行在擠兌：存款要不要領出來 ----------
    const runInfo = (w, a) => { const B = BK(); return B && w.bank && DECIDE.on(w) ? B.runInfo(w, a) : null; };
    DECIDE.kind('bankrun', {
        title: '銀行在擠兌，存款要不要領出來', cool: 1, pri: 2.5,
        when(w, a) { const I = runInfo(w, a); return I ? { d: I.day } : null; },
        facts(w, a, ctx) {
            const I = runInfo(w, a); if (!I) return '';
            return fill('鎮上的銀行在擠兌，已經第 {d} 天，門口擠滿了要領錢的人。你在銀行存了 {n} 銀幣。銀行要是倒了，存款就拿不回來；可是大家都去領，銀行才真的會倒。{inj}{b}',
                { d: I.day + 1, n: I.dep, inj: I.injected ? '銀行家已經拿自己的錢補進去了。' : { raw: '' }, b: I.banker ? { k: '你跟銀行家{x}{tie}。', p: { x: I.banker.name, tie: tie(a, I.banker) } } : { raw: '' } });
        },
        options(w, a, ctx) {
            const B = BK(); const I = runInfo(w, a); if (!I) return []; const trust = I.banker ? aff(a, I.banker) : 0;
            return [
                { id: 'stay', quiet: true, mute: true, text: '不領，相信銀行撐得過去', say: '沒有去領存款', why: '大家都去領，銀行才真的會倒', base: 1.0 + clampN(trust / 50, -1, 1) * 0.5 + (has(a, 'stoic') ? 0.3 : 0) + (has(a, 'optimist') ? 0.3 : 0), lean: { bond: 0.3 }, run: () => null },
                { id: 'half', quiet: true, text: '先領一半出來', say: '把存款領出一半', why: '留一半、領一半，兩邊都不落空', base: 1.0, lean: { safe: 0.3 },
                    run: (w, a) => { const got = B.runBy(w, a, 0.5); return got ? { k: '領到 {n} 銀幣', p: { n: got } } : { k: '銀行已經沒錢可領' }; } },
                { id: 'all', quiet: true, text: '全部領出來', say: '把存款全部領出來', why: '錢拿在自己手上才是真的', base: 1.3 + (has(a, 'neurotic') ? 0.4 : 0) + (has(a, 'pessimist') ? 0.3 : 0) + (has(a, 'thrifty') ? 0.2 : 0) + (I.dep >= 100 ? 0.2 : 0), lean: { safe: 0.6 },
                    run: (w, a) => { const got = B.runBy(w, a, 1); return got ? { k: '領到 {n} 銀幣', p: { n: got } } : { k: '銀行已經沒錢可領' }; } },
            ];
        },
    });

    // ---------- 銀行在賣債券：要不要買 ----------
    const bondInfo = (w, a) => { const B = BK(); return B && w.bank && DECIDE.on(w) ? B.bondInfo(w, a) : null; };
    DECIDE.kind('bond', {
        title: '銀行在賣債券，要不要買', cool: 3, pri: 1.6, // 只賣兩天：排在「手上有閒錢」這類不急的事前面，才來得及問到人
        when(w, a) { const I = bondInfo(w, a); return I ? { o: I.id } : null; },
        facts(w, a, ctx) {
            const I = bondInfo(w, a); if (!I || I.id !== ctx.o) return '';
            return fill('銀行家{b}在賣債券：三十天後連本帶利還，利息 {r}%。{why}你身上有 {c} 銀幣，可以買 {n} 銀幣的。{dep}你跟{b}{tie}。銀行要是在到期前倒了，這筆錢就拿不回來。',
                { b: I.banker.name, r: Math.round(I.rate * 100), why: I.inRun ? '銀行正在擠兌，他想靠這筆錢撐過去。' : '他說是要補充銀行的準備金。', c: Math.floor(cash(w, a)), n: I.n, dep: I.dep > 0 ? { k: '你自己在銀行也存了 {m} 銀幣。', p: { m: I.dep } } : { raw: '' }, tie: tie(a, I.banker) });
        },
        options(w, a, ctx) {
            const B = BK(); const I = bondInfo(w, a); if (!I || I.id !== ctx.o) return []; const trust = aff(a, I.banker); const prudent = has(a, 'stoic') || has(a, 'hardworking') || has(a, 'perfectionist');
            return [
                { id: 'pass', quiet: true, mute: true, text: '不買', why: '錢借給銀行，誰知道拿不拿得回來', base: 1.6 + (has(a, 'pessimist') || has(a, 'neurotic') ? 0.3 : 0) + (I.inRun && I.dep > 0 ? 0.2 : 0), lean: { safe: 0.4 }, run: () => null },
                { id: 'buy', quiet: true, text: { k: '買 {n} 銀幣的債券', p: { n: I.n } }, say: { k: '買了 {n} 銀幣的銀行債券', p: { n: I.n } }, why: '利息比放在身上好，也算幫銀行一把',
                    base: 0.9 + (trust > 30 ? 0.6 : trust > 10 ? 0.25 : 0) + (prudent ? 0.25 : 0) + (has(a, 'optimist') ? 0.25 : 0) - (I.inRun ? 0.1 : 0) + (hasV(a, '財富') ? 0.1 : 0), lean: { gain: 0.4, bond: 0.2 },
                    run: (w, a) => { const got = B.bondBy(w, a, I.id); return got ? { k: '買了 {n} 銀幣的債券，三十天後到期', p: { n: got } } : { k: '已經賣完了' }; } },
            ];
        },
    });
})();
