// v8.5.0 世界級災厄（電子機械）：☢️ 核子世界大戰、👽 外星文明入侵、🤖 AI 控制全人類
// v8.6.0 另外兩條路線也有了：🧬 基因生物 → 🍼 全球不孕；⚙️ 蒸汽煉金 → 🧊 冰河期（煤煙越多越可能）、🌀 以太裂隙（以太引擎、浮空城）
//   不孕不死人，只是孩子生不出來（精卵庫留一點希望）；冰河期壓垮糧食、田地和老人（囤糧囤柴有用）；裂隙把人吸走、把房子扭走（先搬走的人家少很多）。
// - 路線的第六時代研究到六成，小鎮就可能遇上一場；是哪一種看小鎮自己做了什麼
//   （研究了核子武器、蓋了核電廠 → 核戰；太空站、衛星、火箭 → 外星人；量子電腦、AI 全智能體、機器裁員多 → AI）。
// - 每場都走六段：🌫️ 徵兆 → 🔬 研究與爭論 → 🗣️ 口耳相傳 → 😱 惡化與恐慌 → 💥 降臨 → 🌅 災後世界，總長 40～70 天。
// - 主對策是一場賽跑：研究員（提案「全力研究」之後更快）要在降臨之前做完停火斡旋／解讀訊號／斷網開關。
//   做完 → 化解；做一半 → 減輕；沒做到 → 重創。防空洞、拔掉 AI 這種準備也會改變結果。
// - 村民照真實的方式反應：嘴硬說沒事的人、早早喊危險的人、有錢的先走、虔誠的人說是天譴、世界末日前和好、把秘密說出來；
//   災後誰當初說沒事會抬不起頭、喊危險的人被記住。接上災後反應（互助、怪罪）、文明倒退、人情世故、信仰、秘密、神力。
// - 撐過一次，那種災厄就解鎖（v9.2.0 起跟著帳號，任何城鎮都能從手牌發動），神可以花 80 神力發動壓縮版（14～20 天）。
// v9.2.0 基因生物多了 🧟 喪屍危機：被咬兩天後變喪屍（不投票、不聊天），解藥做完全部變回來。
// - 不動銀幣（銀幣守恆）：損失是人命、搬走的人、建築、糧食與失傳的學問。存在 world.worldcal。
// 必須在 sim-tech.js、sim-calamity.js、sim-aftermath.js、sim-ways.js 之後載入。
'use strict';

const WORLDCAL = (function () {
    const day = (w) => (w?._absDay ? w._absDay() : 0);
    const npcs = (w) => Object.values(w?.agents || {}).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && !isZ(w, a)); // v9.2.0 喪屍不算鎮民(不投票、不聊天)
    const zIds = (w) => w?.worldcal?.cur?.zb?.ids || [];
    function isZ(w, a) { const ids = w?.worldcal?.cur?.zb?.ids; return !!(ids && ids.length && a && ids.includes(a.agentId)); }
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
        // v8.6.0 基因生物:全球不孕
        infertile: { path: 'bio', icon: '🍼', name: '全球不孕', short: '世界各地的新生兒越來越少，最後一個也沒有了',
            fix: { icon: '🧬', name: '生殖修復療法', desc: '找出不孕的原因，研究能修好生殖細胞的療法' },
            prep: { kind: 'wc_bank', icon: '🧊', name: '精卵庫與人工子宮', desc: '趁現在把年輕人的精卵冷凍起來，再試做人工子宮，最壞的情況也還有一點希望' },
            omen: ['🍼 產婆說這個月一個孩子都沒接生，她做了三十年從來沒這樣過。', '📰 商隊說外地的學堂開始併班，因為一年級招不到人。', '🐣 連雞舍裡的蛋也少了，孵出來的小雞稀稀落落。', '💍 新婚的夫妻來找醫生，說試了一年都沒有消息。'],
            reveal: '🔬 {r}比對了好幾個鎮的紀錄，臉色很難看：全世界的生育率都在往下掉，再過不久，就不會再有孩子出生了。',
            rumor: ['🗣️ 聽說是井水裡被加了東西，有人開始只喝雨水。', '🗣️ 有人說是神在懲罰改造生命的人，基因診所門口被丟了雞蛋。', '🗣️ 傳言說吃生蠔可以治，魚販的生蠔一早就被搶光。', '🗣️ 聽說王都已經在抽籤分配還能生的人——沒人說得出是誰聽來的。'],
            panic: '😱 學堂的門口貼了「暫停招生」，鎮上的老人開始問：以後誰來照顧我們？',
            arrive: { averted: '🧬 療法在最後一刻做出來了。幾個月後，產婆又接生了第一個孩子，全鎮的人都跑來看。', eased: '🍼 療法只做出一半。孩子還是會出生，只是少了很多，每一個新生兒都像是全鎮的寶貝。', hit: '🍼 療法沒能趕上。鎮上再也沒有孩子出生，學堂一間一間關了，{l}對想要孩子的夫妻搬去外地碰運氣。' },
            after: ['🧸 有人把孩子的舊玩具一件一件收進箱子，捨不得丟。', '👵 老人們輪流去學堂打掃，說等孩子回來的時候要乾乾淨淨的。', '📜 史官把最後一個出生的孩子名字寫進了書裡。'] },
        // v8.6.0 蒸汽煉金:冰河期(煤煙把天空燻黑,整個世界冷了下來)
        iceage: { path: 'steam', icon: '🧊', name: '冰河期', short: '煤煙遮住了太陽，整個世界一年比一年冷',
            fix: { icon: '🌱', name: '生態方舟', desc: '蓋起有地熱和溫室的方舟，把作物、牲口和種子保住' },
            prep: { kind: 'wc_stock', icon: '🪵', name: '囤糧囤柴', desc: '把能存的糧食和木柴都存起來，撐過最冷的那幾個月' },
            omen: ['❄️ 夏天的早上井口結了一層薄冰，老人說他活了七十年沒見過。', '🌾 麥子還沒熟就枯了，田裡一片焦黃。', '🦢 候鳥今年沒有回來。', '☁️ 天空一直是灰的，煙囪的煙飄不上去，整天壓在屋頂上。'],
            reveal: '🔬 {r}量了一整年的溫度，算出來了：煤煙把陽光擋住，整個世界正在變冷——冰河期要來了。',
            rumor: ['🗣️ 聽說多穿三件襪子就不會凍死，裁縫的毛線一下子賣光。', '🗣️ 有人說只要燒更多煤就會暖起來——被研究員瞪了一眼。', '🗣️ 傳言說南方的城市已經在搶地了。', '🗣️ 聽說熊會跑進鎮裡找吃的，大家晚上都把門閂好。'],
            panic: '😱 河面結了冰，柴火的價錢一天漲一次。有人把家具劈了當柴燒。',
            arrive: { averted: '🌱 生態方舟蓋好了。外面下著大雪，方舟裡的番茄照樣紅，大家擠在溫室裡過了一個奇怪又溫暖的冬天。', eased: '🧊 寒冬來了，方舟只蓋好一半。田裡的作物凍死了一大片，{dead}沒能熬過最冷的那幾晚。', hit: '🧊 冰河期真的來了。田地結凍、牲口凍死，{dead}在寒夜裡沒能醒來，{l}人往南方逃去。' },
            after: ['🧣 大家把舊衣服拆了重織，鎮上流行起很醜但很暖的毛衣。', '🔥 每天晚上全鎮擠在同一個火爐旁邊，反而比以前更常聊天。', '🏭 有人在議會上提議少燒點煤——這次沒有人笑。'] },
        // v8.6.0 蒸汽煉金:以太裂隙
        rift: { path: 'steam', icon: '🌀', name: '以太裂隙', short: '以太用得太兇，天空裂開了一道縫，另一邊有東西在看',
            fix: { icon: '🔮', name: '封印裂隙', desc: '用以太穩定器反向灌注，把天空的裂縫縫回去' },
            prep: { kind: 'wc_evac', icon: '🧳', name: '遷離裂隙周邊', desc: '把住在裂隙下面的人先搬到鎮的另一頭，被吸進去的人會少很多' },
            omen: ['🌀 以太引擎半夜發出低沉的嗡嗡聲，連狗都不敢叫。', '🕰️ 鎮上的鐘有的快了十分鐘、有的慢了十分鐘，每天都不一樣。', '🐈 有隻貓從空氣裡走出來，舔了舔爪子，又走回空氣裡。', '🌌 夜裡天空有一道淡紫色的線，像被誰用指甲劃過。'],
            reveal: '🔬 {r}對著以太計量器算了三天三夜：那道紫色的線是一道裂隙，而且一天比一天寬。等它整個打開，另一邊的東西就會過來。',
            rumor: ['🗣️ 聽說裂隙的另一邊住著跟我們長得一模一樣的人，只是左右顛倒。', '🗣️ 有人說對著裂隙許願會成真，晚上廣場擠滿了人。', '🗣️ 傳言說被吸進去的人會變成星星。', '🗣️ 聽說裂隙最怕鹽，家家戶戶在門口撒了一圈鹽。'],
            panic: '😱 裂隙底下的屋頂開始飄起來，掉下來的東西有魚、有雨傘，還有一隻不會說話的鸚鵡。',
            arrive: { averted: '🔮 {r}把穩定器推到最大，裂隙慢慢合上了。最後從縫裡掉出來一把傘，上面寫著看不懂的字。', eased: '🌀 裂隙開了一個晚上就被封住了，但{l}人在那一夜被吸了進去，{b}被扭成了奇怪的形狀。', hit: '🌀 裂隙整個打開了。{l}人被吸進紫色的光裡，{b}飄上天空就沒再下來，奇怪的生物在街上遊蕩了好幾天。' },
            after: ['🪐 天上那道疤還在，晚上會淡淡地發光，孩子們叫它「紫色的月亮」。', '🧭 有人在田裡撿到一個指著「不存在的方向」的羅盤。', '🕯️ 每到滿月，被吸進去的人的家人會在廣場點燈。'] },
        // v9.2.0 基因生物:喪屍危機(改造生命的實驗出了錯,被咬的人兩天後變成喪屍)
        zombie: { path: 'bio', icon: '🧟', name: '喪屍危機', short: '改造生命的實驗出了錯，被咬的人會變成喪屍',
            fix: { icon: '🧪', name: '喪屍解藥', desc: '從還沒發病的人身上找出抗體，做出能把喪屍變回人的解藥' },
            prep: { kind: 'wc_wall', icon: '🧱', name: '築牆封鎖', desc: '在鎮的四周築牆、夜裡巡守，喪屍進不來，被咬的人會少很多' },
            omen: ['🐀 下水道的老鼠白天也跑出來，眼睛是混濁的白色。', '🐕 好幾隻狗半夜對著遠方的路一直叫，叫到天亮。', '📰 商隊說外地有個實驗室被封了，守衛不准任何人靠近。', '🩸 有個從外地回來的人手上纏著繃帶，說是被狗咬的，一直在發燒。'],
            reveal: '🔬 {r}看了外地寄來的血液樣本，手一直在抖：那是一種會讓人失去理智、見人就咬的病原體，被咬的人兩天內就會變成跟它們一樣的東西。它正沿著商路往這裡過來。',
            rumor: ['🗣️ 聽說喪屍怕火，鐵匠鋪的火把一下子賣光了。', '🗣️ 有人說喪屍只在晚上出來，白天躲在墓園裡。', '🗣️ 傳言說被咬了只要馬上喝烈酒就不會變——酒館老闆不說話，只是點頭。', '🗣️ 聽說外地已經有整個村子空了，只剩門在風裡開開關關。'],
            panic: '😱 鎮外的路上看得到搖搖晃晃的人影。大家天一黑就把門閂上，有人在床底下藏了一把斧頭。',
            arrive: { averted: '🧪 解藥及時做出來了。第一批被咬的人打了針，燒退了，眼睛又看得見人了。{r}累得直接睡在實驗台上。', eased: '🧟 喪屍還是進了鎮，{s}人變成了喪屍。解藥只做出一半，大家輪班守夜，等研究員把它做完。', hit: '🧟 喪屍湧進了小鎮。{s}人被咬、變成了它們的一份子，{dead}在混亂裡喪命。剩下的人躲進屋裡，聽著外面的抓門聲。' },
            after: ['🔥 每天晚上鎮上都點著火把，守衛輪班從天黑站到天亮。', '🩹 家家戶戶都學會了怎麼看傷口：是抓傷還是咬痕，差別很大。', '🪦 墓園裡多了很多新墳，有些墳上放著他們生前最愛的東西。'] },
        // v9.3.0 終局災厄:七種都撐過才會出現。太陽變暗,三條路線同時崩壞(電網、生命、以太),研究員要分頭救
        blacksun: { path: 'all', icon: '🌑', name: '黑日', short: '太陽一天比一天暗，電網、生命、以太同時開始崩壞',
            fix: { icon: '🕯️', name: '三線救亡', desc: '研究員分成三組，同時搶救電網、生命和以太：哪一線沒救起來，就會在那裡受重創' },
            prep: { kind: 'wc_ark', icon: '🛖', name: '地下方舟', desc: '在地底下蓋一座方舟，囤糧、囤種子、留一盞以太燈：不管哪一線崩了，躲進去的人都會少受一點苦' },
            omen: ['🌑 正午的太陽像隔了一層紗，影子淡得幾乎看不見。', '⚡ 電燈一閃一閃，發電廠說機器沒壞，是「電自己變少了」。', '🌱 剛發芽的麥子一夜之間全部垂下頭，像在對天空鞠躬。', '🔮 以太燈的光變成灰色，老煉金師說他一輩子沒見過這種顏色。'],
            reveal: '🔬 {r}把三份報告攤在桌上——電網、生命、以太，三條線同時在往下掉，而且都指向同一個原因：太陽本身在熄滅。再過一陣子，這三樣東西會一起垮掉。',
            rumor: ['🗣️ 聽說是因為人類把七次末日都躲過了，老天爺這次要一次收回來。', '🗣️ 有人說只要在屋頂上點滿蠟燭，太陽就會記得回來。', '🗣️ 傳言說王都已經在挖很深很深的洞，只讓有錢人下去。', '🗣️ 聽說以前撐過末日的人身上有記號，這次會被先找到。'],
            panic: '😱 白天跟傍晚一樣暗。電燈一盞盞熄掉、田裡的作物一片片枯黃、以太燈只剩一點灰光。有人說這次是真的結束了。',
            arrive: { averted: '🌅 三條線全部撐住了。那天早上，太陽慢慢亮了回來，大家站在廣場上，看自己的影子一點一點變深。{r}哭得像個孩子。', eased: '🌑 黑日來了。有的線撐住了，有的沒有：{dead}沒能等到天亮，{b}在黑暗裡毀了，{l}人往有光的地方逃去。', hit: '🌑 太陽整整暗了七天。電網燒了、田全枯了、以太燈一盞接一盞熄滅。{dead}在黑暗裡走了，{b}垮了，{l}人摸黑離開了小鎮。' },
            after: ['🌤️ 太陽回來了，可是比以前淡一點。老人說，以後的夏天大概都會涼一些。', '🕯️ 家家戶戶都在窗台上留一根蠟燭，說是給那七天的自己。', '📜 史官在書的最後一頁寫：「八次末日，我們都還在。」'] },
    };
    // v9.3.0 黑日的三條戰線
    const FRONTS = { electro: { icon: '⚡', name: '重建電網', hit: '電網燒毀', only: ['ai_agent', 'quantum_computer', 'robotics', 'microelectronics', 'assembly_line'], target: ['power_plant', 'factory', 'workshop', 'launch_site'] },
        bio: { icon: '🌱', name: '生命與種子庫', hit: '生命凋零', only: ['gene_editing', 'synthetic_life', 'myth_genome', 'life_extension'], target: [] },
        steam: { icon: '🔮', name: '以太長明燈', hit: '以太熄滅', only: ['aether_engine', 'floating_city', 'philosopher_stone', 'homunculus'], target: ['refinery', 'airship_dock', 'alchemy_lab', 'sky_isle'] } };
    const FJOB = { electro: ['engineer', 'worker', 'craftsman', 'blacksmith', 'researcher'], bio: ['farmer', 'doctor', 'herbalist', 'cook'], steam: ['alchemist', 'priest', 'merchant', 'carpenter'] };
    const SEVEN = ['nukewar', 'aliens', 'ai', 'infertile', 'zombie', 'iceage', 'rift'];
    // v8.6.0 每種災厄的路線與權重(小鎮自己做了什麼)
    const WEIGHT = {
        nukewar: (w) => { const T = w.tech || {}; return (done(w, 'nuclear_weapons') ? 3 : 0.3) + (built(w, 'nuclear_plant') && !T.noNuke ? 1 : 0) + (done(w, 'rocketry') ? 0.5 : 0); },
        aliens: (w) => (done(w, 'space_station') ? 2 : 0) + (done(w, 'satellite') ? 1 : 0) + (built(w, 'launch_site') ? 1 : 0) + 0.3,
        ai: (w) => (done(w, 'ai_agent') ? 3 : 0) + (done(w, 'quantum_computer') ? 1 : 0) + Math.min(1.5, (w.tech?.st?.laid || 0) * 0.15) + 0.2,
        infertile: () => 1,
        zombie: (w) => 0.5 + (done(w, 'synthetic_life') ? 1.2 : 0) + (done(w, 'life_extension') ? 0.8 : 0) + Math.min(1.5, (w.tech?.bio?.st?.leak || 0) * 0.5), // v9.2.0 造了人工生命、做過延壽、實驗室外洩過
        iceage: (w) => 0.6 + Math.min(2, (w.tech?.steam?.smog || 0) / 25) + (w.tech?.steam?.air ? -0.4 : 0), // 煤煙越多越可能
        rift: (w) => 0.4 + (done(w, 'aether_engine') ? 1.5 : 0) + (done(w, 'floating_city') ? 1 : 0),
        blacksun: () => 0.4, // 七種都撐過以後,任何路線走到頂都可能遇上
    };
    for (const k of ['nukewar', 'aliens', 'ai']) KINDS[k].path = 'electro';
    const PHASES = ['omen', 'debate', 'rumor', 'panic', 'arrive', 'after'];
    const PH = { omen: { icon: '🌫️', name: '徵兆' }, debate: { icon: '🔬', name: '研究與爭論' }, rumor: { icon: '🗣️', name: '口耳相傳' }, panic: { icon: '😱', name: '惡化與恐慌' }, arrive: { icon: '💥', name: '降臨' }, after: { icon: '🌅', name: '災後世界' } };
    const LEN = { omen: [8, 14], debate: [8, 14], rumor: [6, 10], panic: [8, 14], arrive: [3, 6], after: [10, 16] }; // 自然發生:總長 43～74 天
    const FAST = { omen: [2, 3], debate: [3, 4], rumor: [2, 3], panic: [3, 4], arrive: [1, 2], after: [3, 4] }; // 工坊發動:14～20 天
    const OUT = { averted: '化解了', eased: '減輕了', hit: '重創' };
    const PATHN = { electro: '⚡ 電子機械', bio: '🧬 基因生物', steam: '⚙️ 蒸汽煉金', all: '🌑 三條路線' };
    const LAB_COST = 80; const COOL = 720; const LS = 'rimtown_worldcal';

    function S(w) {
        if (!w.worldcal || typeof w.worldcal !== 'object') w.worldcal = {};
        const X = w.worldcal; X.hist = X.hist || []; X.st = X.st || { n: 0, averted: 0, eased: 0, hit: 0, dead: 0, left: 0 }; return X;
    }
    const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
    const lsAdd = (k) => { try { const s = new Set(lsGet()); const had = s.has(k); s.add(k); localStorage.setItem(LS, JSON.stringify([...s])); if (!had && typeof window !== 'undefined') window.dispatchEvent?.(new Event('rimtown-unlock')); } catch (e) {} }; // v9.2.0 新解鎖 → 推上帳號
    const allSeven = () => { const u = lsGet(); return SEVEN.every(k => u.includes(k)); };
    const unlocked = (k) => k === 'blacksun' ? allSeven() : lsGet().includes(k); // v9.3.0 黑日:七種都撐過才解鎖
    const active = (w) => !!w?.worldcal?.cur;

    // ---------- 會不會發生、是哪一種 ----------
    const era6Ratio = (w, P) => { try { return TECH.stageRatio(w.research, P, 6); } catch (e) { return 0; } };
    const kindsOf = (P) => Object.keys(KINDS).filter(k => KINDS[k].path === P || (KINDS[k].path === 'all' && P && allSeven()));
    function weights(w) { const P = w.tech?.path; const out = {}; for (const k of kindsOf(P)) { try { out[k] = Math.max(0.1, WEIGHT[k](w)); } catch (e) { out[k] = 0.1; } } return out; }
    function pickKind(w) { const Wt = weights(w); const ks = Object.keys(Wt); if (!ks.length) return null; const tot = Object.values(Wt).reduce((s, v) => s + v, 0); let r = Math.random() * tot; for (const [k, v] of Object.entries(Wt)) { r -= v; if (r <= 0) return k; } return ks[0]; }
    const era6 = (w) => Math.round(era6Ratio(w, w.tech?.path) * 100);
    const eligible = (w) => w.observerMode !== false && kindsOf(w.tech?.path).some(k => KINDS[k].path !== 'all') && era6Ratio(w, w.tech.path) >= 0.6 && adults(w).length >= 6; // 路線第六時代研究到六成

    // ---------- 開始 ----------
    function begin(w, kind, src) {
        const X = S(w); if (X.cur || !KINDS[kind]) return null; const d = day(w); const R = src === 'lab' ? FAST : LEN;
        const len = {}; for (const p of PHASES) { const [a, b] = R[p]; len[p] = a + Math.floor(Math.random() * (b - a + 1)); }
        if (kind === 'zombie') len.after = Math.max(len.after, src === 'lab' ? 8 : 14); // 喪屍要鬧一陣子
        if (kind === 'blacksun') { len.debate += src === 'lab' ? 2 : 4; len.panic += src === 'lab' ? 2 : 4; } // 三條線要救,給多一點時間
        X.cur = { kind, src: src || 'nature', d0: d, ph: 'omen', pd: d, len, prog: 0, fix: null, prep: null, deny: [], warn: [], log: [], used: {}, dead: 0, left: 0, out: null, fast: src === 'lab' ? 2.5 : 1 };
        if (kind === 'blacksun') { X.cur.fronts = { electro: 0, bio: 0, steam: 0 }; X.cur.focus = null; }
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
        let v = (0.5 + 0.25 * Math.min(6, res)) * (c.fix ? 2 : 0.5) * c.fast; // 研究員多到六個以上也快不了多少
        if (done(w, 'space_station') || done(w, 'quantum_computer')) v *= 1.15; // 天上的研究室、量子電腦幫忙算
        if (c.kind === 'ai' && c.prep) v *= 1.3; // AI 拔掉了,它也沒辦法再搗亂
        if (c.fronts) { // v9.3.0 黑日:研究員分三組。小鎮自己的路線熟一點;通過「先救哪一線」就偏重那一線
            const P = w.tech?.path; const wt = {}; for (const f of Object.keys(FRONTS)) wt[f] = (f === P ? 1.4 : 1) * (c.focus ? (f === c.focus ? 2.4 : 0.6) : 1);
            const tot = Object.values(wt).reduce((a, b) => a + b, 0);
            for (const f of Object.keys(FRONTS)) c.fronts[f] = Math.min(100, Math.round((c.fronts[f] + v * 1.7 * wt[f] / tot * 3 / 1.15) * 10) / 10);
            c.prog = Math.round(Object.values(c.fronts).reduce((a, b) => a + b, 0) / 3 * 10) / 10;
            for (const f of Object.keys(FRONTS)) if (c.fronts[f] >= 100 && !c.used['fd_' + f]) { c.used['fd_' + f] = 1; log(w, '✅ {f}撐住了！這一線的研究員終於可以睡一覺。', { f: FRONTS[f].name }); note(w, 'front', FRONTS[f].name); }
            if (Object.values(c.fronts).every(x => x >= 100) && !c.used.fixDone) { c.used.fixDone = 1; c.prog = 100; log(w, '✅ 三線救亡全部完成！電網、生命、以太都撐住了，剩下的只能等太陽自己決定。'); news(w, '✅ 三線救亡全部完成', {}, 10, []); note(w, 'fixdone'); }
            return;
        }
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
            const P = K.prep; const who = best(w, a => (c.warn.includes(a.agentId) ? 2 : 0) + (P.kind === 'wc_bank' && (a.job?.key === 'doctor' || a.job?.key === 'researcher') ? 2 : 0) + (P.kind === 'wc_stock' && a.job?.key === 'farmer' ? 2 : 0) + (P.kind === 'wc_unplug' && hasV(a, '自由') ? 1.5 : 0) + (P.kind === 'wc_unplug' && w.tech?.mk?.[a.agentId] === 'laid' ? 2 : 0) + ((a.age ?? 30) >= 25 && (a.age ?? 30) <= 50 ? 0.5 : 0) + Math.random());
            if (P.kind === 'wc_shelter') propose(w, 'wc_shelter', who, '蓋防空洞', '{who}提議在鎮上挖防空洞、囤水和罐頭：真的出事的時候，躲進去的人能少死很多。要用掉不少石頭和木頭。', {}, { cost: { stone: 30, wood: 30 } });
            else if (done(w, 'ai_agent')) propose(w, 'wc_unplug', who, '拔掉 AI 全智能體', '{who}提議現在就把 AI 全智能體關掉、拆掉：研究和工廠會慢下來，以前它做的事又要人來做，但它就沒有機會接管小鎮了。', {});
            else if (P.kind === 'wc_bank') propose(w, 'wc_bank', who, '精卵庫與人工子宮', '{who}提議趁現在把年輕人的精卵冷凍起來，研究員再試做人工子宮：就算最壞的情況，鎮上也還有機會有孩子。要用掉不少紙和研究員的時間，也有人覺得這樣違反天意。', {}, { cost: { paper: 15 } });
            else if (P.kind === 'wc_stock') propose(w, 'wc_stock', who, '囤糧囤柴', '{who}提議全鎮一起囤糧、囤木柴，蓋一間不透風的冬季倉庫：最冷的那幾個月，至少不會餓死凍死。要先拿出一批木頭和石頭。', {}, { cost: { wood: 40, stone: 20 } });
            else if (P.kind === 'wc_wall') propose(w, 'wc_wall', who, '築牆封鎖', '{who}提議在鎮的四周築牆、設拒馬，守衛排夜班巡守：喪屍真的來了，至少進不來。要用掉不少木頭和石頭，商隊也會少一點。', {}, { cost: { wood: 35, stone: 25 } });
            else if (P.kind === 'wc_ark') propose(w, 'wc_ark', who, '地下方舟', '{who}提議在鎮的地底下蓋一座方舟：囤糧、囤種子、留一盞以太燈和一台手搖發電機。不管哪一線崩了，躲進去的人都能少受一點苦。要用掉很多木頭、石頭和糧食。', {}, { cost: { wood: 40, stone: 40, food: 30 } });
            else if (P.kind === 'wc_evac') propose(w, 'wc_evac', who, '遷離裂隙周邊', '{who}提議把住在裂隙底下的人家先搬到鎮的另一頭，空出來的房子先封起來：裂隙真的打開時，被吸進去的人會少很多。搬家的人得暫時擠一擠。', {});
            // v9.3.0 黑日:有人提議先救最危險的那一線
            if (c.fronts) { const weak = Object.keys(FRONTS).sort((a, b) => c.fronts[a] - c.fronts[b])[0]; const fw = best(w, a => (FJOB[weak].includes(a.job?.key) ? 3 : 0) + (c.warn.includes(a.agentId) ? 1 : 0) + Math.random());
                propose(w, 'wc_focus', fw, '先救「{f}」', '{who}說三條線不可能全部救起來，提議研究員先集中救最危險的「{f}」，另外兩線只留少數人。救起來的那一線會快很多，其他兩線就要碰運氣。', { f: FRONTS[weak].name }, { front: weak }, { f: FRONTS[weak].name }); }
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
    const ONLY = { zombie: ['synthetic_life', 'gene_editing', 'life_extension', 'myth_genome'], ai: ['ai_agent', 'quantum_computer', 'robotics', 'microelectronics', 'assembly_line'], infertile: ['gene_editing', 'synthetic_life', 'myth_genome', 'life_extension'], rift: ['aether_engine', 'floating_city', 'philosopher_stone', 'homunculus'] };
    const TARGET = { nukewar: ['nuclear_plant', 'launch_site', 'power_plant'], aliens: ['launch_site', 'observatory', 'power_plant'], ai: ['power_plant', 'factory', 'workshop'], iceage: ['airship_dock', 'gear_workshop', 'refinery'], rift: ['sky_isle', 'airship_dock', 'alchemy_lab', 'refinery'], infertile: [], zombie: [], blacksun: ['power_plant', 'factory', 'refinery', 'airship_dock', 'workshop'] };
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
        } else if (c.kind === 'infertile') {
            // 不死人:只是不再有孩子。精卵庫在的話,還有一點希望
            const hit = out === 'hit'; const X0 = S(w); X0.sterile = { until: day(w) + (hit ? 360 : 240), f: hit ? (c.prep ? 0.3 : 0) : (c.prep ? 0.75 : 0.5), blocked: 0 };
            const young = adults(w).filter(a => (a.age ?? 30) >= 20 && (a.age ?? 30) <= 42);
            const wedded = young.filter(a => Object.values(a.relationships?.relationships || {}).some(r => r.status === 'married'));
            for (const a of young) { a.moodModifier = (a.moodModifier || 0) - (hit ? 10 : 5); if (wedded.includes(a) || hasV(a, '家庭')) { a.addThought?.('wc_childless', w); mem(w, a, hit ? '我們可能永遠不會有孩子了。' : '想要一個孩子，現在變成要排隊等的事了。', {}, 8); } }
            for (const a of adults(w)) if ((a.age ?? 30) >= 60) mem(w, a, '以後誰來照顧我們這些老人？', {}, 6);
            if (hit) { const seen = new Set(); const want = wedded.filter(a => hasV(a, '家庭') || Math.random() < 0.4); const max = Math.max(1, Math.round(pop0 * 0.05)); let pairs = 0;
                for (const a of shuffle(want)) { if (pairs >= max || adults(w).length <= 6) break; if (seen.has(a.agentId)) continue; const sp = Object.values(a.relationships?.relationships || {}).find(r => r.status === 'married'); const b = sp ? w.agents[sp.targetId] : null; seen.add(a.agentId); if (b) seen.add(b.agentId);
                    const why = t('{name}之後想去外地碰運氣生孩子').replace('{name}', cause); let ok = false; try { ok = !!w.leaveTown?.(a.agentId, why); } catch (e) {} if (!ok) continue; leave.push(a); pairs++; if (b && !b.isDead && !b.isPlayer && w.agents[b.agentId]) { try { if (w.leaveTown?.(b.agentId, why)) leave.push(b); } catch (e) {} } }
                c.pairs = pairs; }
            score = hit ? 18 : 8;
        } else if (c.kind === 'blacksun') {
            // v9.3.0 黑日:三條戰線各自算結果。方舟讓每一線的傷害都少一些
            const ark = !!c.prep; const fo = c.frontOut = {}; const lost = [];
            for (const f of Object.keys(FRONTS)) fo[f] = c.fronts[f] >= 100 ? 'averted' : c.fronts[f] >= 50 ? 'eased' : 'hit';
            const hits = Object.values(fo).filter(x => x === 'hit').length, eases = Object.values(fo).filter(x => x === 'eased').length;
            c.out = hits >= 2 ? 'hit' : (hits || eases) ? 'eased' : 'averted';
            if (fo.electro !== 'averted') { wrecked = wrecked.concat(wreck(w, 'blacksun', fo.electro === 'hit' ? 2 : 1)); if (fo.electro === 'hit') lost.push(...FRONTS.electro.only); log(w, fo.electro === 'hit' ? '⚡ 電網整個燒掉了，工廠的機器一台一台停下來，再也沒有動。' : '⚡ 電網撐了一半，有幾區黑了好幾天才接回來。'); }
            if (fo.bio !== 'averted') { const hit = fo.bio === 'hit'; const food = w.stockpile?.get?.('food') || 0; if (food > 0) w.stockpile.consume('food', Math.round(food * (hit ? 0.4 : 0.15) * (ark ? 0.6 : 1)), w.tickCount, t('黑日'), 'event');
                for (const pl of (w.farm?.plots || [])) if (pl.state === 'growing' && Math.random() < (hit ? 0.8 : 0.4)) pl.state = 'withered';
                if (hit) { dead = dead.concat(kill(w, Math.max(1, Math.round(pop0 * 0.04 * (ark ? 0.5 : 1))), cause, a => (a.age ?? 30) >= 60 || a.health?.sick)); S(w).sterile = { until: day(w) + 180, f: ark ? 0.6 : 0.4, blocked: 0 }; lost.push(...FRONTS.bio.only); }
                log(w, hit ? '🌱 田裡的作物全枯了，連雞都不下蛋了。接下來半年，想生孩子的夫妻都要碰運氣。' : '🌱 作物枯了一半，倉庫裡的糧少了一截，但種子庫保住了。'); }
            if (fo.steam !== 'averted') { const hit = fo.steam === 'hit'; c.winter = hit ? 2 : 1; if (hit) { const alive = shuffle(adults(w)); for (const a of alive.filter(x => !owner(w, x)).slice(0, Math.max(1, Math.round(alive.length * 0.06 * (ark ? 0.5 : 1))))) { if (adults(w).length <= 5) break; try { if (w.leaveTown?.(a.agentId, t('{name}之後往有光的地方去了').replace('{name}', cause))) leave.push(a); } catch (e) {} } lost.push(...FRONTS.steam.only); wrecked = wrecked.concat(wreck(w, 'blacksun', 1)); }
                log(w, hit ? '🔮 以太燈全熄了，天冷得像冰河期，有人說要往南邊找有光的地方。' : '🔮 以太燈只剩一半亮著，晚上大家擠在燈下取暖。'); }
            c.lostOnly = lost; score = hits * 18 + eases * 7 + (dead.length / Math.max(1, pop0)) * 120 + (leave.length / Math.max(1, pop0)) * 50 - (ark ? 10 : 0);
            for (const a of dead) for (const f of famOf(w, a)) if (!f.isDead) { f.addThought?.('wc_grief', w); mem(w, f, '黑日那幾天，我的家人沒能等到天亮。', {}, 9); }
            for (const a of here(w)) { a.moodModifier = (a.moodModifier || 0) + (c.out === 'averted' ? 6 : c.out === 'eased' ? -6 : -14); a.addThought?.(c.out === 'averted' ? 'wc_relief' : 'wc_fear', w); }
        } else if (c.kind === 'zombie') {
            // v9.2.0 喪屍:一部分人變成喪屍(不算死),之後每晚咬人;築了牆少一半;解藥做完全部變回來
            const hit = out === 'hit'; const wall = !!c.prep;
            const n = Math.max(1, Math.round(pop0 * (hit ? 0.06 + Math.random() * 0.02 : 0.03 + Math.random() * 0.01) * (wall ? 0.5 : 1)));
            const zb = c.zb = { ids: [], bit: {}, st: { turned: 0, bitten: 0, killed: 0, hid: 0, cured: 0 } };
            for (const a of shuffle(adults(w)).slice(0, n)) { if (adults(w).length <= 5) break; zTurn(w, c, a, true); }
            if (hit) dead = kill(w, Math.max(0, Math.round(pop0 * 0.02 * (wall ? 0.5 : 1))), cause, a => (a.age ?? 30) >= 60);
            sick = zb.ids.length; wrecked = hit && Math.random() < 0.5 ? wreck(w, 'zombie', 1) : [];
            score = (hit ? 30 : 14) + (dead.length / Math.max(1, pop0)) * 120 + (sick / Math.max(1, pop0)) * 60 - (wall ? 10 : 0);
            for (const a of here(w)) { a.moodModifier = (a.moodModifier || 0) - (hit ? 12 : 6); a.addThought?.('wc_fear', w); }
            for (const id of zb.ids) { const z = w.agents[id]; for (const f of famOf(w, z)) if (!f.isDead && !isZ(w, f)) { f.addThought?.('wc_grief', w); mem(w, f, '{a}變成了喪屍，可是我還認得那件衣服。', { a: z.name }, 9); } }
        } else if (c.kind === 'iceage') {
            // 寒冬:糧食、田地、老人。囤了糧柴的話好很多
            const hit = out === 'hit'; const stock = !!c.prep;
            const food = w.stockpile?.get?.('food') || 0; if (food > 0) w.stockpile.consume('food', Math.round(food * (hit ? 0.5 : 0.25) * (stock ? 0.5 : 1)), w.tickCount, t('冰河期'), 'event');
            for (const pl of (w.farm?.plots || [])) if (pl.state === 'growing' && Math.random() < (hit ? 0.9 : 0.5)) pl.state = 'withered';
            const fr = (hit ? 0.05 + Math.random() * 0.04 : 0.01 + Math.random() * 0.02) * (stock ? 0.4 : 1);
            dead = kill(w, Math.max(hit ? 1 : 0, Math.round(pop0 * fr)), cause, a => (a.age ?? 30) >= 60 || a.health?.sick);
            if (hit) wrecked = wreck(w, 'iceage', 1); // 屋頂被雪壓垮
            if (hit) { const alive = shuffle(adults(w)); const go = alive.filter(a => !owner(w, a)).slice(0, Math.max(1, Math.round(alive.length * (0.06 + Math.random() * 0.06) * (stock ? 0.6 : 1)))); for (const a of go) { if (adults(w).length <= 5) break; try { if (w.leaveTown?.(a.agentId, t('{name}太冷了，往南方逃去').replace('{name}', cause))) leave.push(a); } catch (e) {} } }
            score = (hit ? 35 : 15) + (dead.length / Math.max(1, pop0)) * 120 + (leave.length / Math.max(1, pop0)) * 50 - (stock ? 10 : 0);
            for (const a of dead) for (const f of famOf(w, a)) if (!f.isDead) { f.addThought?.('wc_grief', w); mem(w, f, '那年冬天太冷了，我的家人沒能醒來。', {}, 9); }
            for (const a of here(w)) { a.moodModifier = (a.moodModifier || 0) - (hit ? 12 : 6); a.addThought?.('wc_fear', w); }
            if (stock) for (const a of adults(w).filter(x => x.job?.key === 'farmer').slice(0, 3)) mem(w, a, '幸好當初囤了糧，冬季倉庫救了很多人。', {}, 7);
        } else if (c.kind === 'rift') {
            // 裂隙:人被吸走(算搬走,不算死)、房子被扭走。先搬走的話少很多
            const hit = out === 'hit'; const evac = !!c.prep;
            const n = Math.max(1, Math.round(pop0 * (hit ? 0.06 + Math.random() * 0.05 : 0.02 + Math.random() * 0.02) * (evac ? 0.4 : 1)));
            for (const a of shuffle(adults(w)).slice(0, n)) { if (adults(w).length <= 5) break; const fam = famOf(w, a); try { if (w.leaveTown?.(a.agentId, t('被{name}吸進了紫色的光裡').replace('{name}', cause))) { leave.push(a); for (const f of fam) if (!f.isDead && w.agents[f.agentId]) { f.addThought?.('wc_grief', w); mem(w, f, '{a}被裂隙吸走了，也許哪天還會從天上掉下來。', { a: a.name }, 9); } } } catch (e) {} }
            wrecked = wreck(w, 'rift', hit ? 2 + Math.floor(Math.random() * 2) : 1);
            score = (hit ? 38 : 18) + (leave.length / Math.max(1, pop0)) * 120 - (evac ? 10 : 0);
            for (const a of here(w)) { a.moodModifier = (a.moodModifier || 0) - (hit ? 12 : 6); a.addThought?.('wc_fear', w); }
            c.vanish = leave.map(a => a.name).slice(0, 12);
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
        const out2 = c.out; c.dead += dead.length; c.left += leave.length; const X = S(w); X.st[out2]++; X.st.dead += dead.length; X.st.left += c.left;
        const p = { r: r?.name || t('研究員'), dead: dead.length ? names(dead) : t('沒有人'), s: sick, b: wrecked.length ? wrecked.map(b => t(b.name)).join(t('、')) : t('幾間屋子'), l: c.kind === 'infertile' ? (c.pairs || 1) : leave.length };
        log(w, K.arrive[out2], p, r?.name); news(w, K.arrive[out2], p, 10, dead.map(a => a.name)); note(w, 'arrive_' + out2 + (c.kind === 'infertile' ? '_kid' : c.kind === 'rift' ? '_van' : c.kind === 'zombie' ? '_zb' : ''), String(c.kind === 'rift' ? leave.length : c.kind === 'zombie' ? sick : dead.length));
        for (const a of here(w)) mem(w, a, K.arrive[out2], p, out2 === 'averted' ? 8 : 9);
        // 失傳的學問
        try { if (score > 0 && typeof CALAMITY !== 'undefined' && CALAMITY.regress && !(c.kind === 'blacksun' && !c.lostOnly?.length)) CALAMITY.regress(w, cause, score, c.kind === 'blacksun' ? { only: c.lostOnly } : ONLY[c.kind] ? { only: ONLY[c.kind] } : {}); } catch (e) {} // 黑日:只有沒救起來的那幾線會失傳
        // 災後反應:互助、怪罪(怪當初說沒事、投反對票的人)
        const blameId = (c.fixNo || []).concat(c.deny).find(id => w.agents[id] && !w.agents[id].isDead && owner(w, w.agents[id])) || (c.fixNo || []).find(id => w.agents[id] && !w.agents[id].isDead) || null;
        try { if (typeof AFTERMATH !== 'undefined') AFTERMATH.shock(w, { kind: 'wc_' + c.kind, sev: out2 === 'hit' ? 3 : out2 === 'eased' ? 2 : 1, cause, who: dead, blame: out2 === 'averted' ? null : (blameId ? w.agents[blameId] : null) }); } catch (e) {}
        if (c.kind === 'ai' && out !== 'averted') { c.ctrl = out === 'hit' ? 1 : 0; }
        if ((c.kind === 'nukewar' || c.kind === 'iceage') && out !== 'averted') c.winter = c.kind === 'iceage' && out === 'hit' ? 2 : 1;
    }
    // v9.2.0 喪屍:變成喪屍、被咬、被清剿、解藥
    function zTurn(w, c, a, first) {
        const zb = c.zb; if (!zb || !a || zb.ids.includes(a.agentId)) return; zb.ids.push(a.agentId); delete zb.bit[a.agentId]; zb.st.turned++;
        a.activity = 'wandering'; a.moodModifier = (a.moodModifier || 0) - 20; a._zbFrom = day(w);
        if (!first) { log(w, '🧟 {a}的燒一直沒退。第二天早上，{a}的眼睛變成了混濁的白色。', { a: a.name }, a.name); news(w, '🧟 {a}變成了喪屍', { a: a.name }, 8, [a.name]); }
    }
    function zCureAll(w, c) {
        const zb = c.zb; if (!zb) return; const back = zb.ids.map(id => w.agents[id]).filter(a => a && !a.isDead); zb.st.cured += back.length + Object.keys(zb.bit).length;
        zb.ids = []; zb.bit = {};
        for (const a of back) { a.moodModifier = (a.moodModifier || 0) + 10; a.activity = 'resting'; mem(w, a, '我什麼都不記得了，只記得醒來的時候大家在哭。', {}, 9); for (const f of famOf(w, a)) if (!f.isDead) { aff(f, a, 10); mem(w, f, '{a}回來了。', { a: a.name }, 9); } }
        if (back.length) { log(w, '💉 解藥打進了{n}個喪屍的身體。他們一個一個倒下、發抖，再睜開眼睛的時候，認得自己的家人了。', { n: back.length }); news(w, '💉 喪屍變回人了', {}, 10, back.map(a => a.name)); }
        note(w, 'zcure', String(back.length));
    }
    function zombieDaily(w, c) {
        const zb = c.zb; if (!zb) return; const d = day(w);
        zb.ids = zb.ids.filter(id => w.agents[id] && !w.agents[id].isDead);
        // 解藥還沒做完的話,研究員繼續做
        if (c.prog < 100) { const res = adults(w).filter(a => a.job?.key === 'researcher').length; c.prog = Math.min(100, Math.round((c.prog + (0.8 + 0.4 * Math.min(6, res)) * c.fast * (c.fix ? 1.5 : 1)) * 10) / 10); if (c.prog >= 100) { c.used.fixDone = 1; log(w, '✅ {f}做出來了！', { f: KINDS.zombie.fix.name }); zCureAll(w, c); return; } }
        // 被咬兩天的人變成喪屍
        for (const [id, bd] of Object.entries(zb.bit)) { const a = w.agents[id]; if (!a || a.isDead) { delete zb.bit[id]; continue; } if (d - bd >= 2) zTurn(w, c, a, false); }
        // 夜裡咬人(築了牆少一半);喪屍上限:大人的四成,最少留 5 個人
        const ppl = adults(w).filter(a => !zb.bit[a.agentId]); const cap = Math.round((ppl.length + zb.ids.length) * 0.4);
        for (const id of zb.ids.slice()) { if (zb.ids.length + Object.keys(zb.bit).length >= cap || ppl.length <= 5) break; if (Math.random() > 0.3 * (c.prep ? 0.5 : 1)) continue;
            const z = w.agents[id]; const v = rnd(ppl.filter(a => !zb.bit[a.agentId])); if (!v) break; zb.bit[v.agentId] = d; zb.st.bitten++; ppl.splice(ppl.indexOf(v), 1);
            const fam = famOf(w, v).filter(f => !f.isDead && !isZ(w, f));
            if (fam.length && Math.random() < 0.4) { zb.st.hid++; const f = rnd(fam); mem(w, f, '{a}被咬了。我把傷口包起來，誰也沒說——說了，守衛會把人帶走。', { a: v.name }, 8); mem(w, v, '我被咬了，家人幫我瞞著。', {}, 9); log(w, '🤫 半夜{z}撞開了{a}家的窗。天亮以後，{a}的手臂纏著繃帶，家人說是被狗咬的。', { z: z?.name || t('喪屍'), a: v.name }, v.name); }
            else { log(w, '🩸 {z}在夜裡咬傷了{a}。{a}被帶到診所隔離，大家只能等。', { z: z?.name || t('喪屍'), a: v.name }, v.name); mem(w, v, '我被咬了，再兩天我就會變成那個樣子。', {}, 9); v.addThought?.('wc_fear', w); }
        }
        // 守衛、勇敢的人白天清剿(會死人);家人會擋
        const hunters = adults(w).filter(a => a.job?.key === 'guard' || hasT(a, 'brave'));
        if (zb.ids.length && hunters.length && Math.random() < Math.min(0.6, 0.15 + hunters.length * 0.08) && c.prog < 90) {
            const z = w.agents[rnd(zb.ids)]; const h = rnd(hunters); const fam = famOf(w, z).filter(f => !f.isDead && !isZ(w, f));
            if (fam.length && Math.random() < 0.5) { const f = rnd(fam); aff(f, h, -12); log(w, '🛑 {h}舉起斧頭，{f}衝出來擋在{z}前面：「再等幾天，解藥就快好了！」{h}放下了斧頭。', { h: h.name, f: f.name, z: z.name }, h.name); }
            else { z._deathCause = t('喪屍危機'); try { w.lifecycle?._killNpc?.(w, z); } catch (e) {} zb.ids = zb.ids.filter(id => id !== z.agentId); zb.st.killed++; c.dead++;
                log(w, '🪓 {h}帶著守衛在墓園邊圍住了{z}。結束以後，{h}在雨裡站了很久。', { h: h.name, z: z.name }, h.name); mem(w, h, '我親手結束了{z}。那曾經是我的鄰居。', { z: z.name }, 9);
                for (const f of famOf(w, z)) if (!f.isDead && !isZ(w, f)) { aff(f, h, -20); f.addThought?.('wc_grief', w); mem(w, f, '{h}殺了{z}。我知道那已經不是{z}了，可是我沒辦法原諒。', { h: h.name, z: z.name }, 9); } }
        }
    }
    // 災後世界每天
    function afterDaily(w, c) {
        if (c.zb) zombieDaily(w, c);
        if (c.winter && Math.random() < (c.winter >= 2 ? 0.4 : 0.25)) { for (const p of (w.farm?.plots || [])) if (p.state === 'growing' && Math.random() < 0.15) p.state = 'withered'; for (const a of here(w)) a.moodModifier = (a.moodModifier || 0) - 1; }
        if (c.ctrl) { for (const a of here(w)) if (hasV(a, '自由')) a.moodModifier = (a.moodModifier || 0) - 2; }
    }

    // ---------- 結束 ----------
    function finish(w, c) {
        const X = S(w); const K = KINDS[c.kind]; const d = day(w); const fx = { name: K.name };
        if (c.zb) { // v9.2.0 解藥沒做完的話,剩下的喪屍被圍住、結束
            const left = c.zb.ids.map(id => w.agents[id]).filter(a => a && !a.isDead); for (const id of Object.keys(c.zb.bit)) { const a = w.agents[id]; if (a && !a.isDead) left.push(a); }
            if (left.length) { for (const z of left) { z._deathCause = t('喪屍危機'); try { w.lifecycle?._killNpc?.(w, z); } catch (e) {} c.dead++; } log(w, '🔥 最後的{n}個喪屍被圍在墓園，大家點起火，誰也沒有說話。', { n: left.length }); }
            c.zst = c.zb.st; c.zb = null; }
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
        const had7 = allSeven(); X.surv = X.surv || {}; X.surv[c.kind] = (X.surv[c.kind] || 0) + 1; lsAdd(c.kind);
        if (!had7 && allSeven()) { // v9.3.0 第七種也撐過了:黑日在這一刻被發現
            log(w, '🌑 天文台的老人放下望遠鏡，說了一句沒有人聽懂的話：「七次了……這次輪到太陽自己。」那天中午，大家都覺得陽光好像淡了一點。'); news(w, '🌑 天文台：太陽好像變暗了', {}, 9, []);
            try { w.onWorldCal?.(null, 'found', { kind: 'blacksun' }); } catch (e) {} }
        log(w, '🌍 小鎮撐過了{name}（{o}）。這件事寫進了災厄工坊。', { name: K.name, o: OUT[c.out] }); news(w, '🌍 小鎮撐過了{name}', fx, 9, []);
        try { w.onWorldCal?.(null, 'end', c); } catch (e) {}
    }

    // ---------- 每天 ----------
    function daily(w) {
        if (!w?.observerMode) return; const X = S(w); const d = day(w); if (X.lastDay === d) return; X.lastDay = d;
        if (X.sterile && d >= X.sterile.until) delete X.sterile; // v8.7.0 不孕期滿就解除(以前只有生孩子的時候才檢查)
        const c = X.cur;
        if (!c) { if ((X.next ?? 0) <= d && !w.calamity?.cur && eligible(w) && Math.random() < 1 / 25) { const k = pickKind(w); if (k) begin(w, k, 'nature'); } return; }
        progDaily(w, c); flavor(w, c);
        if (['rumor', 'panic'].includes(c.ph)) { try { const C = CALAMITY.S(w); C.power = Math.min(CALAMITY.CAP, Math.round((C.power + (c.ph === 'panic' ? 1 : 0.5)) * 10) / 10); } catch (e) {} } // 祈禱的人多了,神力也多(樹大招風)
        if (c.ph === 'after' || (c.ph === 'arrive' && c.zb && day(w) > c.pd)) afterDaily(w, c);
        if (d - c.pd >= c.len[c.ph]) { const i = PHASES.indexOf(c.ph); if (i >= PHASES.length - 1) { finish(w, c); return; } c.ph = PHASES[i + 1]; c.pd = d; onEnter(w, c, c.ph); }
        // 投反對票的人記下來
        for (const p of (w.proposals?.items || [])) if (p.kind === 'wc_fix' && !p._wcNoted && p.status !== 'open' && p.status !== 'shelved') { p._wcNoted = true; c.fixNo = Object.entries(p.votes || {}).filter(([, v]) => v === 'against').map(([id]) => id).slice(0, 30); }
    }

    // ---------- 提案:通過了做什麼、怎麼投 ----------
    function enact(w, p) {
        const c = S(w).cur; if (!c) return t('災厄已經過去了');
        const K = KINDS[c.kind];
        if (p.kind === 'wc_fix') { c.fix = day(w); const R = w.research; if (R?.current && R.projects[R.current]) { c.paused = R.current; R.projects[R.current].status = 'available'; R.current = null; } note(w, 'fix'); log(w, '🔬 研究員們把手上的研究全放下了，日夜趕工「{f}」。', { f: K.fix.name }); return fill('研究員開始全力研究「{f}」', { f: K.fix.name }); }
        if (p.kind === 'wc_bank') { c.prep = day(w); note(w, 'bank'); log(w, '🧊 精卵庫蓋好了，研究員在地下室養著第一個人工子宮。有人說這是希望，有人在門口畫十字。'); for (const a of adults(w)) if (devout(w, a) && Math.random() < 0.4) mem(w, a, '把孩子放在玻璃罐裡養，這真的是對的嗎？', {}, 5); return t('精卵庫蓋好了'); }
        if (p.kind === 'wc_stock') { c.prep = day(w); note(w, 'stock'); log(w, '🪵 冬季倉庫堆滿了木柴和醃菜，全鎮的人排隊把自家的存糧搬進去，連小孩都來幫忙。'); return t('冬季倉庫堆滿了'); }
        if (p.kind === 'wc_evac') { c.prep = day(w); note(w, 'evac'); const mv = adults(w).filter(() => Math.random() < 0.25).slice(0, 6); for (const a of mv) { a.moodModifier = (a.moodModifier || 0) - 2; mem(w, a, '為了躲裂隙，我們家暫時搬到鎮的另一頭。', {}, 6); } log(w, '🧳 住在裂隙底下的{n}戶人家搬到了鎮的另一頭，空房子用木板封了起來。', { n: Math.max(1, mv.length) }); return t('裂隙周邊的人家搬走了'); }
        if (p.kind === 'wc_ark') { c.prep = day(w); note(w, 'ark'); log(w, '🛖 地下方舟蓋好了：一排排的糧袋、一箱箱的種子、一台手搖發電機，最裡面點著一盞小小的以太燈。'); return t('地下方舟蓋好了'); }
        if (p.kind === 'wc_focus') { const f = FRONTS[p.front] ? p.front : null; if (!c.fronts || !f) return ''; c.focus = f; note(w, 'focus', FRONTS[f].name); log(w, '🎯 研究員決定先救「{f}」，另外兩線只留下幾個人。有人鬆了一口氣，有人說這是在賭命。', { f: FRONTS[f].name });
            for (const a of adults(w)) if (FJOB[f].includes(a.job?.key)) a.moodModifier = (a.moodModifier || 0) + 2; else if (Object.entries(FJOB).some(([g, js]) => g !== f && js.includes(a.job?.key)) && Math.random() < 0.4) mem(w, a, '他們決定先救「{f}」，我們這一行的人只能自求多福。', { f: FRONTS[f].name }, 6);
            return fill('研究員先救「{f}」', { f: FRONTS[f].name }); }
        if (p.kind === 'wc_wall') { c.prep = day(w); note(w, 'wall'); log(w, '🧱 鎮的四周築起了木牆和拒馬，守衛排了夜班表，每個路口都掛著火把。'); return t('圍牆築好了'); }
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
        } else if (p.kind === 'wc_ark') { // 顧家的人、老人贊成;老闆和貪心的人嫌太花錢
            s = 0.4 + (wn ? 2 : 0) + (kids ? 1.5 : 0) + ((a.age ?? 30) >= 60 ? 1 : 0) + (c.ph === 'panic' ? 1.5 : 0) - (dn ? 2.5 : 0) - (owner(w, a) ? 0.8 : 0) - (hasT(a, 'greedy') ? 0.8 : 0);
            why = s > 0 ? (kids ? 'wc_kids' : 'wc_fear') : (dn ? 'wc_deny' : 'wc_cost');
        } else if (p.kind === 'wc_focus') { // 自己這一行被救的贊成,別的線的人反對
            const mine = FJOB[p.front]?.includes(k); const other = Object.entries(FJOB).some(([g, js]) => g !== p.front && js.includes(k));
            s = 0.2 + (mine ? 2.2 : 0) - (other ? 1.6 : 0) + (wn ? 0.6 : 0) + (c.ph === 'panic' ? 0.8 : 0) - (dn ? 1.5 : 0);
            why = s > 0 ? (mine ? 'wc_mine' : 'wc_fear') : (other ? 'wc_other' : dn ? 'wc_deny' : 'wc_cost');
        } else if (p.kind === 'wc_wall') { // 守衛、顧家的人贊成;開店的嫌生意少
            s = 0.4 + (wn ? 2 : 0) + (kids ? 1.2 : 0) + (k === 'guard' ? 1.5 : 0) + (c.ph === 'panic' ? 1.5 : 0) - (dn ? 2.5 : 0) - (owner(w, a) ? 0.8 : 0) - (k === 'merchant' ? 0.8 : 0);
            why = s > 0 ? (kids ? 'wc_kids' : 'wc_fear') : (dn ? 'wc_deny' : 'wc_cost');
        } else if (p.kind === 'wc_unplug') {
            const laid = w.tech?.mk?.[a.agentId] === 'laid';
            s = 0.2 + (wn ? 1.5 : 0) + (laid ? 3 : 0) + (hasV(a, '自由') ? 1.5 : 0) + (devout(w, a) ? 0.8 : 0) + (stanceOf(w, a) === 'conservative' ? 1 : 0) + (c.ph === 'panic' ? 1 : 0)
                - (owner(w, a) ? 2 : 0) - (k === 'researcher' ? 1.5 : 0) - (dn ? 2 : 0) - (stanceOf(w, a) === 'progressive' ? 1 : 0);
            why = s > 0 ? (laid ? 'path_job' : hasV(a, '自由') ? 'cal_freedom' : 'wc_fear') : (owner(w, a) ? 'boss' : k === 'researcher' ? 'tech_slow' : dn ? 'wc_deny' : 'growth');
        } else if (p.kind === 'wc_bank') { // 想要孩子的年輕人、醫生贊成;虔誠的人覺得違反天意
            const young = (a.age ?? 30) >= 18 && (a.age ?? 30) <= 40;
            s = 0.3 + (wn ? 1.5 : 0) + (young ? 1.2 : 0) + (hasV(a, '家庭') ? 1.5 : 0) + (k === 'doctor' || k === 'researcher' ? 1 : 0) + (c.ph === 'panic' ? 1 : 0)
                - (devout(w, a) ? 2 : 0) - (dn ? 2 : 0) - (stanceOf(w, a) === 'conservative' ? 0.8 : 0);
            why = s > 0 ? (hasV(a, '家庭') || young ? 'wc_kids' : 'wc_fear') : (devout(w, a) ? 'bio_god' : dn ? 'wc_deny' : 'oldways');
        } else if (p.kind === 'wc_stock') { // 農夫、顧家的人贊成;老闆和貪心的人嫌浪費
            s = 0.4 + (wn ? 1.8 : 0) + (k === 'farmer' ? 1.2 : 0) + (kids ? 1 : 0) + ((a.age ?? 30) >= 60 ? 0.8 : 0) + (c.ph === 'panic' ? 1.5 : 0) - (dn ? 2.5 : 0) - (owner(w, a) ? 0.8 : 0) - (hasT(a, 'greedy') ? 0.6 : 0);
            why = s > 0 ? (kids ? 'wc_kids' : 'wc_fear') : (dn ? 'wc_deny' : 'wc_cost');
        } else if (p.kind === 'wc_evac') { // 搬家很麻煩:開店的、上了年紀的不想搬
            s = 0.2 + (wn ? 2 : 0) + (kids ? 1.2 : 0) + (hasT(a, 'neurotic') || hasT(a, 'pessimist') ? 0.8 : 0) + (c.ph === 'panic' ? 1.5 : 0) - (dn ? 2.5 : 0) - (owner(w, a) ? 1.2 : 0) - ((a.age ?? 30) >= 65 ? 0.8 : 0);
            why = s > 0 ? (kids ? 'wc_kids' : 'wc_fear') : (owner(w, a) ? 'boss' : dn ? 'wc_deny' : 'wc_cost');
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
        const X = S(w); const c = X.cur; const kinds = Object.entries(KINDS).map(([k, K]) => { const on = unlocked(k); const hid = K.path === 'all' && !on; // v9.3.0 黑日:七種都撐過才會被發現,之前只是一張蓋著的牌
            return hid ? { key: k, path: K.path, pathName: '❔', icon: '❔', name: '？？？', short: t('還沒有人知道它是什麼'), fix: '？？？', prep: '', on: false, hidden: true, seven: SEVEN.filter(x => lsGet().includes(x)).length, can: { ok: false, why: 'hidden' } }
                : { key: k, path: K.path, pathName: t(PATHN[K.path] || ''), icon: K.icon, name: t(K.name), short: t(K.short), fix: t(K.fix.name), prep: K.prep ? K.prep.icon + ' ' + t(K.prep.name) : '', on, can: canLab(w, k) }; });
        const Z = X.sterile && X.sterile.until > day(w) ? { f: Math.round(X.sterile.f * 100), left: X.sterile.until - day(w), blocked: X.sterile.blocked || 0 } : null;
        const base = { kinds, cost: LAB_COST, sterile: Z, hist: X.hist.map(h => ({ ...h, icon: KINDS[h.kind]?.icon || '', name: t(KINDS[h.kind]?.name || ''), outName: t(OUT[h.out] || '') })), st: X.st };
        if (!c) return base;
        const K = KINDS[c.kind]; const alive = (ids) => ids.filter(id => w.agents[id] && !w.agents[id].isDead).length;
        return Object.assign(base, { cur: { kind: c.kind, icon: K.icon, name: t(K.name), short: t(K.short), src: c.src, ph: c.ph, idx: PHASES.indexOf(c.ph), phases: PHASES.map(p => ({ key: p, icon: PH[p].icon, name: t(PH[p].name) })), day: day(w) - c.d0 + 1, left: leftDays(w, c),
            prog: Math.round(c.prog), fix: !!c.fix, fixName: t(K.fix.name), fixIcon: K.fix.icon, prep: !!c.prep, prepName: t(K.prep.name), prepIcon: K.prep.icon, deny: alive(c.deny), warn: alive(c.warn), dead: c.dead, left2: c.left - (c.vanish?.length || 0), van: c.vanish?.length || 0, out: c.out, outName: c.out ? t(OUT[c.out]) : '', log: c.log.slice(-8), fronts: c.fronts ? Object.keys(FRONTS).map(f => ({ key: f, icon: FRONTS[f].icon, name: t(FRONTS[f].name), prog: Math.round(c.fronts[f]), out: c.frontOut?.[f] || null, outName: c.frontOut?.[f] ? t(OUT[c.frontOut[f]]) : '', focus: c.focus === f })) : null, zb: c.zb ? { n: c.zb.ids.length, bit: Object.keys(c.zb.bit).length, killed: c.zb.st.killed, hid: c.zb.st.hid, cured: c.zb.st.cured } : null } });
    }
    function townBrief(w) {
        const c = w?.worldcal?.cur; if (!c) { const h = w?.worldcal?.hist?.[0]; return h && day(w) - h.end <= 120 ? fill('不久前撐過了{name}（{o}）', { name: KINDS[h.kind]?.name || '', o: OUT[h.out] || '' }) : ''; }
        const K = KINDS[c.kind];
        if (c.ph === 'omen') return t('最近鎮上有些說不出的怪事');
        if (c.zb && c.zb.ids.length) return fill('喪屍在鎮上遊蕩（{n}個），大家天黑就閂門、守衛輪班清剿，研究員在趕解藥', { n: c.zb.ids.length });
        if (c.ph === 'arrive' || c.ph === 'after') return fill('{name}剛降臨，小鎮在收拾殘局', { name: K.name });
        return fill('學者說{name}要來了，大家在吵要不要準備', { name: K.name });
    }
    function brief(w, a) {
        const c = w?.worldcal?.cur; if (!c || c.ph === 'omen' || !a) return '';
        if (c.zb && c.zb.bit[a.agentId]) return t('我被咬了，再過不久就會變成喪屍');
        if (c.zb && c.zb.ids.length) return fill('鎮上有{n}個喪屍，天黑以後不敢出門', { n: c.zb.ids.length });
        const K = KINDS[c.kind]; if (c.deny.includes(a.agentId)) return fill('我覺得{name}只是危言聳聽', { name: K.name }); if (c.warn.includes(a.agentId)) return fill('我很怕{name}，覺得要趕快準備', { name: K.name });
        return '';
    }
    return { isZombie: isZ, zIds, FRONTS, SEVEN, allSeven, KINDS, PHASES, PH, LEN, FAST, OUT, LAB_COST, S, unlocked, active, weights, pickKind, eligible, era6, begin, leftDays, daily, enact, vote, canLab, release, view, townBrief, brief, _t: { progDaily, onEnter, arrive, finish, flavor, zombieDaily, zTurn, zCureAll } };
})();

if (typeof THOUGHT_DEFS !== 'undefined') Object.assign(THOUGHT_DEFS, {
    wc_fear: { mood: -5, opinion: 0, days: 5, label: t('怕世界末日') },
    wc_grief: { mood: -15, opinion: 0, days: 20, label: t('家人死在世界級災厄裡') },
    wc_relief: { mood: 8, opinion: 0, days: 5, label: t('世界末日沒有來') },
    wc_childless: { mood: -10, opinion: 0, days: 20, label: t('可能再也不會有孩子了') },
});
if (typeof PROPOSAL_KINDS !== 'undefined') Object.assign(PROPOSAL_KINDS, { wc_fix: { icon: '🔬', label: '全力研究主對策' }, wc_shelter: { icon: '🏚️', label: '蓋防空洞' }, wc_unplug: { icon: '🧯', label: '拔掉 AI 全智能體' }, wc_bank: { icon: '🧊', label: '精卵庫與人工子宮' }, wc_stock: { icon: '🪵', label: '囤糧囤柴' }, wc_evac: { icon: '🧳', label: '遷離裂隙周邊' }, wc_wall: { icon: '🧱', label: '築牆封鎖' }, wc_ark: { icon: '🛖', label: '地下方舟' }, wc_focus: { icon: '🎯', label: '先救哪一線' } });
if (typeof VOTE_WHY !== 'undefined') Object.assign(VOTE_WHY, { wc_fear: '怕世界末日真的來', wc_kids: '為了孩子', wc_deny: '覺得是危言聳聽', wc_cost: '代價太大', wc_mine: '這一線跟我的工作有關', wc_other: '那我這一行怎麼辦' });
if (typeof AFTERMATH !== 'undefined') Object.assign(AFTERMATH.CAUSE, { wc_nukewar: '核子世界大戰', wc_aliens: '外星文明入侵', wc_ai: 'AI 控制全人類', wc_infertile: '全球不孕', wc_iceage: '冰河期', wc_rift: '以太裂隙', wc_zombie: '喪屍危機', wc_blacksun: '黑日' });
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
// v8.6.0 全球不孕:不孕期間,孩子只有一部分生得出來(精卵庫在的話多一點)
if (typeof LifecycleSystem !== 'undefined' && LifecycleSystem.prototype._birthChild) {
    const _bc = LifecycleSystem.prototype._birthChild;
    LifecycleSystem.prototype._birthChild = function (world, ...rest) {
        const [pa, pb] = rest; let first = false;
        try { const Z = world?.worldcal?.sterile; if (Z) { const d = world._absDay ? world._absDay() : 0; if (d >= Z.until) delete world.worldcal.sterile; else if (Math.random() >= Z.f) { Z.blocked = (Z.blocked || 0) + 1; if (pa && pb && Math.random() < 0.35) world.logMessageT?.('event', '💔 {a}和{b}又去了一次診所，醫生還是搖搖頭。', { a: pa.name, b: pb.name }, pa.name); return null; } else if (Z.blocked && !Z.first) { Z.first = 1; first = true; } } } catch (e) {}
        const r = _bc.call(this, world, ...rest);
        if (first && pa && pb) try { world.logMessageT?.('event', '🍼 {a}和{b}的孩子出生了——是好久以來鎮上的第一個嬰兒，全鎮的人都跑來看，產婆哭得比孩子還大聲。', { a: pa.name, b: pb.name }, pa.name); } catch (e) {}
        return r;
    };
}

// v9.2.0 喪屍:不去上班、不聊天、不投票;白天在墓園附近遊蕩,晚上在廣場與街上晃。3D 是綠皮膚、破衣服、手往前伸
if (typeof Agent !== 'undefined') {
    const AP = Agent.prototype; const _dl = AP._decideLocation;
    AP._decideLocation = function (hour, ...rest) {
        const w = typeof window !== 'undefined' ? window.rimtownApp?.world : null;
        if (w && WORLDCAL.isZombie(w, this)) { const L = w.townMap?.locations || {}; const night = hour >= 20 || hour < 5; this.targetLocation = night ? (L.town_square ? 'town_square' : this.targetLocation) : (L.graveyard ? 'graveyard' : L.town_square ? 'town_square' : this.targetLocation); this.activity = 'wandering'; return; }
        return _dl.call(this, hour, ...rest);
    };
    const _si = AP._trySocialInteraction;
    if (_si) AP._trySocialInteraction = function (world, ...rest) { if (world?.worldcal?.cur?.zb && WORLDCAL.isZombie(world, this)) return; return _si.call(this, world, ...rest); };
}
if (typeof World !== 'undefined') {
    const _gal = World.prototype.getAgentsAtLocation;
    World.prototype.getAgentsAtLocation = function (locId) { const r = _gal.call(this, locId); return this.worldcal?.cur?.zb?.ids?.length ? r.filter(a => !WORLDCAL.isZombie(this, a)) : r; };
}
if (typeof ProposalSystem !== 'undefined' && ProposalSystem.prototype._npcs) {
    const _np = ProposalSystem.prototype._npcs;
    ProposalSystem.prototype._npcs = function (w, ...rest) { const r = _np.call(this, w, ...rest); return w?.worldcal?.cur?.zb?.ids?.length ? r.filter(a => !WORLDCAL.isZombie(w, a)) : r; };
}
if (typeof LOOK !== 'undefined') {
    const _of = LOOK.of, _sig = LOOK.sig;
    LOOK.of = function (w, a) { const r = _of(w, a); try { if (r && WORLDCAL.isZombie(w, a)) r.zb = 1; } catch (e) {} return r; };
    LOOK.sig = (p) => _sig(p) + (p?.zb ? 'Z' : '');
}
