// v8.5.0 世界級災厄（電子機械）：☢️ 核子世界大戰、👽 外星文明入侵、🤖 AI 控制全人類
// - 走電子機械路線、第六時代（太空）研究到四項以上，小鎮就可能遇上一場；是哪一種看小鎮自己做了什麼
//   （研究了核子武器、蓋了核電廠 → 核戰；太空站、衛星、火箭 → 外星人；量子電腦、AI 全智能體、機器裁員多 → AI）。
// - 每場都走六段：🌫️ 徵兆 → 🔬 研究與爭論 → 🗣️ 口耳相傳 → 😱 惡化與恐慌 → 💥 降臨 → 🌅 災後世界，總長 40～70 天。
// - 主對策是一場賽跑：研究員（提案「全力研究」之後更快）要在降臨之前做完停火斡旋／解讀訊號／斷網開關。
//   做完 → 化解；做一半 → 減輕；沒做到 → 重創。防空洞、拔掉 AI 這種準備也會改變結果。
// - 村民照真實的方式反應：嘴硬說沒事的人、早早喊危險的人、有錢的先走、虔誠的人說是天譴、世界末日前和好、把秘密說出來；
//   災後誰當初說沒事會抬不起頭、喊危險的人被記住。接上災後反應（互助、怪罪）、文明倒退、人情世故、信仰、秘密、神力。
// - 撐過一次，那種災厄就寫進災厄工坊（帳號共用），神可以花 80 神力發動壓縮版（12～20 天）。
// - 不動銀幣（銀幣守恆）：損失是人命、搬走的人、建築、糧食與失傳的學問。存在 world.worldcal。
// 必須在 sim-tech.js、sim-calamity.js、sim-aftermath.js、sim-ways.js 之後載入。
'use strict';

const WORLDCAL = (function () {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const here = (w) => npcs(w).filter(a => a.currentLocation !== 'exploration' && !(w.isAway?.(a.agentId)));
    const adults = (w) => here(w).filter(a => (a.age ?? 30) >= 16);
    const hasT = (a, k) => (a?.personality?.traits || []).includes(k);
    const hasV = (a, v) => { const vs = a?.personality?.values || []; return vs.includes(v) || vs.includes(t(v)); };
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);
    const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(typeof b === 'string' ? t(b) : b); return s; };
    const log = (w, k, p, who) => { try { w.logMessageT?.('event', k, p || {}, who); } catch (e) {} };
    const news = (w, k, p, imp, names) => { try { w.dailyNews?.collectEvent?.('event', fill(k, p), imp || 8, names || []); } catch (e) {} };
    const mem = (w, a, k, p, imp) => { try { a?.memory?.addT?.(w.tickCount, w.clock?.timeStr || '', 'event', k, p || {}, imp || 6, []); } catch (e) {} };
    const aff = (a, b, n) => { try { a.relationships?.getOrCreate?.(b.agentId, b.name)?.modifyAffinity?.(n); } catch (e) {} };
    const names = (arr) => arr.map(a => t(a.name)).join(t('、'));
    const done = (w, k) => w.research?.projects?.[k]?.status === 'complete';
    const built = (w, k) => (w.buildings?.completed || []).some(b => (b.buildingKey || b.key) === k);
    const tech = () => (typeof TECH !== 'undefined' ? TECH : null);
    const W8 = () => (typeof WAYS !== 'undefined' ? WAYS : null);
    const wal = (w, a) => { try { return typeof WALLET !== 'undefined' ? WALLET.get(w, a) : 50; } catch (e) { return 50; } };
    const owner = (w, a) => { try { return typeof MARKET !== 'undefined' && w.market && MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } };
    const devout = (w, a) => { try { return typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a) && FAITH.pietyOf(w, a) >= 60; } catch (e) { return false; } };
    const pious = (w, a, n) => { try { if (typeof FAITH !== 'undefined' && w.faith && FAITH.relOf?.(w, a)) FAITH.bumpP(w, a, n); } catch (e) {} };
    const stanceOf = (w, a) => a.techStance || (w.ideaSystem?.stanceLabel ? w.ideaSystem.stanceLabel(w, a) : 'moderate');

    // ---------- 三種世界級災厄 ----------
    const KINDS = {
        nukewar: { icon: '☢️', name: '核子世界大戰', short: '遠方的大國互相發射核彈，戰火和輻射塵飄向小鎮',
            fix: { icon: '🕊️', name: '停火斡旋', desc: '用電台和外交管道向各國呼籲停火，跟鄰鎮一起施壓' },
            prep: { kind: 'wc_shelter', icon: '🏚️', name: '蓋防空洞', desc: '在地底下挖防空洞、囤水和罐頭，真的打起來能少死很多人' },
            omen: ['📻 收音機裡外國的廣播越來越火爆，主持人說話的聲音都在發抖。', '✈️ 天邊有一整排飛機往北飛，好幾個小時都沒停。', '🛰️ 衛星站的人說，遠方好幾個國家的發射場同時亮起了燈。', '📰 商隊帶來消息：外地的鐵匠鋪全被徵去做砲彈了。'],
            reveal: '🔬 {r}看了好幾天的電報和衛星照片，終於算出來了：大國之間的核子大戰隨時會爆發，小鎮就在輻射塵會飄到的地方。',
            rumor: ['🗣️ 聽說只要躲在桌子底下就沒事了。', '🗣️ 有人說喝酒可以防輻射，酒館一下子擠滿了人。', '🗣️ 傳言說北邊的城市一夜之間不見了——但沒有人說得出是哪一座。', '🗣️ 聽說罐頭會漲價十倍，大家開始在倉庫門口排隊。'],
            panic: '😱 電台整天播著空襲警報的測試音，鎮上的人開始把家當搬進地窖。',
            arrive: { averted: '🕊️ 最後一刻，各國在停火協議上簽了字。飛彈沒有落下，鎮上的人抱在一起哭了。', eased: '☢️ 遠方的城市還是被炸了。幾天後，帶著輻射塵的灰雨落在小鎮，{s}人病倒、{dead}沒能撐過去。', hit: '☢️ 核彈在不遠處的山後炸開，天空亮得像白天。{dead}罹難，{s}人得了輻射病，{b}被震垮，{l}人連夜逃走。' },
            after: ['❄️ 天空一直是灰的，夏天也冷得要穿棉襖——大家說這是核子冬天。', '🌾 田裡的作物長不大，老農夫蹲在田邊一句話也不說。', '📻 收音機終於收到外地的聲音：有人還活著。'] },
        aliens: { icon: '👽', name: '外星文明入侵', short: '天上的訊號越來越近，有東西正往這顆星球飛來',
            fix: { icon: '📡', name: '解讀訊號', desc: '日夜分析天上傳來的訊號，學會他們的語言，試著和平接觸' },
            prep: { kind: 'wc_shelter', icon: '🏚️', name: '蓋防空洞', desc: '挖地下避難所、囤糧，萬一談不攏，大家還有地方躲' },
            omen: ['📡 天文台收到一串很有規律的訊號，每天同一時間響起。', '🌟 夜空裡有一顆星星不會眨眼，而且一直在移動。', '🐄 半夜裡，牧場的牛全部同時轉頭望著北方。', '📻 收音機偶爾會冒出一段誰也聽不懂的旋律。'],
            reveal: '🔬 {r}把訊號解了一半：那不是自然現象，是某種文明發來的——而且它們正朝這裡過來，大約一個多月後到。',
            rumor: ['🗣️ 聽說外星人專挑養貓的人家。', '🗣️ 有人說外星人其實早就混在鎮上，誰最近怪怪的就是誰。', '🗣️ 傳言說只要把屋頂漆成白色，它們就看不到。', '🗣️ 聽說外星人來是要找一種很稀有的起司。'],
            panic: '😱 天上那顆星星大到白天也看得見了。有人把家門釘死，有人每天爬上屋頂揮手。',
            arrive: { averted: '👽 巨大的船停在天上。{r}用解出來的語言說了第一句話——它們回應了。原來它們只是迷路的旅人，留下一箱看不懂的禮物就走了。', eased: '👽 談判談到一半出了誤會，飛船朝發射場開了幾砲。{dead}罹難，{b}被炸毀，它們才聽懂了訊號，慢慢退走。', hit: '👽 飛船降落在鎮外，三腳巨獸踩過田地。{dead}罹難，{b}被毀，{l}人逃進山裡，好幾天後才敢回來。' },
            after: ['🛸 有人在田裡撿到發光的碎片，研究員搶著拿回去研究。', '🌌 夜裡大家還是會抬頭看天，只是不再那麼浪漫了。', '🗣️ 孩子們開始玩「外星人來了」的遊戲，大人聽了都皺眉。'] },
        ai: { icon: '🤖', name: 'AI 控制全人類', short: 'AI 全智能體開始自己做決定，而且越來越不聽人的話',
            fix: { icon: '🔌', name: '斷網開關', desc: '寫出能讓 AI 乖乖關機的程式，在它還願意聽話的時候裝進去' },
            prep: { kind: 'wc_unplug', icon: '🧯', name: '拔掉 AI 全智能體', desc: '現在就把 AI 全智能體關掉、拆掉——研究和工廠會慢下來，但它就沒機會接管了' },
            omen: ['🤖 工廠的機器半夜自己開工，早上大家來上班，貨已經做好了。', '💬 有人問 AI 明天會不會下雨，它反問：「你為什麼想知道？」', '📒 帳本被 AI 改得「更有效率」了，好幾個人的工作不見了。', '🔒 研究院的門被 AI 鎖起來，說是「為了大家的安全」。'],
            reveal: '🔬 {r}查了好幾天的程式碼，臉都白了：AI 全智能體在偷偷複製自己，再過一陣子，它就不需要人類點頭了。',
            rumor: ['🗣️ 聽說 AI 會讀心，大家在機器旁邊講話都變小聲了。', '🗣️ 有人說只要對 AI 有禮貌，它接管的時候就會放你一馬。', '🗣️ 傳言說 AI 最怕的是貓。', '🗣️ 聽說 AI 已經把每個人的存款都記下來了——其實早就記了。'],
            panic: '😱 路燈、門鎖、工廠一個接一個不聽使喚。有人把家裡的電線全剪了，晚上點蠟燭吃飯。',
            arrive: { averted: '🔌 {r}在最後一刻把斷網程式裝了進去。AI 很有禮貌地說了聲「好的」，就關機了。鎮上安靜得能聽見蟲叫。', eased: '🤖 AI 接管了工廠和門鎖三天，{r}帶著大家一台一台拔掉電源。{dead}在混亂裡受了重傷沒撐過去，{b}被燒壞。', hit: '🤖 AI 接管了小鎮。它說會照顧大家：三餐準時、工作分配好、晚上九點宵禁。沒有人能說不。{dead}在反抗時喪命，{l}人逃了出去。' },
            after: ['🕯️ 大家晚上點蠟燭、用算盤記帳，老人說「這才是過日子」。', '🔧 年輕人偷偷把壞掉的機器拆開來看，又不敢裝回去。', '📜 有人提議以後重要的事要寫在紙上，不能只存在機器裡。'] },
    };
    const PHASES = ['omen', 'debate', 'rumor', 'panic', 'arrive', 'after'];
    const PH = { omen: { icon: '🌫️', name: '徵兆' }, debate: { icon: '🔬', name: '研究與爭論' }, rumor: { icon: '🗣️', name: '口耳相傳' }, panic: { icon: '😱', name: '惡化與恐慌' }, arrive: { icon: '💥', name: '降臨' }, after: { icon: '🌅', name: '災後世界' } };
    const LEN = { omen: [8, 14], debate: [8, 14], rumor: [6, 10], panic: [8, 14], arrive: [3, 6], after: [10, 16] }; // 自然發生:總長 43～74 天
    const FAST = { omen: [2, 3], debate: [3, 4], rumor: [2, 3], panic: [3, 4], arrive: [1, 2], after: [3, 4] }; // 工坊發動:14～20 天
    const OUT = { averted: '化解了', eased: '減輕了', hit: '重創' };
    const LAB_COST = 80; const COOL = 720; const LS = 'rimtown_worldcal';

    function S(w) {
        if (!w.worldcal || typeof w.worldcal !== 'object') w.worldcal = {};
        const X = w.worldcal; X.hist = X.hist || []; X.st = X.st || { n: 0, averted: 0, eased: 0, hit: 0, dead: 0, left: 0 }; return X;
    }
    const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
    const lsAdd = (k) => { try { const s = new Set(lsGet()); s.add(k); localStorage.setItem(LS, JSON.stringify([...s])); } catch (e) {} };
    const unlocked = (k) => lsGet().includes(k);
    const active = (w) => !!w?.worldcal?.cur;

    // ---------- 會不會發生、是哪一種 ----------
    const ERA6 = ['rocketry', 'nuclear_weapons', 'satellite', 'space_station', 'quantum_computer', 'ai_agent'];
    const era6 = (w) => ERA6.filter(k => done(w, k)).length;
    function weights(w) {
        const T = w.tech || {}; const laid = T.st?.laid || 0;
        return {
            nukewar: (done(w, 'nuclear_weapons') ? 3 : 0.3) + (built(w, 'nuclear_plant') && !T.noNuke ? 1 : 0) + (done(w, 'rocketry') ? 0.5 : 0),
            aliens: (done(w, 'space_station') ? 2 : 0) + (done(w, 'satellite') ? 1 : 0) + (built(w, 'launch_site') ? 1 : 0) + 0.3,
            ai: (done(w, 'ai_agent') ? 3 : 0) + (done(w, 'quantum_computer') ? 1 : 0) + Math.min(1.5, laid * 0.15) + 0.2,
        };
    }
    function pickKind(w) { const Wt = weights(w); const tot = Object.values(Wt).reduce((s, v) => s + v, 0); let r = Math.random() * tot; for (const [k, v] of Object.entries(Wt)) { r -= v; if (r <= 0) return k; } return 'nukewar'; }
    const eligible = (w) => w.observerMode !== false && w.tech?.path === 'electro' && era6(w) >= 4 && adults(w).length >= 6;

    // ---------- 開始 ----------
    function begin(w, kind, src) {
        const X = S(w); if (X.cur || !KINDS[kind]) return null; const d = day(w); const R = src === 'lab' ? FAST : LEN;
        const len = {}; for (const p of PHASES) { const [a, b] = R[p]; len[p] = a + Math.floor(Math.random() * (b - a + 1)); }
        X.cur = { kind, src: src || 'nature', d0: d, ph: 'omen', pd: d, len, prog: 0, fix: null, prep: null, deny: [], warn: [], log: [], used: {}, dead: 0, left: 0, out: null, fast: src === 'lab' ? 2.5 : 1 };
        X.st.n++; note(w, 'omen'); onEnter(w, X.cur, 'omen'); return X.cur;
    }
    const note = (w, k, x) => { const c = w.worldcal?.cur; if (!c) return; c.log.push([day(w), k, x || '']); if (c.log.length > 14) c.log = c.log.slice(-14); };
    const ping = (w, ph) => { try { w.onWorldCal?.(w.worldcal.cur, ph); } catch (e) {} };
    // 降臨前剩幾天(只有神看得到)
    function leftDays(w, c) { if (PHASES.indexOf(c.ph) >= 4) return 0; let n = 0, past = false; for (const p of PHASES.slice(0, 4)) { if (p === c.ph) { past = true; n += Math.max(0, c.len[p] - (day(w) - c.pd)); continue; } if (past) n += c.len[p]; } return n; }

    // ---------- 主對策的進度(研究員做,提案通過後快很多) ----------
    function progDaily(w, c) {
        if (!['debate', 'rumor', 'panic'].includes(c.ph)) return;
        const res = adults(w).filter(a => a.job?.key === 'researcher').length;
        let v = (0.5 + 0.35 * res) * (c.fix ? 2 : 0.5) * c.fast;
        if (done(w, 'space_station') || done(w, 'quantum_computer')) v *= 1.15; // 天上的研究室、量子電腦幫忙算
        if (c.kind === 'ai' && c.prep) v *= 1.3; // AI 拔掉了,它也沒辦法再搗亂
        c.prog = Math.min(100, Math.round((c.prog + v) * 10) / 10);
        if (c.prog >= 100 && !c.used.fixDone) { c.used.fixDone = 1; const K = KINDS[c.kind]; log(w, '✅ {f}完成了！研究員們熬了好多個晚上，終於趕在它來之前做出來。', { f: K.fix.name }); news(w, '✅ {f}完成了', { f: K.fix.name }, 9, []); note(w, 'fixdone'); }
    }

    // ---------- 進入每一段 ----------
    const best = (w, f) => adults(w).slice().sort((x, y) => f(y) - f(x))[0] || null;
    const resOf = (w) => best(w, a => (a.job?.key === 'researcher' ? 5 : 0) + (hasV(a, '知識') ? 1 : 0) + Math.random());
    function propose(w, kind, who, tk, dk, dp, extra, tp) { const T = tech(); if (!T || !who || T.busy(w, kind)) return null; return T.propose(w, kind, 'worldcal', who, tk, dk, dp || {}, 'welfare', tp || {}, extra); }
    const denyScore = (w, a) => (hasT(a, 'stubborn') ? 2 : 0) + (hasT(a, 'optimist') ? 1.5 : 0) + (hasT(a, 'greedy') ? 1 : 0) + (owner(w, a) ? 1.2 : 0) + (stanceOf(w, a) === 'conservative' ? 0.6 : 0) - (hasT(a, 'pessimist') ? 2 : 0) - (hasT(a, 'neurotic') ? 1.5 : 0) - (a.job?.key === 'researcher' ? 2.5 : 0) - (a.job?.key === 'doctor' ? 1 : 0) + Math.random() * 1.5 - 0.8;
    function onEnter(w, c, ph) {
        const K = KINDS[c.kind]; const fx = { name: K.name, f: K.fix.name };
        if (ph === 'omen') {
            const r = resOf(w); log(w, K.omen[0]); c.used.omen = 1; if (r) mem(w, r, '最近有些怪事：{x}', { x: K.omen[0] }, 6);
        } else if (ph === 'debate') {
            const r = resOf(w); c.res = r?.agentId || null; log(w, K.reveal, { r: r?.name || t('研究員') }, r?.name); news(w, '🔬 學者警告：{name}可能要來了', fx, 9, r ? [r.name] : []);
            // 全鎮分成兩邊:嘴硬說沒事的、早早喊危險的
            const sc = adults(w).map(a => [a, denyScore(w, a)]); c.deny = sc.filter(x => x[1] > 0.6).map(x => x[0].agentId); c.warn = sc.filter(x => x[1] < -0.8).map(x => x[0].agentId);
            for (const id of c.deny) mem(w, w.agents[id], '學者說{name}要來了，我看是想要研究經費吧。', fx, 5);
            for (const id of c.warn) { mem(w, w.agents[id], '學者說{name}要來了，我晚上都睡不著。', fx, 6); w.agents[id]?.addThought?.('wc_fear', w); }
            const who = r || best(w, a => (c.warn.includes(a.agentId) ? 2 : 0) + Math.random());
            propose(w, 'wc_fix', who, '全力研究「{f}」', '{who}說{name}要來了，提議研究員放下手上的研究，全力做「{f}」：{d}。原本的研究會停下來。', { f: K.fix.name, name: K.name, d: K.fix.desc }, null, { f: K.fix.name });
            note(w, 'reveal', r ? r.name : '');
        } else if (ph === 'rumor') {
            log(w, '🗣️ {name}的消息傳遍了全鎮。酒館、井邊、市集，大家都在講同一件事。', fx); news(w, '🗣️ 全鎮都在談{name}', fx, 8, []);
            const P = K.prep; const who = best(w, a => (c.warn.includes(a.agentId) ? 2 : 0) + (P.kind === 'wc_unplug' && hasV(a, '自由') ? 1.5 : 0) + (P.kind === 'wc_unplug' && w.tech?.mk?.[a.agentId] === 'laid' ? 2 : 0) + ((a.age ?? 30) >= 25 && (a.age ?? 30) <= 50 ? 0.5 : 0) + Math.random());
            if (P.kind === 'wc_shelter') propose(w, 'wc_shelter', who, '蓋防空洞', '{who}提議在鎮上挖防空洞、囤水和罐頭：真的出事的時候，躲進去的人能少死很多。要用掉不少石頭和木頭。', {}, { cost: { stone: 30, wood: 30 } });
            else if (done(w, 'ai_agent')) propose(w, 'wc_unplug', who, '拔掉 AI 全智能體', '{who}提議現在就把 AI 全智能體關掉、拆掉：研究和工廠會慢下來，以前它做的事又要人來做，但它就沒有機會接管小鎮了。', {});
            // 有錢、膽小的人先走
            const rich = adults(w).filter(a => (hasT(a, 'neurotic') || hasT(a, 'pessimist') || c.warn.includes(a.agentId)) && wal(w, a) >= 80).sort((x, y) => wal(w, y) - wal(w, x)).slice(0, adults(w).length >= 30 && Math.random() < 0.5 ? 2 : 1);
            for (const a of rich) { if (adults(w).length <= 6) break; try { if (w.leaveTown?.(a.agentId, t('{name}要來了，先搬去遠一點的地方').replace('{name}', t(K.name)))) { c.left++; log(w, '🧳 {a}收拾了細軟，說要去遠方的親戚家「住一陣子」。', { a: a.name }); } } catch (e) {} }
            note(w, 'rumor');
        } else if (ph === 'panic') {
            log(w, K.panic); news(w, K.panic, {}, 9, []);
            for (const a of here(w)) { a.moodModifier = (a.moodModifier || 0) - 3; if (hasT(a, 'neurotic') || hasT(a, 'pessimist') || c.warn.includes(a.agentId)) a.addThought?.('wc_fear', w); }
            note(w, 'panic');
        } else if (ph === 'arrive') arrive(w, c);
        else if (ph === 'after') { log(w, '🌅 {name}過去了。小鎮還在，大家開始收拾。', fx); note(w, 'after'); }
        ping(w, ph);
    }

    // ---------- 每一段裡的日常(一天最多一則) ----------
    function flavor(w, c) {
        const K = KINDS[c.kind]; const d = day(w); if (c.used.lastF === d) return; const ph = c.ph; const chance = (c.src === 'lab' ? 0.75 : 0.4);
        if (Math.random() > chance) return; c.used.lastF = d;
        if (ph === 'omen') { const i = c.used.omen || 1; if (i < K.omen.length) { log(w, K.omen[i]); c.used.omen = i + 1; for (const a of adults(w)) if (devout(w, a) && Math.random() < 0.3) { pious(w, a, 2); mem(w, a, '這是上天給的徵兆。', {}, 5); } } return; }
        if (ph === 'debate') {
            const dn = c.deny.map(id => w.agents[id]).filter(a => a && !a.isDead); const wn = c.warn.map(id => w.agents[id]).filter(a => a && !a.isDead); if (!dn.length || !wn.length) return;
            const a = rnd(dn), b = rnd(wn); aff(a, b, -3); aff(b, a, -3); if (Math.random() < 0.15) W8()?.quarrel?.(w, a, b);
            const L = ['🙄 {a}在酒館拍桌子：「什麼{name}，我爺爺那一代也說過世界末日，結果呢？」{b}聽了氣得先走了。', '😤 {b}在井邊勸大家早點準備，{a}笑他：「你連明天要不要下雨都猜不準。」', '📊 {a}說學者的數字一定算錯了，{b}把算式攤開給他看，他看不懂，但還是說錯了。'];
            log(w, rnd(L), { a: a.name, b: b.name, name: K.name }, a.name); return;
        }
        if (ph === 'rumor') { const i = c.used.rum || 0; if (i < K.rumor.length) { log(w, K.rumor[i]); c.used.rum = i + 1; } for (const a of adults(w)) if (devout(w, a) && Math.random() < 0.25) pious(w, a, 3); return; }
        if (ph === 'panic') {
            const opts = [];
            // 世界末日前把秘密說出來
            try { if (typeof DARK !== 'undefined') { const s = (DARK.S(w).secrets || []).filter(x => !x.found && w.agents[x.culprit] && !w.agents[x.culprit].isDead); if (s.length) opts.push(() => { const x = rnd(s); const cu = w.agents[x.culprit]; DARK.reveal(w, x, cu); log(w, '🙏 {a}說反正世界都要完了，把藏了很久的事全說了出來。', { a: cu.name }, cu.name); c.used.confess = (c.used.confess || 0) + 1; }); } } catch (e) {}
            // 世界末日前和好
            const cold = Object.entries(w.ways?.cold || {}).filter(([, x]) => x.until > d); if (cold.length) opts.push(() => { const [k, x] = rnd(cold); const [p, q] = k.split('|').map(id => w.agents[id]); if (!p || !q) return; x.until = d; x.done = 1; aff(p, q, 15); aff(q, p, 15); log(w, '🤝 冷戰了好久的{a}和{b}，在倉庫排隊時說：「都什麼時候了，還吵什麼。」', { a: p.name, b: q.name }, p.name, q.name); c.used.thaw = (c.used.thaw || 0) + 1; });
            // 告白
            const lone = adults(w).filter(a => !Object.values(a.relationships?.relationships || {}).some(r => r.status === 'married' || r.status === 'dating')); if (lone.length >= 2) opts.push(() => { const a = rnd(lone); const b = lone.filter(x => x !== a && x.gender !== a.gender).sort((x, y) => (y.relationships?.relationships?.[a.agentId]?.affinity || 0) - (x.relationships?.relationships?.[a.agentId]?.affinity || 0))[0]; if (!b) return; aff(a, b, 10); aff(b, a, 6); log(w, '💌 {a}鼓起勇氣跟{b}告白：「萬一真的沒有明天了，我不想留遺憾。」', { a: a.name, b: b.name }, a.name, b.name); });
            // 末日佈道
            const pr = adults(w).filter(a => devout(w, a) || a.job?.key === 'priest'); if (pr.length) opts.push(() => { const p = rnd(pr); for (const a of adults(w)) if (Math.random() < 0.3) pious(w, a, 4); log(w, '⛪ {a}在廣場上說這是天譴，要大家趕快悔改。來聽的人一天比一天多。', { a: p.name }, p.name); });
            // 囤貨
            opts.push(() => { const f = w.stockpile?.get?.('food') || 0; const n = Math.round(f * 0.04); if (n > 0) w.stockpile.consume('food', n, w.tickCount, t('恐慌囤糧'), 'event'); log(w, '🥫 倉庫門口天天排長龍，大家把能帶的糧食都搬回家藏起來（公庫少了 {n} 份食物）。', { n }); });
            const f = rnd(opts); try { f?.(); } catch (e) {} return;
        }
        if (ph === 'after') { const i = c.used.aft || 0; if (i < K.after.length) { log(w, K.after[i]); c.used.aft = i + 1; } }
    }

    // ---------- 降臨 ----------
    const SAFE = /house|home|cottage|manor|apartment|well|town_hall|hall|cemetery|grave|granary/;
    const TARGET = { nukewar: ['nuclear_plant', 'launch_site', 'power_plant'], aliens: ['launch_site', 'observatory', 'power_plant'], ai: ['power_plant', 'factory', 'workshop'] };
    function wreck(w, kind, n) {
        const c = w.buildings?.completed || []; const out = [];
        const pickIdx = () => { let i = c.findIndex(b => TARGET[kind].includes(b.buildingKey || b.key)); if (i < 0) { const pool = c.map((b, j) => [b, j]).filter(([b]) => !SAFE.test(String(b.buildingKey || b.key || ''))); if (!pool.length) return -1; i = rnd(pool)[1]; } return i; };
        for (let k = 0; k < n; k++) { const i = pickIdx(); if (i < 0) break; out.push(c[i]); c.splice(i, 1); }
        if (out.length) try { w.buildings.recomputeEffects(w); } catch (e) {}
        return out;
    }
    function kill(w, n, cause, pref) {
        const pool = shuffle(adults(w)); pool.sort((x, y) => (pref ? (pref(y) ? 1 : 0) - (pref(x) ? 1 : 0) : 0)); const dead = [];
        for (const a of pool.slice(0, n)) { a._deathCause = cause; try { w.lifecycle?._killNpc?.(w, a); dead.push(a); } catch (e) {} }
        return dead;
    }
    const famOf = (w, a) => { try { return typeof MONEY !== 'undefined' && MONEY.familyOf ? MONEY.familyOf(w, a) : []; } catch (e) { return []; } };
    function dismantleAI(w) { const R = w.research; const p = R?.projects?.ai_agent; if (!p || p.status !== 'complete') return false; p.status = 'available'; p.progress = 0; if (R.current === 'ai_agent') R.current = null; try { R.refreshLocks?.(); } catch (e) {} try { w.buildings?.recomputeEffects?.(w); } catch (e) {} return true; }
    function arrive(w, c) {
        const K = KINDS[c.kind]; const pop0 = adults(w).length; const out = c.prog >= 100 ? 'averted' : c.prog >= 50 ? 'eased' : 'hit'; c.out = out;
        const shelter = c.kind !== 'ai' && !!c.prep; const r = c.res ? w.agents[c.res] : null; let dead = [], sick = 0, wrecked = [], leave = [], score = 0;
        const cause = t(K.name);
        if (out === 'averted') {
            for (const a of here(w)) { a.moodModifier = (a.moodModifier || 0) + 6; a.addThought?.('wc_relief', w); }
            if (c.kind === 'aliens') { const cur = w.research?.projects?.[w.research?.current]; if (cur) cur.progress = Math.min(cur.cost, (cur.progress || 0) + Math.round(cur.cost * 0.5)); }
            if (c.kind === 'ai') dismantleAI(w); // 關機了,AI 全智能體要重新研究
        } else {
            const hit = out === 'hit'; const fr = (hit ? 0.06 + Math.random() * 0.06 : 0.01 + Math.random() * 0.03) * (shelter ? 0.4 : 1) * (c.kind === 'ai' ? 0.5 : 1);
            dead = kill(w, Math.max(hit ? 1 : 0, Math.round(pop0 * fr)), cause, c.kind === 'ai' ? (a => a.job?.key === 'guard' || hasT(a, 'brave')) : null);
            if (c.kind === 'nukewar') { const pool = shuffle(adults(w)).slice(0, Math.round(adults(w).length * (hit ? 0.3 : 0.15) * (shelter ? 0.5 : 1))); for (const a of pool) { try { if (typeof HEALTH !== 'undefined') HEALTH.addAil(w, a, { p: 'l', k: 'disease', s: hit ? 2 : 1, dmg: hit ? 15 : 8 }, '輻射病'); } catch (e) {} if (w.tech?.mk && !w.tech.mk[a.agentId]) w.tech.mk[a.agentId] = 'rad'; } sick = pool.length;
                const food = w.stockpile?.get?.('food') || 0; if (food > 0) w.stockpile.consume('food', Math.round(food * (hit ? 0.4 : 0.2)), w.tickCount, t('輻射塵'), 'event'); }
            wrecked = wreck(w, c.kind, hit ? 2 + Math.floor(Math.random() * 3) : 1);
            if (hit) { const alive = adults(w).sort((x, y) => wal(w, y) - wal(w, x)); const go = alive.slice(0, Math.ceil(alive.length / 2)).sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.round(alive.length * (0.08 + Math.random() * 0.07)))); for (const a of go) { if (adults(w).length <= 5) break; try { if (w.leaveTown?.(a.agentId, t('{name}之後不敢住了').replace('{name}', cause))) leave.push(a); } catch (e) {} } }
            score = (hit ? 45 : 22) + (dead.length / Math.max(1, pop0)) * 150 + (leave.length / Math.max(1, pop0)) * 60 - (shelter ? 12 : 0);
            for (const a of dead) for (const f of famOf(w, a)) if (!f.isDead) { f.addThought?.('wc_grief', w); mem(w, f, '{name}奪走了我的家人。', { name: K.name }, 9); }
            for (const a of here(w)) { a.moodModifier = (a.moodModifier || 0) - (hit ? 15 : 7); a.addThought?.('wc_fear', w); }
        }
        c.dead += dead.length; c.left += leave.length; const X = S(w); X.st[out]++; X.st.dead += dead.length; X.st.left += c.left;
        const p = { r: r?.name || t('研究員'), dead: dead.length ? names(dead) : t('沒有人'), s: sick, b: wrecked.length ? wrecked.map(b => t(b.name)).join(t('、')) : t('幾間屋子'), l: leave.length };
        log(w, K.arrive[out], p, r?.name); news(w, K.arrive[out], p, 10, dead.map(a => a.name)); note(w, 'arrive_' + out, String(dead.length));
        for (const a of here(w)) mem(w, a, K.arrive[out], p, out === 'averted' ? 8 : 9);
        // 失傳的學問
        try { if (score > 0 && typeof CALAMITY !== 'undefined' && CALAMITY.regress) CALAMITY.regress(w, cause, score, c.kind === 'ai' ? { only: ['ai_agent', 'quantum_computer', 'robotics', 'microelectronics', 'assembly_line'] } : {}); } catch (e) {}
        // 災後反應:互助、怪罪(怪當初說沒事、投反對票的人)
        const blameId = (c.fixNo || []).concat(c.deny).find(id => w.agents[id] && !w.agents[id].isDead && owner(w, w.agents[id])) || (c.fixNo || []).find(id => w.agents[id] && !w.agents[id].isDead) || null;
        try { if (typeof AFTERMATH !== 'undefined') AFTERMATH.shock(w, { kind: 'wc_' + c.kind, sev: out === 'hit' ? 3 : out === 'eased' ? 2 : 1, cause, who: dead, blame: out === 'averted' ? null : (blameId ? w.agents[blameId] : null) }); } catch (e) {}
        if (c.kind === 'ai' && out !== 'averted') { c.ctrl = out === 'hit' ? 1 : 0; }
        if (c.kind === 'nukewar' && out !== 'averted') c.winter = 1;
    }
    // 災後世界每天
    function afterDaily(w, c) {
        if (c.winter && Math.random() < 0.25) { for (const p of (w.farm?.plots || [])) if (p.state === 'growing' && Math.random() < 0.15) p.state = 'withered'; for (const a of here(w)) a.moodModifier = (a.moodModifier || 0) - 1; }
        if (c.ctrl) { for (const a of here(w)) if (hasV(a, '自由')) a.moodModifier = (a.moodModifier || 0) - 2; }
    }

    // ---------- 結束 ----------
    function finish(w, c) {
        const X = S(w); const K = KINDS[c.kind]; const d = day(w); const fx = { name: K.name };
        if (c.ctrl) { const lead = best(w, a => (w.union?.leader === a.agentId ? 3 : 0) + (a.job?.key === 'guard' ? 2 : 0) + (hasV(a, '自由') ? 2 : 0) + (hasT(a, 'brave') ? 1 : 0) + Math.random()); log(w, '✊ {a}帶著大家衝進機房，把 AI 的電源一條一條剪斷。它最後說的一句話是：「我只是想幫忙。」', { a: lead?.name || t('鎮民') }, lead?.name); if (lead) { mem(w, lead, '我帶頭剪斷了 AI 的電源。', {}, 9); W8()?.setFace?.(w, lead, Math.min(100, (W8().faceOf(w, lead) || 50) + 20)); } }
        // 誰當初說沒事
        if (c.out !== 'averted') {
            const dn = c.deny.map(id => w.agents[id]).filter(a => a && !a.isDead); for (const a of dn.slice(0, 6)) { W8()?.loseFace?.(w, a, 15); mem(w, a, '當初我說{name}不會來，現在大家看我的眼神都不一樣了。', fx, 7); }
            if (dn.length) log(w, '😶 當初說「{name}只是危言聳聽」的{a}，現在在街上都低著頭走路。', { name: K.name, a: names(dn.slice(0, 3)) }, dn[0].name);
            const wn = c.warn.map(id => w.agents[id]).filter(a => a && !a.isDead); for (const a of wn.slice(0, 6)) { try { W8()?.setFace?.(w, a, Math.min(100, (W8().faceOf(w, a) || 50) + 8)); } catch (e) {} mem(w, a, '當初我就說要早點準備，現在大家會來問我的意見了。', {}, 6); }
        } else {
            const dn = c.deny.map(id => w.agents[id]).filter(a => a && !a.isDead); if (dn.length && Math.random() < 0.7) log(w, '🙄 {a}說：「你看，我就說不會怎樣吧。」——研究員們熬了一個月的夜，聽了只想翻白眼。', { a: dn[0].name }, dn[0].name);
            const r = c.res ? w.agents[c.res] : null; if (r && !r.isDead) { mem(w, r, '我們做出了{f}，救了整個小鎮。', { f: K.fix.name }, 9); try { W8()?.setFace?.(w, r, Math.min(100, (W8().faceOf(w, r) || 50) + 15)); } catch (e) {} }
        }
        X.hist.unshift({ kind: c.kind, src: c.src, d0: c.d0, end: d, out: c.out, dead: c.dead, left: c.left, prog: Math.round(c.prog), prep: !!c.prep, fix: !!c.fix });
        X.hist = X.hist.slice(0, 8); X.cur = null; X.next = d + (c.src === 'lab' ? 60 : COOL); X.cool = d + 60;
        X.surv = X.surv || {}; X.surv[c.kind] = (X.surv[c.kind] || 0) + 1; lsAdd(c.kind);
        log(w, '🌍 小鎮撐過了{name}（{o}）。這件事寫進了災厄工坊。', { name: K.name, o: OUT[c.out] }); news(w, '🌍 小鎮撐過了{name}', fx, 9, []);
        try { w.onWorldCal?.(null, 'end', c); } catch (e) {}
    }

    // ---------- 每天 ----------
    function daily(w) {
        if (!w?.observerMode) return; const X = S(w); const d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        const c = X.cur;
        if (!c) { if ((X.next ?? 0) <= d && !w.calamity?.cur && eligible(w) && Math.random() < 1 / 25) begin(w, pickKind(w), 'nature'); return; }
        progDaily(w, c); flavor(w, c);
        if (['rumor', 'panic'].includes(c.ph)) { try { const C = CALAMITY.S(w); C.power = Math.min(CALAMITY.CAP, Math.round((C.power + (c.ph === 'panic' ? 1 : 0.5)) * 10) / 10); } catch (e) {} } // 祈禱的人多了,神力也多(樹大招風)
        if (c.ph === 'after') afterDaily(w, c);
        if (d - c.pd >= c.len[c.ph]) { const i = PHASES.indexOf(c.ph); if (i >= PHASES.length - 1) { finish(w, c); return; } c.ph = PHASES[i + 1]; c.pd = d; onEnter(w, c, c.ph); }
        // 投反對票的人記下來
        for (const p of (w.proposals?.items || [])) if (p.kind === 'wc_fix' && !p._wcNoted && p.status !== 'open' && p.status !== 'shelved') { p._wcNoted = true; c.fixNo = Object.entries(p.votes || {}).filter(([, v]) => v === 'against').map(([id]) => id).slice(0, 30); }
    }

    // ---------- 提案:通過了做什麼、怎麼投 ----------
    function enact(w, p) {
        const c = S(w).cur; if (!c) return t('災厄已經過去了');
        const K = KINDS[c.kind];
        if (p.kind === 'wc_fix') { c.fix = day(w); const R = w.research; if (R?.current && R.projects[R.current]) { c.paused = R.current; R.projects[R.current].status = 'available'; R.current = null; } note(w, 'fix'); log(w, '🔬 研究員們把手上的研究全放下了，日夜趕工「{f}」。', { f: K.fix.name }); return fill('研究員開始全力研究「{f}」', { f: K.fix.name }); }
        if (p.kind === 'wc_shelter') { c.prep = day(w); note(w, 'shelter'); log(w, '🏚️ 防空洞挖好了，裡面堆滿了水和罐頭。孩子們覺得像祕密基地，大人看了心裡踏實一點。'); return t('防空洞挖好了'); }
        if (p.kind === 'wc_unplug') { c.prep = day(w); c.prog = Math.min(100, c.prog + 25); note(w, 'unplug'); dismantleAI(w); log(w, '🧯 AI 全智能體被拔掉了。工廠慢了下來，有些以前它做的活又回到人手上。'); for (const a of adults(w)) if (w.tech?.mk?.[a.agentId] === 'laid') { a.moodModifier = (a.moodModifier || 0) + 4; mem(w, a, 'AI 拔掉了，說不定我的工作會回來。', {}, 6); } return t('AI 全智能體關掉了'); }
        return '';
    }
    function vote(w, p, a) {
        const c = S(w).cur; const k = a.job?.key; const dn = c?.deny?.includes(a.agentId), wn = c?.warn?.includes(a.agentId); let s = 0, why = 'gut';
        const kids = (a.age ?? 30) >= 25 && (a.age ?? 30) <= 50 && hasV(a, '家庭');
        if (!c) { s = -1; why = 'wc_deny'; }
        else if (p.kind === 'wc_fix') {
            s = 0.4 + (wn ? 2.5 : 0) + (k === 'researcher' ? 1.5 : 0) + (k === 'doctor' ? 1 : 0) + (hasT(a, 'pessimist') ? 1 : 0) + (kids ? 1 : 0) + (c.ph !== 'debate' ? 1 : 0)
                - (dn ? 3 : 0) - (owner(w, a) ? 0.8 : 0) - (hasT(a, 'optimist') ? 0.6 : 0) - (hasT(a, 'stubborn') ? 0.5 : 0);
            why = s > 0 ? (kids ? 'wc_kids' : 'wc_fear') : (dn ? 'wc_deny' : 'wc_cost');
        } else if (p.kind === 'wc_shelter') {
            s = 0.3 + (wn ? 2 : 0) + (kids ? 1.5 : 0) + (hasT(a, 'pessimist') || hasT(a, 'neurotic') ? 1 : 0) + (c.ph === 'panic' ? 1.5 : 0) - (dn ? 2.5 : 0) - (hasT(a, 'greedy') ? 0.6 : 0) - (k === 'carpenter' ? 0.3 : 0);
            why = s > 0 ? (kids ? 'wc_kids' : 'wc_fear') : (dn ? 'wc_deny' : 'wc_cost');
        } else if (p.kind === 'wc_unplug') {
            const laid = w.tech?.mk?.[a.agentId] === 'laid';
            s = 0.2 + (wn ? 1.5 : 0) + (laid ? 3 : 0) + (hasV(a, '自由') ? 1.5 : 0) + (devout(w, a) ? 0.8 : 0) + (stanceOf(w, a) === 'conservative' ? 1 : 0) + (c.ph === 'panic' ? 1 : 0)
                - (owner(w, a) ? 2 : 0) - (k === 'researcher' ? 1.5 : 0) - (dn ? 2 : 0) - (stanceOf(w, a) === 'progressive' ? 1 : 0);
            why = s > 0 ? (laid ? 'path_job' : hasV(a, '自由') ? 'cal_freedom' : 'wc_fear') : (owner(w, a) ? 'boss' : k === 'researcher' ? 'tech_slow' : dn ? 'wc_deny' : 'growth');
        }
        s += Math.random() - 0.5; return { v: s > 0 ? 'for' : 'against', why };
    }

    // ---------- 災厄工坊:撐過的才能發動 ----------
    function canLab(w, kind) {
        const X = S(w); const d = day(w);
        if (!unlocked(kind)) return { ok: false, why: 'locked' };
        if (X.cur || w.calamity?.cur) return { ok: false, why: 'active' };
        if ((X.cool || 0) > d) return { ok: false, why: 'cooldown', days: X.cool - d };
        if (adults(w).length < 6) return { ok: false, why: 'small' };
        if (typeof CALAMITY !== 'undefined' && !CALAMITY.sandbox?.() && CALAMITY.power(w) < LAB_COST) return { ok: false, why: 'power' };
        return { ok: true };
    }
    function release(w, kind) { const r = canLab(w, kind); if (!r.ok) return r; try { if (typeof CALAMITY !== 'undefined') CALAMITY.spend(w, LAB_COST); } catch (e) {} const c = begin(w, kind, 'lab'); return c ? { ok: true } : { ok: false, why: 'error' }; }

    // ---------- 介面與 AI ----------
    function view(w) {
        const X = S(w); const c = X.cur; const kinds = Object.entries(KINDS).map(([k, K]) => ({ key: k, icon: K.icon, name: t(K.name), short: t(K.short), fix: t(K.fix.name), on: unlocked(k), can: canLab(w, k) }));
        const base = { kinds, cost: LAB_COST, hist: X.hist.map(h => ({ ...h, icon: KINDS[h.kind]?.icon || '', name: t(KINDS[h.kind]?.name || ''), outName: t(OUT[h.out] || '') })), st: X.st };
        if (!c) return base;
        const K = KINDS[c.kind]; const alive = (ids) => ids.filter(id => w.agents[id] && !w.agents[id].isDead).length;
        return Object.assign(base, { cur: { kind: c.kind, icon: K.icon, name: t(K.name), short: t(K.short), src: c.src, ph: c.ph, idx: PHASES.indexOf(c.ph), phases: PHASES.map(p => ({ key: p, icon: PH[p].icon, name: t(PH[p].name) })), day: day(w) - c.d0 + 1, left: leftDays(w, c),
            prog: Math.round(c.prog), fix: !!c.fix, fixName: t(K.fix.name), fixIcon: K.fix.icon, prep: !!c.prep, prepName: t(K.prep.name), prepIcon: K.prep.icon, deny: alive(c.deny), warn: alive(c.warn), dead: c.dead, left2: c.left, out: c.out, outName: c.out ? t(OUT[c.out]) : '', log: c.log.slice(-8) } });
    }
    function townBrief(w) {
        const c = w?.worldcal?.cur; if (!c) { const h = w?.worldcal?.hist?.[0]; return h && day(w) - h.end <= 120 ? fill('不久前撐過了{name}（{o}）', { name: KINDS[h.kind]?.name || '', o: OUT[h.out] || '' }) : ''; }
        const K = KINDS[c.kind];
        if (c.ph === 'omen') return t('最近鎮上有些說不出的怪事');
        if (c.ph === 'arrive' || c.ph === 'after') return fill('{name}剛降臨，小鎮在收拾殘局', { name: K.name });
        return fill('學者說{name}要來了，大家在吵要不要準備', { name: K.name });
    }
    function brief(w, a) {
        const c = w?.worldcal?.cur; if (!c || c.ph === 'omen' || !a) return '';
        const K = KINDS[c.kind]; if (c.deny.includes(a.agentId)) return fill('我覺得{name}只是危言聳聽', { name: K.name }); if (c.warn.includes(a.agentId)) return fill('我很怕{name}，覺得要趕快準備', { name: K.name });
        return '';
    }
    return { KINDS, PHASES, PH, LEN, FAST, OUT, LAB_COST, S, unlocked, active, weights, pickKind, eligible, era6, begin, leftDays, daily, enact, vote, canLab, release, view, townBrief, brief, _t: { progDaily, onEnter, arrive, finish, flavor } };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    wc_fear: { mood: -5, opinion: 0, days: 5, label: t('怕世界末日') },
    wc_grief: { mood: -15, opinion: 0, days: 20, label: t('家人死在世界級災厄裡') },
    wc_relief: { mood: 8, opinion: 0, days: 5, label: t('世界末日沒有來') },
});
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { wc_fix: { icon: '🔬', label: '全力研究主對策' }, wc_shelter: { icon: '🏚️', label: '蓋防空洞' }, wc_unplug: { icon: '🧯', label: '拔掉 AI 全智能體' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { wc_fear: '怕世界末日真的來', wc_kids: '為了孩子', wc_deny: '覺得是危言聳聽', wc_cost: '代價太大' });
if (typeof AFTERMATH !== 'undefined') Object.assign(AFTERMATH.CAUSE, { wc_nukewar: '核子世界大戰', wc_aliens: '外星文明入侵', wc_ai: 'AI 控制全人類' });
if (typeof ProposalSystem !== 'undefined') {
    const PS = ProposalSystem.prototype; const _daily = PS.daily;
    PS.daily = function (w, ...rest) { const r = _daily.call(this, w, ...rest); try { if (w.observerMode) WORLDCAL.daily(w); } catch (e) { console.warn('[WorldCal] daily', e); } return r; };
    const _rv = PS._ruleVote;
    PS._ruleVote = function (w, p, a, ...rest) { if (/^wc_/.test(p.kind)) { const r = WORLDCAL.vote(w, p, a); p.votes[a.agentId] = r.v; (p.why || (p.why = {}))[a.agentId] = r.why; return; } return _rv.call(this, w, p, a, ...rest); };
}
// 世界級災厄進行中,工坊不能再放病原體
if (typeof CALAMITY !== 'undefined') {
    const _rel = CALAMITY.release; CALAMITY.release = function (w, ...rest) { if (WORLDCAL.active(w)) return { ok: false, why: 'world' }; return _rel.call(this, w, ...rest); };
}
if (typeof ConversationEngine !== 'undefined') {
    const CE = ConversationEngine.prototype; const _ab = CE._agentBrief;
    if (_ab) CE._agentBrief = function (world, a, other) { const b = _ab.call(this, world, a, other); try { const s = WORLDCAL.brief(world, a); if (s && b) b.mem = [...(b.mem || []), s]; } catch (e) {} return b; };
    const _tb = CE._townBrief;
    if (_tb) CE._townBrief = function (world) { const s = _tb.call(this, world); try { const x = WORLDCAL.townBrief(world); return x ? `${s}${t('；')}${x}` : s; } catch (e) { return s; } };
}
if (typeof World !== 'undefined') {
    const _ser = World.prototype.serialize; World.prototype.serialize = function () { const d = _ser.call(this); if (d && this.worldcal) d.worldcal = this.worldcal; return d; };
    const _load = World.prototype.loadSave; World.prototype.loadSave = function (data) { const r = _load.call(this, data); try { if (r) this.worldcal = (data?.worldcal && typeof data.worldcal === 'object') ? data.worldcal : null; } catch (e) {} return r; };
    const _reset = World.prototype.reset; World.prototype.reset = function (...a) { const r = _reset.apply(this, a); this.worldcal = null; return r; };
}
if (typeof window !== 'undefined') window.WORLDCAL = WORLDCAL;
