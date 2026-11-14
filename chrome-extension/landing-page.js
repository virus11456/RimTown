// RimTown - landing-page.js：官網首頁(v9.29.0 從 app-landing.js 拆出來重新設計)。只有 index.html 載入,遊戲頁不載。
// 用 Object.assign 掛到 RimTownApp.prototype；必須在 app-landing.js 之後載入（index.html／sw.js 都要列）。
// 版面:首屏 3D 小鎮(村民自己拿主意) → 這是什麼遊戲 → 一個決定怎麼來 → 自己決定哪些事 → AI 開著與沒開 → 一件事牽動整個鎮
//      → 從一個人到整個世界(鏡頭隨捲動拉遠) → 七章細節 → 村民的大腦 → 常見問題 → 更新紀錄 → 路線圖
'use strict';
// 線條圖示(24×24,跟著文字顏色)。首頁不用表情符號當圖示
const LP_ICONS = {
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    pulse: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7zM3.2 12H9l1-2 2 5 2-7 1.5 4h5.3',
    landmark: 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z',
    coins: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8',
    dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
    trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
    megaphone: 'M3 11l18-5v12L3 14zM11.6 16.8a3 3 0 1 1-5.8-1.6',
    paper: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8z',
    flask: 'M10 2v7.3M14 9.3V2M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0M5.5 16h13',
    compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    spark: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z',
    gem: 'M6 3h12l4 6-10 13L2 9zM11 3L8 9l4 13 4-13-3-6M2 9h20',
    beaker: 'M4.5 3h15M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3M6 14h12',
    church: 'M12 2v5M10 4h4M8 22V11l4-4 4 4v11M4 22v-7l4-2M20 22v-7l-4-2M2 22h20M10 22v-4a2 2 0 0 1 4 0v4',
    map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    cards: 'M6 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM18.5 6.5l1.4.4a2 2 0 0 1 1.4 2.4L19 18M10.5 9l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z',
    bulb: 'M9 18h6M10 22h4M15.1 14c.2-1 .6-1.7 1.4-2.5A4.7 4.7 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.2 1.5 1.4 2.5',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
    scale: 'M12 3v18M5 21h14M3 7h18M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0z',
    home: 'M3 10.5L12 3l9 7.5V21H3zM9 21v-6h6v6',
    town: 'M3 21V9l5-3v15M8 21V3l8 4v14M16 21V11l5 2v8M2 21h20',
    city: 'M3 21V7h6v14M9 21V3h7v18M16 21v-9h5v9M2 21h20',
    castle: 'M4 21V5h3v3h3V5h4v3h3V5h3v16zM10 21v-5a2 2 0 0 1 4 0v5',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    down: 'M12 5v14M6 13l6 6 6-6',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    chev: 'M6 9l6 6 6-6',
    monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
    phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
    cloud: 'M17.5 19a4.5 4.5 0 0 0 .5-9A7 7 0 0 0 4.3 12.2 3.5 3.5 0 0 0 5.5 19z',
    idcard: 'M3 5h18v14H3zM8 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 16a2.6 2.6 0 0 1 5 0M14 10h4M14 14h3',
    list: 'M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12',
    sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4',
    wallet: 'M3 6a2 2 0 0 1 2-2h13v4M3 6v12a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1-2-2zM16.5 14h.01',
    heart: 'M12 20.5l-7.2-7A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 7.2 6.9z',
    mask: 'M3 5c3 1.5 6 1.5 9 0 3 1.5 6 1.5 9 0v6a9 9 0 0 1-18 0zM7.5 10.5h2.5M14 10.5h2.5',
    case: 'M3 8h18v12H3zM9 8V5h6v3M3 13h18',
    flag: 'M5 21V4M5 4h12l-2.5 4 2.5 4H5',
    vote: 'M4 13h16v8H4zM7 13l2-8h6l2 8M10 8.5l1.5 1.5 3-3',
    key: 'M15.5 14a5.5 5.5 0 1 0-5.2-3.7L3 17.6V21h3.4l1.4-1.4v-2h2l1.9-1.9a5.5 5.5 0 0 0 3.8-1.7zM16.5 7.5h.01',
    wrench: 'M14.7 6.3a4 4 0 0 0 5 5L21 12.6a6 6 0 0 1-7.7 3.4L7 22.3 1.7 17l6.3-6.3A6 6 0 0 1 11.4 3z',
};
const lpIcon = (name, cls) => `<svg class="lp-ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${LP_ICONS[name] || LP_ICONS.spark}"/></svg>`;
// 每個主題用哪個圖示
const LP_BAND_ICON = { people: 'users', health: 'pulse', politics: 'landmark', money: 'coins', casino: 'dice', shares: 'trend', union: 'megaphone', power: 'paper', growth: 'flask', path: 'compass', doom: 'globe', aftermath: 'flame', ways: 'chat', myth: 'spark', aether: 'gem', lab: 'beaker', culture: 'church', world: 'map', watch: 'eye', god: 'cards' };

Object.assign(RimTownApp.prototype, {
    _renderLanding() {
        const el = document.getElementById('landing');
        if (!el) return;
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const ver = typeof RIMTOWN_APP_VERSION !== 'undefined' ? RIMTOWN_APP_VERSION : '';
        const loggedIn = !!this.auth.loggedIn;
        const L = I18N.getLang() === 'en' ? 'en' : 'zh';
        const X = (zh, en) => (L === 'en' ? en : zh);
        const ic = lpIcon;
        const cta = loggedIn
            ? `<button class="landing-btn primary" id="landing-continue" disabled>${t('載入中…')}</button>
               <button class="landing-btn secondary" id="landing-logout">${t('登出')}</button>`
            : `<button class="landing-btn primary" id="landing-register">${t('註冊')}${ic('arrow')}</button>
               <button class="landing-btn secondary" id="landing-login">${t('登入')}</button>`;
        const stats = [['75', X('個選擇點由本人決定', 'choices made by the villager')], ['57', X('項科技', 'technologies')], ['6', X('個時代', 'eras')], ['4', X('級城鎮', 'town tiers')], ['50+', X('張事件卡', 'event cards')], ['8', X('種神話基因', 'mythic genes')], ['6', X('級社會階層', 'social classes')]];
        // 每一段:錨點、圖示、顏色、小標、標題、導言、重點(標題＋說明)、遊戲裡會看到的紀錄、新功能版本
        const bands = [
            { id: 'people', c: '#f28c4a', k: X('村民', 'Villagers'), new: '6.97',
              h: X('每個人都不一樣，也都記得', 'Everyone is different, and everyone remembers'),
              lead: X('村民有個性、需求、記憶和自己的心事。他們聊天、八卦、交朋友、戀愛結婚，也會說謊、設局、記仇。長相跟著名字走：髮型、眼睛、鬍子、衣服、胖瘦高矮每人不同；小孩個子小、老人頭髮花白、窮人衣服打補丁。',
                  'Villagers have personalities, needs, memories and private worries. They chat, gossip, make friends, fall in love and marry; they also lie, scheme and hold grudges. Looks follow their name: hair, eyes, beards, clothes and build differ from person to person; children are small, elders go grey, the poor wear patched clothes.'),
              pts: [[X('記得誰對他好', 'Who was kind to them'), X('每人 500 條記憶。記仇比記恩久，太久沒來往的人會慢慢淡忘，最多只顧得上一百五十個人。', '500 memories each. Grudges last longer than favors; people they never see slowly fade, and nobody keeps track of more than about 150 others.')],
                    [X('戀愛、婚禮與葬禮', 'Love, weddings and funerals'), X('告白、訂婚、辦婚宴收禮金，前任可能來鬧場；有人過世，家屬辦葬禮、念悼詞，每年還有人去掃墓。', 'Confessions, engagements, wedding feasts and gifts, an ex who shows up uninvited; when someone dies the family holds a funeral, gives a eulogy, and people visit the grave each year.')],
                    [X('陰暗面', 'The dark side'), X('講壞話、說謊、栽贓、搶功都會發生，被拆穿就要道歉，不被原諒就報復。真相頁只有你看得到。', 'Badmouthing, lies, framing and stealing credit all happen; when caught they apologize, and if not forgiven they take revenge. Only you can see the truth page.')]],
              log: [['08:15', X('林美玲把烤好的麵包分給隔壁的小豆子。', 'Lin Meiling shares fresh bread with little Doudou next door.')], ['12:40', X('王大偉還記得去年冬天被借錢不還的事，對劉阿福冷冷的。', 'Wang Dawei still remembers the unpaid loan from last winter and gives Liu Afu the cold shoulder.')], ['19:20', X('陳婉君在廣場向黃淑芬告白，旁邊的人都在起鬨。', 'Chen Wanjun confesses to Huang Shufen in the square while the crowd cheers.')]] },
            { id: 'health', c: '#5ec2e6', k: X('身體與醫療', 'Health and medicine'), new: '7.4',
              h: X('會生病、會受傷，看病要花錢', 'People get sick and hurt, and care costs money'),
              lead: X('每個人有眼、手、腳、心、肺五個部位：眼睛不好研究得慢，手受傷做事慢，腳不好走得慢，心肺差的人活不久、睡不好。老化、職業病、打架、工傷和傳染病都會讓人生病受傷。看診、吃藥、動手術、器官移植都要錢：自己付、家人付、跟銀行借、工會互助，或是村民提案用公費補助。',
                  'Everyone has five body parts: eyes, hands, legs, heart and lungs. Poor eyes slow research, hurt hands slow work, bad legs slow walking, and a weak heart or lungs means a shorter life and poor sleep. Ageing, occupational illness, fights, workplace accidents and epidemics all take their toll. Check-ups, medicine, surgery and transplants cost money: paid by the patient, the family, a bank loan, the union fund, or public aid if the villagers vote for it.'),
              pts: [[X('眼鏡、拐杖、義肢', 'Glasses, canes, prosthetics'), X('治不好的部位可以補救一部分；殘疾會影響找工作，有些老闆就是不雇。', 'What cannot be cured can be partly made up for; disabilities make finding work harder, and some bosses simply will not hire.')],
                    [X('等候名單與插隊', 'Waiting lists and queue-jumping'), X('器官要等有人捐；有錢人會塞錢插隊，被發現就是醜聞。', 'Organs wait for donors; the rich slip money to jump the queue, and it is a scandal when it comes out.')],
                    [X('第五時代：生技', 'Fifth era: biotech'), X('城市研究完機械時代、蓋了研究院，就能研究器官移植、疫苗與基因工程。', 'Once a city finishes the machine era and builds an institute, it can research transplants, vaccines and genetic engineering.')]],
              log: [['09:10', X('礦工老陳咳了一整個月，醫生說是礦坑的粉塵傷了肺。', 'Old Chen the miner has coughed for a month; the doctor says the mine dust has damaged his lungs.')], ['13:30', X('王大偉跟人打了一架，手骨折了，這週沒辦法上工。', 'Wang Dawei got into a fight and broke his hand; he cannot work this week.')], ['16:00', X('心臟移植等候名單：富商塞了 200 銀幣，排到了最前面。', 'Heart transplant list: a rich merchant slips 200 silver and jumps to the front.')]] },
            { id: 'politics', c: '#7fb3f5', k: X('政治', 'Politics'),
              h: X('提案、投票、選舉，全是村民自己來', 'Proposals, votes and elections, all run by the villagers'),
              lead: X('想蓋穀倉、調稅率、訂最低工資，都是村民自己提案、全鎮投票，首長拍板並說出理由。大事要議會表決，首長否決可以被三分之二推翻；每年改選，有辯論和從政履歷。長成王都之後還有國王、王令、政變和起義。',
                  'Granaries, tax rates, a minimum wage: villagers propose, the town votes, and the leader decides and explains why. Big decisions go to the council, which can overturn a veto with two thirds; there are yearly elections with debates and political careers. Grow into a capital and there is a king, royal decrees, coups and uprisings.'),
              pts: [[X('L 編號提案', 'Numbered proposals'), X('每個提案都有編號、提案人、票數與每個人的投票理由，執行之後還追蹤成效。', 'Each proposal has a number, a proposer, a vote count and every voter\'s reason, and its results are tracked after it passes.')],
                    [X('議會與否決', 'Council and veto'), X('城鎮越大議會越大；議員每年春天改選，出缺由落選者遞補。', 'Bigger towns have bigger councils; seats are re-elected each spring and vacancies go to the runners-up.')],
                    [X('罷免與下台', 'Recall and resignation'), X('醜聞累積、民怨夠大就提前改選；被罷免的人兩個月內不能再參選。', 'Enough scandal and anger triggers an early election; a recalled leader cannot run again for two months.')]],
              log: [['10:00', X('L12「蓋第二座穀倉」通過：14 票贊成、5 票反對。', 'L12 "Build a second granary" passes: 14 for, 5 against.')], ['10:05', X('鎮長：「去年冬天差點斷糧，這筆錢該花。」', 'Mayor: "We almost ran out of food last winter. This is money well spent."')], ['16:30', X('議會以 4 比 1 推翻了鎮長對最低工資案的否決。', 'The council overturns the mayor\'s veto on the minimum wage, 4 to 1.')]] },
            { id: 'money', c: '#f2c14e', k: X('經濟與階級', 'Money and class'), new: '8.9',
              h: X('錢會流動，也會往有錢人那邊流', 'Money moves, and it moves toward the rich'),
              lead: X('每個村民都有自己的錢包：領工資、繳稅，三餐、衣服、柴火自己買，付不起就挨餓受凍。產業有老闆，老闆發薪也會壓薪；房子有房東，租不起就被趕出去睡廣場。存款有利息、放款收利息，銀行也會擠兌。每一塊錢都講得出是誰付的，從外地進來的錢一定是賣了東西換來的。這是一個不會特別保護窮人的小鎮。',
                  'Every villager has a wallet: they earn wages, pay taxes, buy their own meals, clothes and firewood, and go hungry or cold when they can\'t. Businesses have owners who pay wages and squeeze them; houses have landlords, and those who can\'t pay rent end up sleeping in the square. Savings earn interest, loans charge it, and banks can suffer runs. Every coin can be traced to whoever paid it, and money from outside only comes in when something is sold. This town does not go out of its way to protect the poor.'),
              pts: [[X('通貨膨脹', 'Inflation'), X('大家手上的錢越多，東西就越貴；工資慢慢跟上但總是比物價慢，存錢的人吃虧。工資落後太多，工人就提「工資跟上物價」，老闆多半反對。', 'The more money people hold, the pricier everything gets; wages catch up slowly but always lag, so savers lose out. When wages fall too far behind, workers propose that wages keep up with prices, and owners mostly vote against.')],
                    [X('錢花去哪', 'Where money goes'), X('有才藝的人在廣場說書討賞，有錢人宴客、請畫師畫像、去外地旅遊，家裡出學費送孩子去外地讀書；繳不出學費就輟學，讀完回來工資高一成五。', 'Talented villagers perform in the square for tips; the rich host feasts, commission portraits and travel abroad, and families pay to send children to school out of town. Miss a payment and the child drops out; those who finish earn 15% more.')],
                    [X('包工程', 'Public works contracts'), X('公庫有錢就撥款修路、修橋、蓋水渠、築城牆，工匠競標、得標的人賺差價；跟貪心鎮長熟的人可能被內定，偷工減料的工程日後會出事。', 'A flush treasury funds roads, bridges, aqueducts and town walls; craftsmen bid and the winner keeps the margin. Friends of a greedy mayor may get the job, and corner-cutting projects fail later.')],
                    [X('跟銀行借錢創業', 'Bank loans to start up'), X('銀行拿存款放貸：想開店卻找不到合夥人的人跟銀行借本錢，缺房子時有工作的人借錢蓋出租屋，四十五天內慢慢還。', 'The bank lends out deposits: would-be shopkeepers without a partner borrow their start-up money, and when housing is short, working villagers borrow to build rentals and repay within 45 days.')]],
              log: [['07:00', X('劉阿福這個月欠了三週房租，被房東趕了出來。', 'Liu Afu is three weeks behind on rent and gets evicted.')], ['12:00', X('食堂老闆把工資壓到每天 3 銀幣。', 'The eatery owner cuts wages to 3 silver a day.')], ['18:10', X('物價水準到了原本的 1.5 倍，存了一輩子錢的老周心裡發慌。', 'The price level reaches 1.5× its start; old Zhou, who saved all his life, starts to panic.')], ['19:30', X('阿德標下修橋工程，偷偷少用了一成木料。', 'Ade wins the bridge contract and quietly uses a tenth less timber.')]] },
            { id: 'casino', c: '#e85d8a', k: X('賭場', 'Casino'), new: '8.9',
              h: X('十賭九輸，偶爾有人一夕致富', 'The house wins, and now and then someone gets rich overnight'),
              lead: X('小鎮長成城鎮以後，有野心的有錢人可能開一家賭場。有錢人小賭當娛樂，窮人一把押上大半家當；輸了想翻本，越輸押越大，甚至跟銀行借錢去賭。長期下來莊家總是贏，但大獎太大時，莊家也會被搬空。',
                  'Once the village grows into a town, an ambitious rich villager may open a casino. The rich bet small for fun while the poor stake most of what they own; losers chase their losses with ever bigger bets, even borrowing from the bank. Over time the house always wins, but a big enough jackpot can clean out the house too.'),
              pts: [[X('一夕致富', 'Rich overnight'), X('中大獎的人上報紙，旁人眼紅也跑去試手氣；莊家付不出大獎就傾家蕩產、賭場關門。', 'Jackpot winners make the paper and envious neighbors rush to try their luck; if the house can\'t pay, the owner is ruined and the casino closes.')],
                    [X('家破人亡', 'Ruined families'), X('輸光的人心情跌到谷底，配偶可能帶著孩子離開，欠銀行錢的人連夜跑路。', 'Those who lose everything hit rock bottom; spouses may leave with the children, and those who owe the bank flee town at night.')],
                    [X('禁賭提案', 'A gambling ban'), X('輸垮的人多了，虔誠或家裡被害的人提「禁賭」；賭場老闆、常客和食堂老闆反對，全鎮投票決定。', 'When enough people are ruined, the devout or hurt families propose a ban; the owner, regulars and the canteen owner oppose it, and the town votes.')],
                    [X('城市的觀光客', 'Tourists in the city'), X('城市以上的賭場吸引外地賭客，順便在鎮上吃住，把外地的錢帶進來。', 'In a city the casino draws gamblers from out of town who eat and stay locally, bringing outside money in.')]],
              log: [['20:00', X('富商老李在「金滿堂」輸了 12 銀幣，笑笑說就當買個開心。', 'Rich merchant Li loses 12 silver at the Golden Hall and laughs it off.')], ['21:15', X('阿明押中大獎，一夜之間贏了 300 銀幣！', 'Aming hits the jackpot and wins 300 silver overnight!')], ['22:40', X('小芳的丈夫把家當全輸在賭場，她帶著孩子離開了。', 'Xiaofang\'s husband gambles away everything; she leaves with the children.')], ['23:50', X('欠了銀行一屁股債的老吳，連夜離開了小鎮。', 'Deep in debt to the bank, old Wu slips out of town in the night.')]] },
            { id: 'shares', c: '#7fcf8f', k: X("股份與合夥", "Shares and partners"), new: '8.7',
              h: X("合夥做生意，最難的是分錢", "In business together, splitting the money is the hard part"),
              lead: X("沒人一個人買得起的產業，有野心的人會找交情好的朋友合股買下。股份最多的人當家，每週照股份分紅；生意好有人眼紅想入股，缺錢的股東只好賣股。", "When nobody can afford an industry alone, an ambitious villager brings in close friends to buy it together. The largest shareholder runs it and pays dividends every week; when business booms someone wants to buy in, and broke shareholders have to sell."),
              pts: [[X("做假帳與翻帳本", "Cooked books"), X("貪心的當家少分股東，細心的股東翻帳本抓到就當場拍桌；醜聞之後有人提案「產業帳本公開」。", "Greedy managers short the shareholders, and sharp-eyed shareholders who catch them slam the table; after a scandal someone proposes Open Books.")],
                    [X("股東會變天", "Boardroom coups"), X("不滿的股東加起來比當家多，就在股東會上把當家拉下來；翻臉的合夥人被買斷拆夥。", "When unhappy shareholders together outweigh the manager, they vote the manager out; partners who fall out get bought out.")],
                    [X("員工認股", "Worker shares"), X("工會提案讓工人用存款買自家產業的股份；分紅那週大家心情好，罷工也少了。", "Unions propose letting workers buy shares in their own industry with their savings; on dividend weeks people are happier and strikes are rarer.")]],
              log: [['10:00', X("阿德一個人買不起木作坊，找了兩個老朋友合股買下。", "Ade couldn't afford the timber yard alone, so he bought it with two old friends.")], ['17:30', X("小芳翻了帳本，發現當家這週少分了 12 銀幣，當場拍桌。", "Xiaofang went through the books, found the manager had shorted them 12 silver, and slammed the table.")], ['20:10', X("股東會上，大家聯手把當家拉了下來。", "At the shareholder meeting, everyone joined forces to vote the manager out.")]] },
            { id: 'union', c: '#e5736b', k: X('工會', 'Unions'), new: '6.93',
              h: X('被壓榨的人會組織起來', 'The squeezed get organized'),
              lead: X('小鎮升格成城市以後，私人產業裡覺得被壓榨的工人一多，就有人出來組工會：收會費、存罷工基金、跟老闆談加薪。談不攏就罷工，老闆可能讓步、找工賊、開除帶頭的人，或私下收買工會領袖。帶領五人以上工會的領袖可以出來選舉。',
                  'Once the town becomes a city and enough private-sector workers feel squeezed, someone starts a union: dues, a strike fund, wage talks with the bosses. If talks fail they strike, and the boss may give in, hire scabs, fire the organizers or quietly bribe the union leader. A leader with five or more members can run for office.'),
              pts: [[X('集體談判', 'Collective bargaining'), X('老闆看利潤、個性和手上的現金決定要不要讓步。', 'Bosses weigh profit, temperament and cash on hand before giving in.')],
                    [X('罷工與工賊', 'Strikes and scabs'), X('罷工期間工會發補貼，基金見底就撐不下去。', 'The union pays strike pay; when the fund runs dry the strike collapses.')],
                    [X('收買與曝光', 'Bribes and exposure'), X('領袖收了老闆的錢，被發現就會被會員趕下台。', 'A leader who takes the boss\'s money gets thrown out once members find out.')]],
              log: [['09:00', X('磨坊工會要求每天加 1 銀幣，老闆拒絕。', 'The mill union asks for 1 more silver a day; the owner refuses.')], ['09:30', X('七名會員開始罷工，工會每天發 2 銀幣補貼。', 'Seven members walk out; the union pays 2 silver a day in strike pay.')], ['15:00', X('第四天，老闆讓步了。', 'On day four, the owner gives in.')]] },
            { id: 'power', c: '#c39bd3', k: X('金權與第四權', 'Money and the press'), new: '6.95',
              h: X('有錢人買影響力，報社負責揭穿', 'The rich buy influence; the press digs it up'),
              lead: X('老闆和有錢人會捐政治獻金，正直的人拒收，收了錢的首長和議員就偏向金主。報社每天從真實發生的事裡找新聞：壓薪、驅逐潮、銀行呆帳、私下收錢。報導會讓讀者生氣、讓醜聞扣票、逼老闆加薪，甚至引發罷免；財團也可能直接買下報社，把新聞壓下來。',
                  'Owners and the wealthy make political donations; honest officials refuse, and those who accept lean toward their donors. The papers dig stories out of what really happens: wage cuts, waves of evictions, bad bank loans, money changing hands. A story can anger readers, cost votes, force a pay raise or even trigger a recall, and a rich owner might simply buy the paper and kill the story.'),
              pts: [[X('獻金與拒收', 'Donations and refusals'), X('誰收了誰的錢記在真相頁；收錢的人投票時會想到金主。', 'Who took money from whom is on the truth page, and it shows in their votes.')],
                    [X('報導有後果', 'Stories have consequences'), X('憤怒、扣票、罷免、加薪、救濟提案、銀行提款，都可能因為一篇報導發生。', 'Outrage, lost votes, recalls, raises, relief proposals and bank withdrawals can all follow one article.')],
                    [X('收編與骨氣', 'Captured papers, stubborn reporters'), X('被收購的報社會壓新聞；有骨氣的記者照登，然後被開除。', 'A bought paper buries stories; a principled reporter runs them anyway and gets fired.')]],
              log: [['06:30', X('《邊境日報》：鎮長收下鐵鋪老闆 80 銀幣獻金。', 'Frontier Daily: Mayor accepted 80 silver from the forge owner.')], ['11:00', X('讀者氣炸了，三位議員提議罷免。', 'Readers are furious; three councillors call for a recall.')], ['20:00', X('鐵鋪老闆出 120 銀幣買下報社。', 'The forge owner buys the paper for 120 silver.')]] },
            { id: 'growth', c: '#6fcf97', k: X('科技與成長', 'Technology and growth'),
              h: X('從村莊長成王都，要花好幾年', 'From village to capital takes years'),
              lead: X('科技分成拓荒、手工、工坊、機械、生技、神話基因六個時代，共 57 項，整棵樹要好幾年才研究得完。新技術在村民之間傳開，分出保守派和革新派；房子從木屋翻修成磚樓。人口、繁榮和時代都夠了，村莊才升格成城鎮、城市、王都；掉下來也會降級。',
                  'Technology spans six eras (Frontier, Craft, Workshop, Machine, Biotech and Mythic Genes) with 57 techs that take years to finish. New ideas spread from person to person and split the town into conservatives and reformers; houses get rebuilt from timber to brick. With enough people, prosperity and progress a village becomes a town, a city, a capital, and can fall back down.'),
              pts: [[X('六個時代', 'Six eras'), X('蒸汽動力、鐵路、現代金融在第四時代；器官移植在第五時代；神話基因要到第六時代。', 'Steam power, railways and modern finance arrive in the fourth era, transplants in the fifth, and mythic genes only in the sixth.')],
                    [X('保守與革新', 'Old ways and new'), X('失業的人會抗議新機器，選舉時也分成兩派。', 'People put out of work protest new machines, and elections split along the same line.')],
                    [X('四級城鎮', 'Four town tiers'), X('村莊 → 城鎮 → 城市 → 王都，議會和官職跟著變大。', 'Village → town → city → capital; the council and offices grow with it.')]],
              log: [['14:00', X('研究完成：輪作。農田收成提高了。', 'Research complete: crop rotation. Harvests improve.')], ['14:20', X('老農夫：「祖先那套也沒餓死誰。」', 'Old farmer: "The old ways never starved anyone."')], ['17:45', X('邊境鎮升格為城市！議會擴大到 7 席。', 'Frontier Town becomes a city! The council grows to 7 seats.')]] },
            { id: 'path', c: '#f0a35e', k: X('科技路線', 'Tech paths'), new: '8.0',
              h: X('走哪條路，就會遇到哪種問題', 'Every path brings its own troubles'),
              lead: X('工坊時代研究得差不多，村民就會開一場「路線大辯論」：電子機械、基因生物、蒸汽煉金，還是維持傳統？每個人投給自己想走的路，看小鎮的地形和經歷過什麼：貿易要道偏電子機械，礦山偏蒸汽煉金，森林和平原農地偏基因生物；剛撐過瘟疫的小鎮比較想走基因生物，工會強、礦工鐵匠多的小鎮比較想走蒸汽煉金。每條路線的第四、五時代大家都能研究，第六時代才是專屬：電子機械有火箭、核子武器、太空站、AI；基因生物有基因編輯、神話基因、延壽療法；蒸汽煉金有發條人偶、以太引擎、浮空城、賢者之石、人造人。',
                  'Once the workshop era is mostly researched, the town holds a tech path debate: Electro-mechanical, Bio-genetic, Steam Alchemy, or keep to tradition? Everyone votes for the path they want, shaped by the land and by what the town has been through: trade-route towns lean electro-mechanical, mining towns lean steam alchemy, forest and farmland towns lean bio-genetic; a town that just survived a plague leans bio-genetic, and one with a strong union and many miners and smiths leans steam alchemy. Anyone can research the fourth and fifth eras of every path; only the sixth era is exclusive: rockets, nuclear weapons, a space station and AI for electro-mechanical; gene editing, mythic genes and life extension for bio-genetic; clockwork automatons, the aether engine, a floating city, the philosopher\'s stone and homunculi for steam alchemy.'),
              pts: [[X('問題跟著科技走', 'Trouble follows the technology'), X('蓋了核電廠就可能核災；有了藥廠就會排污、藥價暴漲；研究院可能讓病原體外洩，變成一場真的瘟疫。偶爾出事，嚴重的機率很低但真的會發生。', 'Build a nuclear plant and a meltdown becomes possible; a pharmaceutical works brings pollution and price spikes; an institute can leak a pathogen into a real epidemic. Trouble happens now and then; the serious kind is rare, but real.')],
                    [X('村民自己立法', 'Villagers write the rules'), X('核安法、廢核、生物安全法、藥價管制、禁止基因作物、停止人體實驗：出了事之後，受害的人會帶頭提案。', 'Nuclear safety laws, abolishing nuclear power, biosafety laws, drug price controls, GM crop bans, halting human experiments: after something goes wrong, the people who were hurt lead the proposals.')],
                    [X('蒸汽煉金：很需要人手，代價是煤煙', 'Steam Alchemy: plenty of jobs, paid for in smoke'), X('高壓鍋爐、齒輪工坊、蒸汽機甲讓礦工、鐵匠、木匠的職缺變多，不會被機器搶飯碗。代價是煤煙：煙越濃天空越暗、越多人咳嗽；冬天起霧、煙散不掉的時候可能變成大黑霧。村民會提清潔空氣法、工廠法（工時與童工），人造人問起自己能不能有名字時，還會吵要不要禁造。賢者之石只能把石頭變成鋼，變不出銀幣。', 'High-pressure boilers, gear workshops and steam mechs open more jobs for miners, smiths and carpenters instead of handing them to machines. The price is coal smoke: the thicker it gets, the darker the sky and the more people cough, and on a foggy winter day it can turn into a Great Smog. Villagers propose a Clean Air Act and a Factory Act (working hours and child labor), and when a homunculus asks whether it can have a name, the town argues over banning them. The philosopher\'s stone can turn stone into steel, but never into silver.')]],
              log: [['10:20', X('路線大辯論：電子機械 9 票、蒸汽煉金 14 票、維持傳統 4 票，小鎮決定走蒸汽煉金。', 'Path debate: Electro-mechanical 9, Steam Alchemy 14, keep tradition 4. The town chooses Steam Alchemy.')], ['14:05', X('氣動管道把阿明寫給小芳的情書送到了老陳家，全鎮笑了一整天。', 'The pneumatic tubes delivered A-Ming\'s love letter for Xiao-Fang to Old Chen instead. The town laughed about it all day.')], ['21:40', X('王嬸剛晾好的衣服被煤灰染成了灰色，抱著一籃髒衣服跑去找工坊老闆理論。', 'Auntie Wang\'s freshly hung laundry turned grey with soot, and she carried the basket over to complain to the workshop owner.')]] },
            { id: 'doom', c: '#ff8a65', k: X("世界級災厄", "World calamities"), new: '9.2',
              h: X("科技走到頂點，世界也可能走到盡頭", "At the peak of technology, the world may meet its end"),
              lead: X("每條科技路線的第六時代研究到六成，就可能遇上那條路線的末日：電子機械的核子大戰、外星入侵、AI 控制；基因生物的全球不孕與喪屍危機；蒸汽煉金的冰河期與以太裂隙。每場都走六段：徵兆、研究與爭論、口耳相傳、恐慌、降臨、災後世界，總長一兩個月。", "Once a town has researched 60% of its path's sixth era, that path's doomsday may come: nuclear war, alien invasion or an AI takeover on the electro path; global infertility or a zombie outbreak on the bio path; an ice age or an aether rift on the steam path. Each one runs through six phases (omens, research and debate, word spreads, panic, arrival, aftermath) over a month or two."),
              pts: [[X("跟降臨倒數賽跑", "Racing the countdown"), X("研究員要在降臨前做完主對策：停火斡旋、解讀訊號、斷網開關、生殖修復療法、喪屍解藥、生態方舟、封印裂隙。做完化解、做一半減輕、沒做到重創。", "Researchers must finish the countermeasure before it arrives: ceasefire talks, decoding the signal, a kill switch, fertility repair, a zombie cure, an eco-ark, sealing the rift. Finish and it is averted, get halfway and it is eased, fall short and the town is devastated.")],
                    [X("說沒事的和喊危險的", "Deniers and alarmists"), X("全鎮分成兩派吵；有錢人先搬走、信徒說是天譴；世界末日前有人和好、有人告白、有人把秘密說出來。災後當初說沒事的人抬不起頭。", "The town splits into two camps; the rich leave first and the devout call it divine punishment; before the end some make peace, some confess their love, some reveal their secrets. Afterwards the deniers can't look anyone in the eye.")],
                    [X("災厄會留下痕跡", "Scars that stay"), X("核子冬天、AI 管家的宵禁、一年生不出孩子、好幾個月的長冬、天上那道紫色的疤、墓園邊的新墳；撐過一次就解鎖（跟著帳號），之後在任何城鎮都能從手牌打出來。", "Nuclear winter, the AI steward's curfew, a year without births, a winter that lasts for months, a purple scar across the sky, new graves by the cemetery; survive one and it unlocks on your account, so you can play it from your hand in any town.")]],
              log: [['08:00', X("收音機裡外國的廣播越來越火爆，主持人說話的聲音都在發抖。", "The foreign broadcasts on the radio grow more heated; the host's voice is shaking.")], ['12:30', X("老王在酒館拍桌子：「什麼世界末日，我爺爺那一代也說過。」", "Old Wang bangs the tavern table: \"End of the world? My grandfather heard that too.\"")], ['19:40', X("冬季倉庫堆滿了木柴和醃菜，連小孩都來幫忙搬。", "The winter storehouse is piled with firewood and pickles; even the children help carry.")]] },
            { id: 'aftermath', c: '#e5736b', k: X('災後反應', 'After disaster'), new: '7.9',
              h: X('大事發生之後，每個人都有自己的反應', 'When disaster strikes, everyone reacts their own way'),
              lead: X('核災、實驗室外洩、瘟疫、基因衝突、藥價暴漲……出事之後，受害的人和他們的家人最痛，跟他們越親的人越受影響。每個村民依自己的個性、身上有多少錢、家人有沒有事、身邊的人在做什麼，自己決定怎麼反應：有人互助送糧，有人怪罪別人、傳謠言，有人上街抗議，有人囤貨、逃難，走投無路的人可能去搶。',
                  'Meltdowns, lab leaks, plagues, gene-caste clashes, drug price spikes... when something goes wrong, the victims and their families hurt most, and the closer you are to them the harder it hits. Each villager decides how to react from their personality, how much money they have, whether their family is safe and what the people around them are doing: some bring food to neighbors, some blame others or spread rumors, some take to the streets, some hoard or flee, and the desperate may loot.'),
              pts: [[X('像真的社會一樣會傳染', 'It spreads like in a real society'), X('情緒和行為沿著人際圈傳開：好朋友去抗議，自己也比較會去；派系的人彼此看齊；有魅力、有名望的人一帶頭，影響最大。', 'Feelings and actions spread through social circles: if close friends protest, you are more likely to join; factions follow their own; when a charismatic, respected person leads, it carries furthest.')],
                    [X('搶劫潮與門檻', 'Riots have a tipping point'), X('老實人要看到很多人在搶才會跟；走投無路的人不用等。一兩個人帶頭，就可能一發不可收拾。衛兵抓得到就還錢、關幾天，抓不到就變成只有你知道的秘密。', 'Honest people only join once many others are already looting; the desperate don\'t wait. One or two people starting can set it off. If the guards catch them, the money goes back and they spend a few days in jail; if not, it becomes a secret only you know.')],
                    [X('之後放什麼進去都能測', 'Drop in anything and watch'), X('所有災難共用同一個入口：之後加進來的事件、天災、世界級災厄，村民都會用同一套方式反應，看這個社會怎麼互相影響。開著完整智能體模式時，出大事那天壓力最大的幾個人由 AI 整批決定怎麼反應、各說一句話。', 'Every disaster uses the same entry point: future events, natural disasters and world catastrophes all get the same treatment, so you can watch how the society reacts. With full agent mode on, the most shaken villagers each decide with AI and say a line.')]],
              log: [['09:10', X('實驗室外洩之後，林美玲提著一籃吃的去看研究員一家。', 'After the lab leak, Lin Meiling brings a basket of food to the researcher\'s family.')], ['15:30', X('鎮民聚在廣場抗議，要鎮公所給個交代，帶頭的是失去父親的阿浩。', 'Townsfolk gather in the square to demand answers, led by Ahao, who lost his father.')], ['22:40', X('混亂中有人衝進公有糧倉，扛走了 8 份糧食。', 'In the chaos, someone breaks into the public granary and hauls off 8 food.')]] },
            { id: 'ways', c: '#e8b04b', k: X('人情世故', 'How people really are'), new: '8.1',
              h: X('面子、人情、嘴硬和冷戰，一點一點長出每個鎮的性格', 'Saving face, favors, stubbornness and cold shoulders slowly shape each town\'s character'),
              lead: X('提案被當眾大比數否決會丟面子：多數人從此不敢再提，有人脈的會私下拉票再試，朋友給個台階會被記一輩子。婚禮禮金、去送葬、災後幫忙都記在人情帳上，欠了人情投票時就不好意思反對。提案搞砸了，當初投贊成的人多半說「我當初就覺得怪怪的」；有人投票支持法律、私下自己照樣違反。每個人有固定的小去處，常碰面的人慢慢變成街坊；吵完架的人互不說話，共同的朋友被迫選邊。',
                  'Get a proposal voted down in public by a wide margin and you lose face: most people stop proposing for a while, the well-connected quietly lobby and try again, and a friend who offers a way to save face is remembered for life. Wedding gifts, showing up at funerals and help after a disaster all go on the favor ledger, and owing someone makes it awkward to vote against them. When a proposal goes wrong, the people who voted for it mostly say "I had a bad feeling about it from the start"; some vote for a law and quietly break it themselves. Everyone has their usual spot, and people who keep running into each other slowly become neighbors; after a fight two people stop speaking, and mutual friends have to pick a side.'),
              pts: [[X('每件小事都會反饋', 'Every small thing feeds back'), X('沉默的人一多，提案就變少，看不下去的人會提一場鄰里茶會；提案常失敗、有人說一套做一套，全鎮的信任下降，大家對提案更多疑；有人翻修房子，鄰居眼紅，手頭緊的借錢也要跟。', 'When enough people go quiet, proposals dry up until someone calls a neighborhood tea gathering; when proposals keep failing or hypocrites are caught, trust falls and people get suspicious of every proposal; when one family renovates, the neighbors get envious, and some borrow to keep up.')],
                    [X('不誇張，好笑來自真實', 'Nothing over the top, the humor is real life'), X('紅包包太少被親戚私下比較、老人懷念當年其實落選下台的首長、氣動管道把情書送錯人、冷戰的兩個人在婚宴上被排在同一桌。', 'Relatives quietly compare wedding gifts, elders miss a mayor who actually lost re-election, tube mail delivers a love letter to the wrong house, and two people who aren\'t speaking get seated at the same wedding table.')],
                    [X('每個鎮長出不同的性格', 'Every town grows its own character'), X('有的鎮人情重、投票看關係，有的鎮互不信任、提案都要附理由，有的鎮老人當家很保守。不是設定出來的，是從小毛病一路長出來的。', 'Some towns run on favors and vote by relationships, some trust no one and want reasons for everything, some are run by cautious elders. None of it is preset; it grows out of small habits.')]],
              log: [['09:15', X('李嬸的提案被大比數否決之後，逢人就說：「我本來就只是隨口提提。」', 'After her proposal was voted down by a wide margin, Auntie Li tells everyone: "I was only mentioning it in passing."')], ['12:40', X('王伯兩天沒出現在公園，賣菜的張嫂跑去敲門問候。', 'Uncle Wang hadn\'t shown up at the park for two days, so Mrs. Zhang from the vegetable stall went over and knocked to check in.')], ['19:30', X('冷戰中的阿明和小芳在婚宴上被排在同一桌，全場都在偷看。', 'A-Ming and Xiao-Fang, still not speaking, were seated at the same table at the wedding banquet, and everyone kept sneaking looks.')]] },
            { id: 'myth', c: '#d98be0', k: X('神話基因', 'Mythic genes'), new: '7.6',
              h: X('有錢人把神的血編進身體裡', 'The rich edit the blood of gods into their bodies'),
              lead: X('第六時代、王都和基因實驗室都到了，有錢人就能花大錢編入八種神話基因：月狼之血、夜之血、雷神之血、智慧女神之瞳、太陽神之血、冥王之血、不死鳥之血、巨人之血。能力很強，副作用也很真實：滿月變狼人、白天虛弱要吸血、雷雨天失控。被禁了就轉進地下診所，孩子還會遺傳。',
                  'With the sixth era, a capital and a gene lab, the rich can pay a fortune for one of eight mythic genes: the blood of the moon wolf, of the night, of the thunder god, the eye of the wisdom goddess, the blood of the sun god, of the king of the dead, of the phoenix and of the giants. The powers are real, and so are the side effects: turning into a wolf at full moon, weakness by day and a thirst for blood, rages in thunderstorms. Ban it and it moves to back-alley clinics; children inherit it.'),
              pts: [[X('純人派與神裔會', 'Pure Blood and the god-blooded'), X('每個人對神裔有自己的看法，出事、報紙、朋友都會改變；兩派投票、選舉一起行動。', 'Everyone has their own view of the god-blooded, shaped by incidents, the papers and friends; each side votes and campaigns as a bloc.')],
                    [X('獵人與冤案', 'Hunts and wrongful accusations'), X('獵人隊連夜搜捕常抓錯人；冤案揭曉後，帶頭的人會被提案審判。', 'Night hunts often seize the wrong person; once the truth comes out, the ringleader may be put on trial.')],
                    [X('宗教與平權', 'Faith and equal rights'), X('宗教認定基因是褻瀆或神選；被逐出教門的神裔會創立新神教，神裔會也會提案平權令。', 'Faiths call the genes blasphemy or a divine choice; the excommunicated found new faiths, and the god-blooded push for an equal rights act.')]],
              log: [['00:30', X('滿月夜，守衛隊長變成了狼人，咬傷了巡夜的人。', 'Full moon: the guard captain turns into a wolf and bites the night watchman.')], ['07:00', X('《邊境日報》：純人派說神裔是怪物，要求驅逐。', 'Frontier Daily: Pure Blood calls the god-blooded monsters and demands expulsion.')], ['21:15', X('獵人隊抓錯了人，被冤枉的鐵匠今天放了出來。', 'The hunters got the wrong man; the wrongly accused blacksmith is released today.')]] },
            { id: 'aether', c: '#7ec8e3', k: X("以太與長生", "Aether and longevity"), new: '8.7',
              h: X("存起來煉賢者之石，還是先把日子過好？", "Save for the philosopher's stone, or live well now?"),
              lead: X("蒸汽煉金的小鎮挖得到以太礦。以太讓發條人偶夜裡也做事、浮空城區升得更高、傷口一夜癒合；也能存起來煉一顆賢者之石，讓戴著它的人老得很慢。以太永遠不夠用，存還是用，村民自己投票。", "Steam towns can mine aether. It keeps clockwork automatons working through the night, lifts the floating district higher and heals wounds overnight; it can also be saved to make a philosopher's stone that makes its bearer age very slowly. There is never enough, and the villagers vote on whether to save it or use it."),
              pts: [[X("一顆，只給一個人", "One stone, one person"), X("國王想收走、有錢人想買、教團說該給神職、研究員說是自己的功勞，全鎮吵翻天。石頭一離身，被延緩的歲月一下子追上來。", "The king wants to seize it, the rich want to buy it, the clergy say it belongs to a priest, the researchers claim the credit, and the town is in an uproar. If the stone ever leaves its bearer, the held-back years catch up at once.")],
                    [X("基因延壽：人人都能做，但有代價", "Gene longevity: for everyone, at a price"), X("基因生物的小鎮可以花錢做延壽療程，多活十五年；代價是基因失調、生育力下降、長輩一直不退位。", "Bio towns can pay for a longevity treatment and live fifteen years longer, at the cost of gene disorders, lower fertility and elders who never step aside.")],
                    [X("點石成鋼也有代價", "Even transmutation has a price"), X("鎮上缺鋼時，大方的持有人會用賢者之石點石成鋼，但石頭的光會暗一點、自己也老得快一點；能量要靠以太補，又跟大家搶以太。", "When the town runs short of steel, a generous bearer may turn rock into steel with the stone, but its glow dims and they age a little faster; its power must be topped up with aether, which everyone else needs too.")]],
              log: [['06:40', X("礦工在礦坑深處挖到一條發著淡藍色光的礦脈。", "Deep in the mine, the miners strike a vein glowing pale blue.")], ['14:00', X("議會表決：以太先拿來過生活，賢者之石以後再說。", "The council votes: aether goes to daily life for now, the stone can wait.")], ['23:50', X("半夜有人摸進老楊的房間，賢者之石不見了。", "At midnight someone creeps into Old Yang's room, and the philosopher's stone is gone.")]] },
            { id: 'lab', c: '#e06c75', k: X('災厄工坊', 'Disaster workshop'), new: '8.2',
              h: X('你是神，可以親手設計一場災難', 'You are the god: design a catastrophe yourself'),
              lead: X('災厄工坊是神的工具，不是村民的路線。第一種災厄是病原體：自己設計傳播途徑、症狀、潛伏期、爆發速度和致死率，還能加上怪病特性（說謊就會爆炸、藏不住秘密、一見鍾情、易怒、失憶、守財、昏睡、性格反轉），花神力指定第一個病人釋放。之後會一直出事：徵兆、研究與爭論、流言、恐慌、高峰、災後。',
                  'The disaster workshop is the god\'s tool, not a path the villagers choose. The first calamity is the pathogen: design how it spreads, its symptoms, incubation, speed and lethality, add strange quirks (lying makes you explode, secrets slip out, love at first sight, rage, amnesia, miserliness, endless sleep, a flipped personality), then spend divine power to pick patient zero. Then events unfold: omens, research and debate, rumors, panic, the peak, and the aftermath.'),
              pts: [[X('人類會自救', 'Humans fight back'), X('村民自己提案隔離、戴口罩、關店、封城、研究疫苗，跟疫情賽跑；有錢人會先逃，有人囤藥。你只能推一把讓它更糟，不能阻止。', 'Villagers propose quarantine, masks, closing shops, lockdowns and vaccine research, racing the outbreak; the rich flee first and some hoard medicine. You can only make it worse, never stop it.')],
                    [X('疫情裡的人情世故', 'People in an epidemic'), X('每天在酒館碰面的人互相傳染；關太久就有人偷溜、投贊成的人自己不守被抓包；鄰居把飯放在門口欠下人情；有人趁機賣萬靈藥；吃過虧的小鎮下次更早防疫，兩年後又慢慢忘了。', 'Regulars at the tavern infect each other; when rules drag on people sneak out, and those who voted for them get caught breaking them; neighbors leave food at the door and favors are owed; someone sells a miracle cure; a town that suffered reacts faster next time, then slowly forgets.')],
                    [X('大災之後文明倒退', 'Civilization slips back'), X('死的、逃的人越多，失傳的科技越多，從最高的時代開始；文書房、印刷坊、學堂、研究院能保住學問，失傳的只剩殘卷。', 'The more people die or flee, the more knowledge is lost, starting from the highest era. Archives, presses, schools and institutes help keep it; what is lost leaves only fragments.')],
                    [X("神之書", "Book of Gods"), X("事件卡分普通、稀有、傳說、禁忌四級，小鎮發生過某些事才會寫進書裡、出現在手牌；打牌、託夢、工坊共用神力。", "Event cards come in four rarities (common, rare, legendary, forbidden) and are written into the book, and your hand, only after certain things happen in town; cards, dreams and the workshop share one divine power.")]],
              log: [['07:30', X('醫生發現三個人同時發燒咳嗽，懷疑是新的病。', 'The doctor notices three people with fever and cough at once and suspects a new disease.')], ['15:10', X('得了說謊病的老謝又撒了一次謊，冒出一陣黑煙。', 'Old Xie, sick with the liar\'s fever, lies again and puffs out black smoke.')], ['20:00', X('投票支持關酒館的老周，被人撞見從後門溜進去喝酒。', 'Old Zhou, who voted to close the tavern, is spotted sneaking in through the back door for a drink.')]] },
            { id: 'culture', c: '#9aa7ff', k: X('信仰與文化', 'Faith and culture'),
              h: X('每座鎮都有自己的神、節日和傳言', 'Every town has its own gods, festivals and rumors'),
              lead: X('宗教是隨機生成的：名字、神、經典、節日都不一樣。信徒禮拜、捐獻，教團濟貧，也會分裂出異端、跟新科技起衝突。消息會晚到、會走樣，越傳越離譜；藝術作品、吟遊詩人的歌和鎮史一起留下來。',
                  'Religions are generated at random: names, gods, scriptures and festivals all differ. Believers worship and give, the faith helps the poor, and it can split into heresies or clash with new technology. News arrives late and gets distorted; art, bards\' songs and the town chronicle remain.'),
              pts: [[X('教團的錢', 'Money of the faiths'), X('信徒捐獻進教團基金，拿去維護場所、辦節日、濟貧；宗教預設免稅，村民可以提案對捐獻課稅。', 'Offerings fill the faith\'s fund, which pays for upkeep, festivals and relief; religion is tax-exempt by default, but villagers can propose taxing donations.')],
                    [X('謠言會走樣', 'Rumors drift'), X('第二手開始有機會被誇大，有些八卦一開始就是假的。', 'From the second telling a story may be exaggerated, and some gossip was false from the start.')],
                    [X('鎮史', 'Town chronicle'), X('每一季寫成一章，記下誰當選、誰過世、發生過什麼大事。', 'Each season becomes a chapter: who was elected, who died, what happened.')]],
              log: [['06:00', X('張老伯帶著信徒在聖堂做晨禱。', 'Old Zhang leads the faithful in morning prayer.')], ['13:10', X('傳言：「聽說北邊的城鎮鬧饑荒，已經餓死好幾個人。」', 'Rumor: "They say the northern town has a famine and people are dying."')], ['21:00', X('吟遊詩人唱起去年那場大雪的歌。', 'A bard sings about last year\'s great snow.')]] },
            { id: 'world', c: '#5fc4b8', k: X('世界', 'The world'), new: '7.1',
              h: X('小鎮外面還有一整個世界', 'There is a whole world outside town'),
              lead: X('每座鎮依地形擅長不同的東西：靠海才曬得出鹽、捕得到魚，森林邊的鎮木材多。缺什麼就靠商隊；搭馬車可以去其他城鎮，大雪、坍方、盜匪會封路。鎮與鎮之間有外交、聯姻和貿易戰。',
                  'Each town is good at different things depending on its land: only coastal towns make salt and catch fish, forest towns have timber. Whatever is missing comes by caravan; carriages travel between towns, and snow, landslides and bandits close the roads. Towns trade, marry into each other and fight trade wars.'),
              pts: [[X('地形決定物產', 'Land shapes the economy'), X('穀物、魚、肉、鹽、紙、工具、建材，各鎮產量不同。', 'Grain, fish, meat, salt, paper, tools and building materials vary from town to town.')],
                    [X('馬車與路況', 'Carriages and roads'), X('出遠門的人會離開地圖，回來時帶著外地的消息。', 'Travelers leave the map and come back with news from elsewhere.')],
                    [X('進出口與關稅', 'Trade and tariffs'), X('商行老闆看差價做進出口；便宜進口貨一多，本地生產者會提案課關稅。', 'The trading house imports and exports where the margins are; when cheap imports pile up, local producers push for a tariff.')]],
              log: [['15:00', X('海港的商隊到了，帶來魚和鹽。', 'A caravan from the harbor arrives with fish and salt.')], ['15:30', X('大雪封路，往山城的馬車停駛三天。', 'Heavy snow closes the road; carriages to the mountain town stop for three days.')], ['18:00', X('鄰鎮派人來談聯姻。', 'The neighboring town sends envoys to discuss a marriage.')]] },
            // v9.1.1 第七章「你」的兩個主題
            { id: 'watch', c: '#8fd3c7', k: X('觀看', 'Watching'),
              h: X('拉近看屋裡，翻開每個人的心事', 'Look inside the houses, and into people\'s heads'),
              lead: X('地圖上每位村民在做什麼都看得到：點一下，鏡頭就跟著他，資訊卡寫著心情從哪來、跟誰要好、欠誰錢。鏡頭拉近，屋頂會打開，看得到有人在床上睡、有人坐著吃飯、有人在鐵砧前打鐵。每天有一份日報，把昨天的大事、各報的評論、外地傳來的消息和記者專欄排在同一份。',
                  'You can see what every villager is doing: tap one and the camera follows them, with a card showing where their mood comes from, who they like and who they owe. Zoom in and the roofs open up, showing someone asleep in bed, someone eating at the table, someone hammering at the anvil. Every day there is one daily paper with yesterday\'s big news, what each paper said, news from afar and a reporter\'s column.'),
              pts: [[X('拉近看屋裡', 'Look inside'), X('拉遠有屋頂，拉近換成剖面，屋裡的人依在做什麼坐著、躺著或工作，名牌旁有小圖示。', 'From afar the roofs are on; zoom in and you get a cutaway where people sit, lie or work depending on what they are doing, with a small icon by their name.')],
                    [X('日報與鎮史', 'The daily and the town history'), X('日報整理昨天的大小事、各報怎麼說和外地消息；每一季寫成一章鎮史。', 'The daily sums up yesterday, what each paper said and news from afar; each season becomes a chapter of town history.')],
                    [X('真相頁', 'The truth page'), X('說謊、栽贓、做假帳、壓新聞，村民不知道的事你都看得到。', 'Lies, frame-ups, cooked books and buried stories: you see what the villagers do not.')]],
              log: [['07:00', X('觀察者日報：鎮長的稅率提案以 12 比 9 通過。', 'Observer\'s daily: the mayor\'s tax proposal passes 12 to 9.')], ['13:10', X('拉近一看，鐵鋪裡三個人在打鐵，老闆坐在角落算帳。', 'Zoom in: three people hammer away in the forge while the owner does the books in the corner.')], ['20:00', X('今晚八點檔：〈賭場門口的那場爭吵〉。', 'Tonight\'s 8 pm episode: "The quarrel outside the casino".')]] },
            { id: 'god', c: '#f2c14e', k: X('神之書', 'Book of Gods'),
              h: X('神力不多，要用在刀口上', 'Divine power is scarce, so spend it well'),
              lead: X('神力每天慢慢回來，虔誠的人越多回得越快。神之書裡有五十多張事件卡，分普通、稀有、傳說、禁忌四級，稀有以上要小鎮發生過某些事才會寫進書裡。你也可以託夢給某個人，或化身路過的旅人跟人聊天，村民不知道你是神。',
                  'Divine power trickles back each day, faster when more people are devout. The Book of Gods holds over fifty event cards in four tiers (common, rare, legendary and forbidden), and the rarer ones are only written in after something has happened in town. You can also send someone a dream, or chat with people as a passing traveler; nobody knows you are a god.'),
              pts: [[X('事件卡', 'Event cards'), X('每天最多三張：豐年、彗星、善意接力、真話雨……村民用自己的方式解讀。', 'Up to three a day: a bumper harvest, a comet, a chain of kindness, a rain of truth… and villagers interpret each one in their own way.')],
                    [X('託夢', 'Dreams'), X('在某人夢裡說一句話，他醒來可能真的去做，也可能當作怪夢。', 'Say one sentence in someone\'s dream; they may act on it when they wake, or shrug it off as a strange dream.')],
                    [X('化身旅人', 'Walk among them'), X('跟村民聊天，你說的話會留在他的記憶裡、可能傳開，甚至變成提案。', 'Chat with villagers; what you say stays in their memory, may spread, and can even become a proposal.')]],
              log: [['06:30', X('你託夢給小豆子：「去圖書館看看」。他醒來想了很久。', 'You send little Doudou a dream: "Go to the library." He wakes up and thinks about it for a long time.')], ['10:00', X('你打出「彗星」：迷信的人心慌，學者的研究大有進展。', 'You play "Comet": the superstitious panic while scholars make a breakthrough.')], ['15:20', X('旅人隨口說的一句話，傳到了鎮長耳裡。', 'Something the traveler said in passing reaches the mayor\'s ears.')]] },
        ];
        // v9.1.1 首頁敘事改版：從十幾段並排的功能介紹，改成一條從小到大的故事線：先講這款遊戲的核心（三根柱子＋一件事怎麼牽動整個鎮），
        // 再分七章由一個人往外擴到整個世界，最後回到你；每章先講一句核心概念（淺），主題卡點開才看細節（深），章尾一句話接到下一章
        // v9.29.0 補上首頁原本沒寫到的功能(寵物、流行與習俗、傳說、話題、階層流動、技能、通膨、新東西、對手鎮、寫一句話、世界史詩)
        const more = {
            people: [[X('寵物', 'Pets'), X('貓狗有主人，會跟著走；鎮上也有流浪貓狗和農場的雞。村民會領養，有寵物陪心情比較好。寵物會生寶寶、走失，也會離世。', 'Cats and dogs have owners and follow them around; the town also has strays and farm chickens. Villagers adopt them, and company from a pet lifts their mood. Pets have young, go missing and die.')]],
            ways: [[X('鎮上的新東西', 'New things in town'), X('賭場、新開的店、新科技出現時，每個人依自己的個性、價值觀和處境形成看法。喜歡的人去用、推薦給朋友；討厭的人抱怨、勸家人別去。夠多人討厭，就有人帶頭到門口抗議，或提案禁止。', 'When a casino, a new shop or a new technology appears, each person forms a view from their personality, values and situation. Those who like it use it and recommend it; those who don\'t complain and urge family to stay away. If enough people object, someone leads a protest at the door or proposes a ban.')]],
            culture: [[X('流行與習俗', 'Fads and customs'), X('鎮上會冒出流行：紅圍巾、口頭禪、放風箏、綠豆湯。年輕人學得快，老人學得慢；跟的人太多，帶頭的人就嫌不稀罕。消遣和吃食流行將近一個月，可能留下來變成鎮上的習俗。', 'Fads appear in town: red scarves, catchphrases, kite flying, mung bean soup. The young pick them up fast and the old slowly; once everyone follows, the people who started it lose interest. A pastime or food that stays popular for about a month may become a town custom.')],
                [X('傳說與迷信', 'Legends and superstition'), X('店家失火之後，鎮上會說那裡「不乾淨」；天災之後有人說是老天發怒。故事越傳越走樣，虔誠的人容易信，讀書人和醫生會出來闢謠。信的人晚上不去那裡，還會湊錢請人做法事。', 'After a shop fire the town says the place "isn\'t clean"; after a disaster some say heaven is angry. Stories change as they spread: the devout believe easily, while scholars and doctors debunk them. Believers avoid the place at night and chip in for a ritual.')],
                [X('鎮上在談什麼', 'What the town is talking about'), X('上日報的大事會先醞釀，越多人講越熱，再慢慢退成餘波。大家同時只關注三件事，新的大事冒出來，最冷的那件就沒人提了。', 'Big news brews first, heats up as more people talk about it, then fades. The town follows only three stories at a time; when a new one breaks, the coldest is dropped.')]],
            money: [[X('階層流動', 'Social mobility'), X('每個人都有出身：小孩的階層跟著家裡，16 歲定下來。之後靠手藝、做生意、嫁娶往上爬，也可能掉下來。從底層爬到士紳以上，全鎮都會知道，窮人拿他當榜樣，老派士紳嫌他是暴發戶。', 'Everyone is born into a class: children follow their family until it is set at 16. After that people climb through a trade, a business or a marriage, and some fall. When someone rises from the bottom to the gentry the whole town knows; the poor take them as an example and the old gentry call them an upstart.')],
                [X('技能慢慢練', 'Skills take years'), X('第一年大約練到 8 級，三年 12 級，十年左右才 20 級，老手和新手看得出差別。本行練到 10 級可以成為名匠，一行只有一位。', 'About level 8 after one year, 12 after three, and 20 only after roughly ten, so veterans and beginners are visibly different. Level 10 in your own trade can make you the town\'s one master of it.')],
                [X('通貨膨脹', 'Inflation'), X('大家手上的錢越多，東西越貴。工資跟得比物價慢，存錢的人吃虧，欠錢的人賺。工資落後太多，工人就會提案「工資跟上物價」。', 'The more money people hold, the more everything costs. Wages follow prices slowly, so savers lose and debtors gain. When wages fall too far behind, workers propose "Wages to keep up with prices".')]],
            world: [[X('對手鎮', 'A rival town'), X('等級最接近、路最近的鄰鎮會成為對手鎮。大約每週發生一件事：搶生意、開高薪挖角、友誼賽；缺物資時，關係好就互換，關係差就被抬價。兩鎮會變成良性競爭、互相較勁或死對頭。', 'The nearest neighbouring town of a similar size becomes your rival. About once a week something happens: a fight over trade, poaching with high pay, a friendly match. When goods run short, friendly towns swap and unfriendly ones raise prices. The two end up as friendly rivals, competitors or sworn enemies.')]],
            watch: [[X('世界史詩', 'The world epic'), X('AI 依這個世界實際發生的事寫史詩章節：時代更替、災厄、王朝。每個玩家的史詩都不一樣，可以像書一樣翻。被寫進史詩的村民會記得，閒聊時還會拿出來說。', 'The AI writes epic chapters from what really happened in this world: changes of era, calamities, dynasties. Every player\'s epic is different, and you can page through it like a book. Villagers who appear in it remember, and bring it up in conversation.')]],
            god: [[X('寫一句話，讓它發生', 'Write a line, make it happen'), X('手牌最前面有「寫一句話」。寫下「今晚下起流星雨」或「河邊撈到一箱金幣」，它就在鎮上真的發生。花 6 神力，一天一次。效果只能從固定清單裡選、數值有上限，不能直接變出銀幣；村民不知道是你寫的。', 'The hand starts with "Write a line". Write "a meteor shower falls tonight" or "someone fishes a chest of gold out of the river" and it really happens in town. It costs 6 divine power, once a day. Effects come from a fixed list with caps and cannot conjure silver, and the villagers never know you wrote it.')]],
        };
        for (const b of bands) if (more[b.id]) b.pts.push(...more[b.id]);
        const B = Object.fromEntries(bands.map(b => [b.id, b]));
        const chapters = [
            { id: 'self', c: '#f28c4a', scale: X('一個人', 'One person'),
              h: X('先從一個人開始', 'It starts with one person'),
              lead: X('每位村民都是一個完整的人：有個性和價值觀，記得誰對他好，有自己的錢包，也有會生病的身體。餓了要吃飯，病了要看醫生，沒錢就得想辦法。', 'Every villager is a whole person: a personality and values, a memory of who was kind to them, a wallet of their own and a body that can fall ill. Hungry, they need food; sick, they need a doctor; broke, they need a plan.'),
              topics: ['people', 'health', 'myth'],
              bridge: X('一個人的處境和情緒，會變成他對別人的態度。', 'A person\'s situation and mood become how they treat others.') },
            { id: 'ties', c: '#e8b04b', scale: X('人與人', 'Between people'),
              h: X('人跟人之間，比規則複雜', 'People are messier than rules'),
              lead: X('面子、人情、八卦、冷戰、信仰：村民之間有一整套看不見的規矩。誰欠誰人情、誰跟誰鬧翻，都會影響他明天怎麼做事、怎麼投票。', 'Face, favors, gossip, cold wars, faith: villagers live by a whole set of unwritten rules. Who owes whom and who fell out with whom shapes how they work and vote tomorrow.'),
              topics: ['ways', 'culture'],
              bridge: X('交情和信任，決定了誰跟誰合夥、誰替誰做事。', 'Friendship and trust decide who goes into business with whom, and who works for whom.') },
            { id: 'living', c: '#f2c14e', scale: X('討生活', 'Making a living'),
              h: X('每一枚銀幣都有來處和去處', 'Every coin comes from somewhere and goes somewhere'),
              lead: X('鎮上的錢不會憑空出現，也不會憑空消失：工資、稅、分紅、利息、賭債，全是村民之間真的轉手。有人當老闆，有人當夥計，有人組工會，有人輸光家產。', 'Money in town never appears or vanishes out of thin air: wages, taxes, dividends, interest and gambling debts all really change hands between villagers. Some become owners, some workers, some organize unions, some lose everything.'),
              topics: ['money', 'shares', 'union', 'casino'],
              bridge: X('有錢的人想要話語權，沒錢的人想要改變。', 'The rich want a say; the poor want change.') },
            { id: 'power', c: '#7fb3f5', scale: X('誰說了算', 'Who decides'),
              h: X('規則是村民自己訂的', 'The villagers make the rules'),
              lead: X('要蓋什麼、稅收多少、禁不禁賭，都由村民提案、投票，再由首長拍板；報社監督，財團收買，議會可以推翻否決。你看得到檯面上的投票，也看得到檯面下的交易。', 'What to build, how much tax to collect, whether to ban gambling: villagers propose and vote, and the leader decides. The press keeps watch, money buys influence, and the council can overturn a veto. You see the votes on the table and the deals under it.'),
              topics: ['politics', 'power'],
              bridge: X('訂下的政策，決定了小鎮往哪裡長。', 'The policies they choose decide which way the town grows.') },
            { id: 'era', c: '#6fcf97', scale: X('小鎮長大', 'The town grows'),
              h: X('從二十幾個人的村莊，到有國王的王都', 'From a village of twenty to a capital with a king'),
              lead: X('研究推著時代往前走，人口和繁榮讓村莊升級成城鎮、城市、王都。到了第四時代，全鎮要投票選一條科技路線：電子機械、基因生物或蒸汽煉金，每條路都有自己的奇蹟和代價。', 'Research pushes the eras forward, and population and prosperity turn a village into a town, a city, a capital. In the fourth era the whole town votes on a path (electro-mechanical, bio-genetic or steam-alchemy), each with its own wonders and costs.'),
              topics: ['growth', 'path', 'aether'], tiers: true,
              bridge: X('走得越遠，牽連的就不只一個鎮。', 'The further they go, the more it reaches beyond one town.') },
            { id: 'world', c: '#5fc4b8', scale: X('世界與災難', 'The world, and its ends'),
              h: X('外面還有別的鎮，也有末日', 'There are other towns out there, and doomsdays too'),
              lead: X('鄰鎮有自己的物產、外交和消息；商隊、旅人、聯姻把大家連在一起。走到第六時代，可能遇上核戰、外星入侵、冰河期這種世界級災厄，村民怎麼面對，是這個世界最大的考驗。', 'Neighboring towns have their own goods, diplomacy and news; caravans, travelers and marriages tie everyone together. In the sixth era a world-scale calamity may come (nuclear war, an alien invasion, an ice age), and how the villagers face it is this world\'s greatest test.'),
              topics: ['world', 'doom', 'aftermath'],
              bridge: X('而這一切，都在你眼前發生。', 'And all of it happens right in front of you.') },
            { id: 'you', c: '#c39bd3', scale: X('你', 'You'),
              h: X('你是觀察者，偶爾當神', 'You are the observer and, now and then, a god'),
              lead: X('你不控制任何人。你可以拉近看屋裡的人在做什麼，讀每天的日報，翻真相頁看誰在說謊；神力存夠了，就打一張事件卡、託一個夢、設計一場災難，然後看小鎮怎麼回應。', 'You control no one. Zoom in to see what people are doing indoors, read the daily paper, check the truth page to see who is lying; when you have enough divine power, play an event card, send a dream or design a disaster, then watch how the town responds.'),
              topics: ['watch', 'god', 'lab'],
              bridge: X('沒有劇本，也沒有結局。', 'No script, and no ending.') },
        ];
        const pillars = [
            ['bulb', X('他們自己做決定', 'They decide for themselves'), X('每位村民都有個性、記憶、錢包和身體。要不要提案、投給誰、去不去賭場、跟誰結婚，都是他自己依經歷想出來的，而且說得出理由。', 'Every villager has a personality, memories, a wallet and a body. Whether to propose, whom to vote for, whether to gamble, whom to marry: each decides from their own experience, and can tell you why.')],
            ['link', X('每件事都牽動別的事', 'Everything is connected'), X('經濟、政治、信仰、八卦、科技、災難，全是同一群人的生活，彼此分不開。一個人輸光了錢，會影響他的婚姻、工作、投票，還有整個鎮的輿論。', 'Money, politics, faith, gossip, technology and disaster are all part of the same people\'s lives. When one man gambles away his savings, it touches his marriage, his job, his vote and the mood of the whole town.')],
            ['eye', X('你只能看，偶爾當神', 'You watch, and sometimes play god'), X('你不是主角，也不能控制任何人。你看著小鎮長出自己的歷史，偶爾用神力推一把，再看它怎麼回應。', 'You are not the hero and you control no one. You watch the town grow its own history, nudge it now and then with divine power, and see how it responds.')],
        ];
        // 一件事怎麼牽動整個鎮：每一步標上它屬於哪一章（點了跳過去）
        const chain = [
            ['living', X('有錢的阿福在鎮上開了賭場，還雇了一個荷官。', 'Wealthy Afu opens a casino in town and hires a dealer.')],
            ['self', X('愛冒險的礦工老陳一週去三次，輸光積蓄，開始跟莊家賒帳。', 'Old Chen, a miner who loves a risk, goes three times a week, loses his savings and starts betting on credit.')],
            ['ties', X('太太勸他戒賭沒成功，兩人大吵一架；街坊開始說閒話。', 'His wife begs him to quit and fails; they have a blazing row, and the neighbors start to talk.')],
            ['power', X('討厭賭場的人越來越多，跑到門口抗議，有人提案禁賭，全鎮照自己的看法投票。', 'More and more people hate the casino; they protest at its door, someone proposes a ban, and the town votes its conscience.')],
            ['power', X('報社寫成專題，阿福花錢想把報導壓下來，只有你在真相頁看得到。', 'The paper runs a feature and Afu pays to bury it. Only you can see that, on the truth page.')],
            ['you', X('你可以什麼都不做，也可以打一張「善意接力」，看看有沒有人願意拉老陳一把。', 'You can do nothing, or play "A chain of kindness" and see whether anyone helps Old Chen back up.')],
        ];
        const CH = Object.fromEntries(chapters.map((c, i) => [c.id, { ...c, n: i + 1 }]));
        const tiers = [
            ['home', X('村莊', 'Village'), X('村長＋長老會 3 席', 'Chief + 3-seat elders'), X('一切的開始：二十幾個人、一間鎮公所。', 'Where it starts: twenty-some people and a hall.')],
            ['town', X('城鎮', 'Town'), X('人口 30＋繁榮 50＋第一時代', 'Pop 30 + prosperity 50 + era 1'), X('鎮長與 5 席鎮議會，銀行與報社陸續出現。', 'A mayor and 5-seat council; banks and papers appear.')],
            ['city', X('城市', 'City'), X('人口 60＋繁榮 65＋第二時代', 'Pop 60 + prosperity 65 + era 2'), X('市長與 7 席市議會，工會開始出現。', 'A city mayor and 7-seat council; unions form.')],
            ['castle', X('王都', 'Capital'), X('人口 100＋繁榮 80＋第三時代', 'Pop 100 + prosperity 80 + era 3'), X('國王加冕、王令與政變，9 席王都議會。', 'A crowned king, decrees and coups; 9-seat council.')],
        ];
        const aiNotes = [
            ['bulb', X('完整智能體模式（預設開啟）', 'Full agent mode (on by default)'), X('村民要不要提案、怎麼投票、鎮長怎麼裁決，都交給 AI 依各自的記憶、性格和交情推理，並說出理由。', 'Whether to propose, how to vote and how the leader rules are all reasoned by AI from each villager\'s memories, personality and relationships, with reasons given.')],
            ['key', X('內建 AI，不用填金鑰', 'Built-in AI, no key needed'), X('所有玩家都用小鎮內建的 AI：先用 Claude，Claude 不能用才換 GPT，兩個都不能用才用 Groq 備援。每個帳號每天有使用上限；金鑰只放在伺服器，網頁原始碼和存檔裡都沒有。', 'Everyone uses the town\'s built-in AI: Claude first, GPT only if Claude is unavailable, and Groq as a last resort. Each account has a daily limit; keys live only on the server, never in the page source or saves.')],
        ];
        const faq = [
            [X('「完全智能體」是什麼意思？', 'What does "full agent" mean?'), X('村民遇到事情時，遊戲只列出當下做得到的選項，由本人依自己的處境選一個，並說出理由。目前有 75 種事是這樣決定的。提案、投票、首長裁決、聊天和每天的行程，也由 AI 依每個人的記憶和個性處理。', 'When something comes up, the game only lists what is possible at that moment, and the villager picks one from their own situation and gives a reason. 75 kinds of situation are decided this way today. Proposals, votes, the leader\'s rulings, conversations and daily plans are also handled by AI from each person\'s memories and personality.')],
            [X('AI 額度用完了，村民會停下來嗎？', 'Do villagers stop when the AI quota runs out?'), X('不會。額度用完、AI 沒回話，或那天輪不到 AI 的人，照自己的個性、交情和處境決定，一樣留下理由。村民卡上每一筆決定都標明是 AI 想的，還是依個性推估的。', 'No. When the quota is used up, the AI does not answer, or it is not someone\'s turn for AI that day, they decide from their own personality, relationships and situation, and still leave a reason. Every decision on the villager card says whether the AI made it or it was estimated from personality.')],
            ...aiNotes.map(n => [n[1], n[2]]), // v9.1.1 AI 與金鑰併進常見問題（首頁太長）
            [X('要下載或安裝嗎？', 'Do I need to install anything?'), X('不用。打開網頁就能玩，電腦、平板、手機都可以。', 'No. It runs in the browser on computers, tablets and phones.')],
            [X('我可以控制村民嗎？', 'Can I control the villagers?'), X('不行，這是觀察型遊戲。你能做的是打事件卡、託夢、化身旅人聊天，其他全由村民自己決定。', 'No, this is an observation game. You can play event cards, send dreams or chat as a traveler; the rest is up to them.')],
            [X('存檔會不會不見？', 'Will my save disappear?'), X('登入後存檔會自動同步到雲端，換裝置登入就能接著玩；本機也會留一份備份。', 'Once logged in, saves sync to the cloud so you can continue on another device; a local backup is kept too.')],
            [X('為什麼要邀請碼？', 'Why an invite code?'), X('小鎮的 AI 由伺服器負擔，目前用邀請制控制人數。', 'The server pays for the town\'s AI, so sign-ups are invite-only for now.')],
            [X('AI 會不會亂講話？', 'Will the AI say random things?'), X('村民只能根據自己的記憶、性格和鎮上真的發生的事說話；伺服器也會擋掉不像村民的回覆。', 'Villagers speak only from their own memories, personality and what really happened in town; the server also filters replies that don\'t sound like a villager.')],
            [X('一開始介面怎麼這麼少？', 'Why is the interface so bare at first?'), X('開局只看得到基本分頁，小鎮長大、時代前進、發生大事時，產業、真相、災厄工坊等分頁才會一個個打開，並跳出「解鎖了新分頁」提示。想一開始就全部打開，可以到設定勾選「一開始就顯示全部功能」。', 'You start with only the basic tabs. As the town grows, eras advance and big things happen, tabs like Industry, Truth and the Disaster Workshop open one by one with a notice. To see everything from the start, turn on "Show all features from the start" in Settings.')],
            [X('有英文版嗎？', 'Is there an English version?'), X('有。右上角切換中文／English，村民對話、日報、介面都會換。', 'Yes. Switch 中文／English at the top right; dialogue, the daily paper and the interface all change.')],
        ];
        // 路線圖:已上線只留最近三版(更早的看更新紀錄)、下一步是正在設計的、構想是還沒排時程的
        const roadmap = {
            done: [['v9.28', X('感情與衝突也自己拿主意', 'Own choices in love and conflict'), X('要不要告白、答不答應、求婚、對別人動了心怎麼辦、感情淡了走不走、碰上死對頭要不要吵起來，都由本人決定。到這一版，75 個選擇點全部交給本人，舊的擲骰程式也清掉了', 'Whether to confess, accept, propose, what to do about falling for someone else, whether to leave when the spark fades, whether to pick a fight with a sworn enemy: all are now each villager\'s own choice. With this version all 75 choice points belong to the villagers, and the old dice code is gone')],
                ['v9.27', X('信仰與群眾行動也自己拿主意', 'Own choices in faith and crowds'), X('日子難過時要不要祈禱、勸不勸朋友信教、有人號召抗議跟不跟、朋友被害慘了要不要出手、國王失了民心要不要密謀，都由本人決定', 'Whether to pray in hard times, bring a friend to the faith, join a protest, step in when a friend is ruined, or plot against a king who has lost the people: all are now each villager\'s own choice')],
                ['v9.26', X('陰暗面與選舉手段也自己拿主意', 'Own choices on the dark side'), X('公家的東西拿不拿、選戰怎麼打、聽到朋友被說壞話要不要告訴他、掌櫃動不動帳、自己贊成的規定守不守，都由本人決定', 'Whether to help themselves to the common stores, how to fight a campaign, whether to tell a friend what was said about them, whether a manager skims the books, whether to keep a rule they voted for: all are now each villager\'s own choice')]],
            next: [[X('新科技帶來新行業', 'New trades from new tech'), X('研究出新東西，鎮上就多出做這行的人、開這種店的老闆，舊行業的人可能失業', 'New inventions create new jobs and new kinds of shops, and people in old trades may lose work')],
                [X('民間出資研究', 'Privately funded research'), X('有錢人自己出錢請研究員、搶先拿到新技術的好處，公家研究跟民間研究互相競爭', 'The wealthy hire researchers with their own money to get new tech first, competing with public research')]],
            ideas: [X('更多世界級災厄（神裔戰爭、生態崩潰、人造人叛亂）', 'More world calamities (demigod war, ecological collapse, android revolt)'), X('災厄工坊進階（突變、世界瘟疫）', 'Advanced calamity workshop (mutation, world plague)'), X('災後重建分得更細', 'More detailed aftermaths'), X('財團與財閥', 'Conglomerates and tycoons'), X('鎮與鎮之間的貨幣與匯率', 'Currencies between towns'), X('玩家之間互訪城鎮', 'Visit other players\' towns'), X('手機 App 版', 'Mobile app')],
        };
        const loadLog = () => {
            if (typeof RIMTOWN_CHANGELOG !== 'undefined' || this._changelogLoading) return;
            this._changelogLoading = true;
            const sc = document.createElement('script');
            sc.src = 'changelog.js?v=' + encodeURIComponent(RIMTOWN_APP_VERSION);
            sc.onload = () => { if (!this._landingActive) return; try { if (!this._lpFillLog?.()) this._renderLanding(); } catch (e) {} }; // 只更新更新紀錄那一塊(整頁重畫會把 3D 場景和捲動位置都重來)
            document.head.appendChild(sc);
        };
        const log = (typeof RIMTOWN_CHANGELOG !== 'undefined' && Array.isArray(RIMTOWN_CHANGELOG)) ? RIMTOWN_CHANGELOG : [];
        const logHtml = log.map((e, i) => `<div class="landing-log-item${i >= 3 ? ' extra' : ''}">
                <div class="landing-log-head"><span>v${esc(e.version)}</span><time>${esc(e.date || '')}</time></div>
                <ul>${((I18N.getLang() === 'en' && e.changes_en && e.changes_en.length) ? e.changes_en : (e.changes || [])).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('');
        const head = (kicker, title, lead) => `<div class="lp-sec-head lp-rv"><span class="lp-kicker">${kicker}</span><h2>${title}</h2>${lead ? `<p class="lp-sec-lead">${lead}</p>` : ''}</div>`;
        const sec = (id, kicker, title, body, extra = '', lead = '') => `<section class="landing-section lp-sec${extra}" id="${id}">${head(kicker, title, lead)}${body}</section>`;
        const num = (n) => String(n).padStart(2, '0');
        const first = (txt) => { const m = L === 'en' ? txt.match(/^.*?[.!?](?=\s|$)/) : txt.match(/^.*?。/); return m ? m[0] : txt; }; // 主題列上只放第一句,其餘點開看

        // ---------- 這是什麼遊戲 ----------
        const core = `<section class="landing-section lp-sec lp-core" id="landing-core">${head(X('這是什麼遊戲', 'What this game is'), X('一座自己活著的小鎮', 'A town that lives on its own'))}
                <ol class="lp-pillars">${pillars.map((p) => `<li class="lp-pillar lp-rv"><span class="lp-pillar-ic">${ic(p[0])}</span><h3>${p[1]}</h3><p>${p[2]}</p></li>`).join('')}</ol>
            </section>`;

        // ---------- 一個決定是怎麼來的 ----------
        // 五個步驟(說明沿用 v9.19.1),右邊用一筆真實的紀錄對照:9.28 版接真模型實測時,裁縫唐琳跟梁貝兒借錢
        const dSteps = [
            ['book', X('先看自己的處境', 'Look at their own situation'), X('此刻的心情和身體、身上的錢和債、對鎮上大事的立場、家人朋友和處不來的人、最近發生的事，還有自己以前做過的決定。', 'How they feel right now, their money and debts, where they stand on town issues, family, friends and people they can\'t stand, what happened lately, and the decisions they made before.')],
            ['bell', X('遇到要拿主意的事', 'Something comes up'), X('手上有閒錢、借的錢到期了、對不起某人、跟人冷戰、工資被壓、工會來談加薪、快選舉了。遊戲只列出「現在做得到的選項」，不替他選。', 'Spare money, a debt coming due, owing someone an apology, a silent feud, squeezed wages, the union asking for a raise, an election coming up. The game only lists what is possible right now. It does not choose for them.')],
            ['bulb', X('自己選，說出理由', 'Choose, and say why'), X('AI 依他自己的處境挑一個，用他的口吻說為什麼。也可以選「其他」，做一件選單上沒有的事。', 'The AI picks one from that villager\'s own situation and gives the reason in their voice. It can also pick "something else" and do a thing that is not on the list.')],
            ['scale', X('真的發生', 'It really happens'), X('錢真的從一個人到另一個人手上，交情真的變好或變壞。每一筆錢都有來源和去處，不會憑空多出來。', 'Money really moves from one person to another, and relationships really warm or cool. Every coin has a source and a destination; none appears from nowhere.')],
            ['idcard', X('記住結果', 'Remember how it went'), X('決定、理由、結果都記下來；下次再遇到事，他看得到自己上次怎麼選、後來怎樣，還會留下「接下來的打算」。', 'The decision, the reason and the outcome are all kept. Next time something comes up they can see what they chose before and how it went, and they leave themselves a plan for what comes next.')],
        ];
        const q = (s) => (L === 'en' ? `"${s}"` : `「${s}」`);
        const rec = [
            [X('處境', 'Situation'), `<p>${X('裁縫唐琳。身上只剩 1 銀幣，欠陳雅婷的錢快到期。梁貝兒手頭寬裕，兩人交情不錯。', 'Tang Lin, a tailor. She has 1 silver left, and her debt to Chen Yating is nearly due. Liang Bei\'er is comfortably off, and the two get along.')}</p>`],
            [X('遇到的事', 'What came up'), `<p><b>${X('手頭很緊', 'Short of money')}</b>${X('　你身上只剩 1 銀幣，連吃飯都成問題。', ': you have only 1 silver left, and even meals are a problem.')}</p>`],
            [X('選項與理由', 'Options and reason'), `<ul class="lp-rec-opts"><li>${X('咬牙撐過去，不跟任何人開口', 'Tough it out and ask no one')}</li><li class="pick">${ic('check')}${X('跟梁貝兒開口借 15 銀幣（一週後要還）', 'Ask Liang Bei\'er for 15 silver (due in a week)')}</li><li>${X('其他：自己想做的事', 'Something else of her own')}</li></ul><blockquote>${q(X('欠陳雅婷的錢快到期，先跟梁貝兒開口借 15 銀幣應急。', 'The debt to Chen Yating is nearly due. I\'ll ask Liang Bei\'er for 15 silver to get by.'))}<cite>${X('唐琳', 'Tang Lin')}</cite></blockquote>`],
            [X('真的發生', 'It happens'), `<p>${X('這變成梁貝兒要拿主意的事：「有人來借錢」。她選了借。', 'This becomes something for Liang Bei\'er to decide: "Asked for a loan". She chose to lend.')}</p><blockquote>${q(X('唐琳都開口了，身上只剩 1 銀幣，總不能見死不救。', 'Tang Lin asked me herself, and she has 1 silver left. I can\'t just watch.'))}<cite>${X('梁貝兒', 'Liang Bei\'er')}</cite></blockquote><p class="lp-rec-move"><span>${X('梁貝兒', 'Liang Bei\'er')}</span><i aria-hidden="true">${ic('arrow')}</i><b>${X('15 銀幣', '15 silver')}</b><i aria-hidden="true">${ic('arrow')}</i><span>${X('唐琳', 'Tang Lin')}</span></p>`],
            [X('記住', 'Remembered'), `<p>${X('兩人的村民卡各多一筆「最近的決定」。唐琳欠梁貝兒 15 銀幣，一週後到期。到時候要全還、先還一部分，還是拜託寬限，又是她自己要拿主意的事。', 'Each of them gets a new entry under "Recent decisions" on their villager card. Tang Lin now owes Liang Bei\'er 15 silver, due in a week. Whether to repay in full, pay part or ask for more time will be hers to decide again.')}</p>`],
        ];
        const dPicks = [
            [X('愛冒險的獵人', 'An adventurous hunter'), X('去外地玩幾天', 'Takes a few days\' trip out of town'), X('「辛苦這麼久，想出去走走看看。」', '"After all this hard work, I want to get out and see things."')],
            [X('顧家的農夫', 'A family-minded farmer'), X('送孩子去外地讀書', 'Sends a child to school out of town'), X('「再苦也要讓孩子讀書。」', '"However hard it gets, the child must get schooling."')],
            [X('克己的守衛', 'A frugal guard'), X('存進銀行', 'Puts it in the bank'), X('「錢放銀行比較安心，還能生利息。」', '"It\'s safer in the bank, and it earns interest."')],
        ];
        const decide = `<section class="landing-section lp-sec lp-decide" id="landing-decide">${head(X('完全智能體', 'Full agents'), X('一個決定是怎麼來的', 'How one decision comes about'), X('村民遇到事情時，先看自己的處境，再自己選，說得出理由，也記得後來怎樣。下面右邊是 9.28 版接上 AI 實測時留下的一筆紀錄，引號裡是村民自己說的話。', 'When something comes up, a villager looks at their own situation, chooses for themselves, can say why, and remembers how it turned out. The record on the right comes from a test run of v9.28 with the AI connected; the quotes are the villagers\' own words (translated).'))}
                <div class="lp-flow lp-rv" id="lp-flow" data-step="0">
                    <ol class="lp-steps lp-steps-5">${dSteps.map((x, i) => `<li class="lp-step${i ? '' : ' on'}" data-step="${i}"><button type="button" class="lp-step-btn" aria-pressed="${i ? 'false' : 'true'}"><span class="lp-step-num" aria-hidden="true">${i + 1}</span><span class="lp-step-ic">${ic(x[0])}</span><h3>${x[1]}</h3></button><p>${x[2]}</p></li>`).join('')}</ol>
                    <div class="lp-rec" aria-label="${X('一筆實測紀錄', 'One record from a test run')}">
                        <div class="lp-rec-top"><span>${X('實測紀錄', 'From a test run')}</span><b>${X('唐琳・裁縫', 'Tang Lin · tailor')}</b></div>
                        ${rec.map((r, i) => `<div class="lp-rec-row${i ? '' : ' on'}" data-step="${i}"><span class="lp-rec-k"><i aria-hidden="true">${i + 1}</i>${r[0]}</span><div class="lp-rec-v">${r[1]}</div></div>`).join('')}
                    </div>
                </div>
                <div class="lp-ba lp-rv">
                    <div><b>${X('以前：遊戲替他們擲骰', 'Before: the game rolled dice for them')}</b><p>${X('「身上超過 100 銀幣的人，每天有 2% 的機率去旅遊。」', '"Anyone with more than 100 silver has a 2% chance each day of taking a trip."')}</p></div>
                    <div class="now"><b>${X('現在：本人依處境決定', 'Now: they decide from their own situation')}</b><p>${X('「我手上有 600 銀幣，孩子還小，上次入股又被拒絕。這次先存起來。」', '"I have 600 silver, my child is still small, and my last offer to buy shares was turned down. This time I\'ll save it."')}</p></div>
                </div>
                <h3 class="lp-sub-h">${X('同樣一筆閒錢，三個人三種選擇', 'The same spare money, three people, three choices')}</h3>
                <ul class="lp-picks lp-rv">${dPicks.map(x => `<li><span class="who">${x[0]}</span><h4>${x[1]}</h4><p>${x[2]}</p></li>`).join('')}</ul>
                <p class="lp-note">${X('這三個是示意。實際上每個人的錢、家人、交情和記憶都不一樣，換一局結果就不同。', 'These three are illustrations. In play, everyone\'s money, family, friendships and memories differ, so each game turns out differently.')}</p>
            </section>`;

        // ---------- 他們自己決定哪些事:75 個選擇點、十類 ----------
        const KT = {"sim-decide.js": [["手上有閒錢", "Spare money"], ["手頭很緊", "Short of money"], ["有人來借錢", "Asked for a loan"]], "sim-decide-soc.js": [["借的錢到期了", "A loan has come due"], ["對不起某人", "Owing someone an apology"], ["有人來道歉", "Someone came to apologize"], ["心裡有口氣", "Nursing a grievance"], ["看某人不順眼", "Can't stand someone"], ["跟某人冷戰中", "Not speaking to someone"], ["他先開口了", "They spoke first"]], "sim-decide-pol.js": [["工資被壓，大家都在抱怨", "Wages are being squeezed and everyone is grumbling"], ["鎮上有工會", "There is a union in town"], ["工會會員", "Union member"], ["工會宣布罷工", "The union calls a strike"], ["工會來談加薪", "The union comes to ask for a raise"], ["手上寬裕，政治人物用得上", "Money to spare, and politicians could use it"], ["有人送政治獻金來", "Someone brings a political donation"], ["快選舉了", "The election is close"], ["日子變了，重新想想", "Life has changed; time to think again"]], "sim-decide-life.js": [["有人想買你的股份", "Someone wants to buy into your business"], ["手上的股份分紅不如銀行", "Your shares pay less than the bank"], ["家裡的房子舊了", "The house is getting old"], ["要不要奉獻", "Whether to give an offering"], ["跟某人結怨很深", "A deep grudge against someone"], ["想不想自己開店", "Whether to open a shop of your own"], ["別鎮開高薪來挖角", "Another town is offering high pay to hire you away"]], "sim-decide-work.js": [["想不想離開這個鎮", "Whether to leave this town"], ["對面那家工資比較高", "The rival shop pays more"], ["要不要拜師學手藝", "Whether to learn a trade from a master"], ["這一行很賺，要不要在對面開一家", "This trade is making good money: open a rival shop?"], ["合夥的店不賺錢", "The shared shop is not making money"]], "sim-decide-share.js": [["合夥的股東處不來", "A shareholder you cannot get along with"], ["這週的帳要不要少報一點", "Whether to under-report this week's books"], ["要不要帶頭合股買下公營產業", "Whether to lead a group buyout of a public business"], ["要不要認購自家店的股份", "Whether to buy shares in the shop you work at"], ["銀行在擠兌，存款要不要領出來", "Bank run: whether to withdraw your savings"], ["銀行在賣債券，要不要買", "The bank is selling bonds: whether to buy"]], "sim-decide-fun.js": [["平常怎麼花錢", "Everyday spending habits"], ["要不要找名匠訂做", "Whether to commission a piece from a master"], ["今晚要不要去賭場", "Whether to visit the gambling house tonight"], ["賭債還不出來", "A gambling debt you cannot pay"], ["在賭場輸到一無所有", "Lost everything at the gambling house"], ["要不要開賭場", "Whether to open a gambling house"], ["要不要花錢買爵位", "Whether to buy a title"], ["等移植，要不要塞紅包插隊", "Waiting for a transplant: whether to bribe your way up the list"], ["提案的錢誰出", "Who pays for your proposal"]], "sim-decide-dark.js": [["公家的東西", "The town's common stores"], ["朋友心情很差", "A friend is feeling very low"], ["選戰怎麼打", "How to fight the campaign"], ["聽到有人說朋友的壞話", "Heard someone running down a friend"], ["做生意的手法", "How to run the business"], ["掌櫃經手的帳", "The books you keep as shop manager"], ["教團的奉獻箱", "The congregation's offering box"], ["自己贊成的規定", "A rule you voted for"], ["疫情的規定", "The epidemic rules"]], "sim-decide-crowd.js": [["日子難過", "Hard times"], ["要不要勸朋友信教", "Whether to bring a friend to the faith"], ["朋友勸你改信", "A friend urges you to convert"], ["鎮上有你看不慣的東西", "Something in town you cannot stand"], ["有人號召抗議", "Someone is calling a protest"], ["朋友被害慘了", "A friend has been ruined"], ["要不要帶隊搜捕", "Whether to lead a hunt"], ["國王失了民心", "The King has lost the people"], ["有人拉你推翻國王", "Someone wants you in a plot against the King"], ["提案被大比數否決", "Your proposal was heavily voted down"], ["朋友的提案被否決", "A friend's proposal was voted down"]], "sim-decide-love.js": [["心動的人", "Someone you have feelings for"], ["有人向你告白", "Someone confessed to you"], ["要不要求婚", "Whether to propose"], ["對方向你求婚", "Your partner proposed"], ["對別人動了心", "Falling for someone else"], ["感情淡了", "The spark has faded"], ["婚姻走不下去", "A marriage falling apart"], ["碰上死對頭", "Running into a sworn enemy"], ["要不要去鄰鎮作客", "Whether to visit a neighbouring town"]]};
        const kindGroups = [
            ['wallet', X('錢的事', 'Money'), X('花、存、入股、旅遊、宴客、送孩子讀書、接濟親友、借錢與被借錢。', 'Spending, saving, buying shares, travel, feasts, schooling, helping people close to them, borrowing and being asked for a loan.'), 'sim-decide.js'],
            ['chat', X('人際', 'Relationships'), X('借的錢還不還、要不要道歉、原不原諒、放下還是報復、要不要在背後講壞話、冷戰誰先開口。', 'Whether to repay a loan, apologize, forgive, let go or retaliate, talk behind someone\'s back, and who speaks first after a falling-out.'), 'sim-decide-soc.js'],
            ['vote', X('政治', 'Politics'), X('要不要帶頭組工會、加入、跟著罷工，老闆答不答應加薪，捐不捐政治獻金、收不收，要不要出來選；立場會跟著自己的處境改變。', 'Whether to start or join a union and follow a strike, whether a boss grants a raise, whether to give or accept political donations, whether to run for office; views shift with each person\'s own circumstances.'), 'sim-decide-pol.js'],
            ['home', X('自己的事', 'Personal matters'), X('有人來談入股賣不賣、股份要不要退、房子要不要翻修、要不要奉獻、要不要對仇人動手、要不要自己開店、別鎮來挖角走不走。', 'Whether to sell when someone asks to buy in, cash out a stake, rebuild the house, give an offering, move against a rival, open a shop, or leave when another town comes hiring.'), 'sim-decide-life.js'],
            ['case', X('生計與去留', 'Livelihood'), X('日子過不下去時要不要搬走、對面工資高要不要跳槽、要不要拜師學手藝、要不要在對面開店搶生意、合夥的店不賺錢要不要拆夥。', 'Whether to move away when life gets too hard, switch to a better-paying employer, learn a trade from a master, open a rival shop, or end a partnership that is not paying.'), 'sim-decide-work.js'],
            ['trend', X('股份與借貸', 'Shares and loans'), X('股東處不來怎麼辦、這週的帳要不要少報、要不要帶頭合股買下公營產業、銀行擠兌時存款領不領、債券買不買。', 'What to do about a shareholder they cannot get along with, whether to under-report the week\'s books, whether to lead a group buyout of a public business, whether to withdraw savings in a bank run, whether to buy bonds.'), 'sim-decide-share.js'],
            ['dice', X('花錢與享樂', 'Spending and pleasure'), X('平常怎麼花錢、要不要找名匠訂做、去不去賭場、賭債還不出來怎麼辦、要不要開賭場、買不買爵位、等移植時要不要塞紅包插隊。', 'Everyday spending, commissioning a piece from a master, visiting the gambling house, what to do about a gambling debt, opening a gambling house, buying a title, bribing their way up a transplant list.'), 'sim-decide-fun.js'],
            ['mask', X('陰暗面與選舉手段', 'The dark side and campaigns'), X('公家的東西拿不拿、選戰怎麼打、聽到朋友被說壞話要不要告訴他、掌櫃動不動帳、自己贊成的規定守不守。', 'Whether to help themselves to the common stores, how to fight a campaign, whether to tell a friend what was said about them, whether a manager skims the books, whether to keep a rule they voted for.'), 'sim-decide-dark.js'],
            ['flag', X('信仰與群眾行動', 'Faith and crowds'), X('日子難過時要不要祈禱、勸不勸朋友信教、有人號召抗議跟不跟、朋友被害慘了要不要出手、國王失了民心要不要密謀。', 'Whether to pray in hard times, bring a friend to the faith, join a protest, step in when a friend is ruined, or plot against a king who has lost the people.'), 'sim-decide-crowd.js'],
            ['heart', X('感情與衝突', 'Love and conflict'), X('要不要告白、答不答應、求婚、對別人動了心怎麼辦、感情淡了走不走、碰上死對頭要不要吵起來、要不要去鄰鎮作客。', 'Whether to confess, accept, propose, what to do about falling for someone else, whether to leave when the spark fades, whether to pick a fight with a sworn enemy, whether to visit a neighbouring town.'), 'sim-decide-love.js'],
        ];
        const kindTotal = kindGroups.reduce((n, g) => n + (KT[g[3]] || []).length, 0);
        const kinds = `<section class="landing-section lp-sec lp-kinds-sec" id="landing-kinds">${head(X('選擇點', 'Choice points'), X('他們自己決定的 {n} 種事', '{n} kinds of things they decide for themselves').replace('{n}', kindTotal), X('下面每一小格都是遊戲裡真的會遇到的處境。遇到了，就由那個人自己選。', 'Each small tag below is a situation villagers really run into in the game. When it comes up, that person chooses.'))}
                <ul class="lp-kinds">${kindGroups.map(g => { const ts = KT[g[3]] || []; return `<li class="lp-kind lp-rv"><div class="lp-kind-head"><span class="lp-kind-ic">${ic(g[0])}</span><h3>${g[1]}</h3><span class="lp-kind-n">${X('{n} 種', '{n}').replace('{n}', ts.length)}</span></div><p>${g[2]}</p><ul class="lp-kind-tags">${ts.map(x => `<li>${esc(L === 'en' ? x[1] : x[0])}</li>`).join('')}</ul></li>`; }).join('')}</ul>
            </section>`;

        // ---------- AI 接得上與接不上的時候 ----------
        const aiSec = `<section class="landing-section lp-sec lp-ai" id="landing-ai">${head(X('老實說', 'To be plain about it'), X('AI 接得上，和接不上的時候', 'When the AI is available, and when it is not'), X('AI 由伺服器負擔，每個帳號每天有使用上限，所以不是每件事都問 AI。兩種情況都列在這裡。', 'The server pays for the AI and each account has a daily limit, so the AI is not asked about everything. Both cases are set out here.'))}
                <div class="lp-two lp-rv">
                    <div class="lp-two-col on"><h3>${X('AI 接得上', 'AI available')}</h3>
                        <ul><li>${X('決策核心每天最多把 10 件事交給 AI，一次問 5 件。', 'The decision core hands the AI at most 10 matters a day, 5 at a time.')}</li>
                        <li>${X('其中 2 個名額留給「別人找上門」的事：有人來借錢、來道歉、先開口。', 'Two of those slots are kept for things that come to you: someone asking for a loan, apologizing, or speaking first.')}</li>
                        <li>${X('同一類的事一天最多問 2 件，免得名額全被同一種事用掉。', 'At most 2 a day of the same kind, so one kind of situation cannot use up the whole allowance.')}</li>
                        <li>${X('AI 讀的是那個人自己的處境，用他的口吻說理由。', 'The AI reads that one villager\'s own situation and gives the reason in their voice.')}</li></ul></div>
                    <div class="lp-two-col"><h3>${X('AI 接不上，或輪不到', 'AI unavailable, or not their turn')}</h3>
                        <ul><li>${X('超過名額、今天的額度用完、AI 沒回話或答非所問，都算這一種。', 'This covers going over the allowance, the daily quota being used up, and the AI not answering or answering off the point.')}</li>
                        <li>${X('這時照那個人的個性、交情和處境決定，一樣留下理由。', 'The villager then decides from their personality, relationships and situation, and still leaves a reason.')}</li>
                        <li>${X('沒有人會卡著等 AI。', 'Nobody waits around for the AI.')}</li>
                        <li>${X('村民卡上每一筆都標明是哪一種。', 'Every entry on the villager card says which of the two it was.')}</li></ul></div>
                </div>
                <p class="lp-rule lp-rv">${ic('key')}<span>${X('決策核心沒有開關。設定裡的「完整智能體模式」只決定要不要動用 AI；關掉以後，75 種事仍然由本人依個性和處境決定。金鑰只放在伺服器，網頁原始碼和存檔裡都沒有。', 'The decision core has no off switch. "Full agent mode" in Settings only decides whether the AI is used; with it off, all 75 kinds of situation are still decided by each villager from personality and circumstances. Keys live only on the server, never in the page source or saves.')}</span></p>
                <h3 class="lp-sub-h">${X('9.28 版的實測數字', 'Numbers from a test run of v9.28')}</h3>
                <ul class="lp-proof lp-rv">
                    <li><b>478</b><span>${X('次 AI 呼叫，全部有回應（中文 228、英文 250）', 'AI calls, all answered (228 in Chinese, 250 in English)')}</span></li>
                    <li><b>101</b><span>${X('題決策核心的題目，全部選了合法的選項', 'decision-core questions, every one answered with a valid option')}</span></li>
                    <li><b>0</b><span>${X('次需要改照個性補上', 'fell back to personality')}</span></li>
                </ul>
                <p class="lp-note">${X('測法：同一座城鎮先跑 45 天，再接上 AI 跑 5 個遊戲天，中文、英文各一輪。這是一次測試的結果，實際遊玩時 AI 偶爾會沒回話，那時就照上面右欄處理。', 'Method: one town ran for 45 days, then 5 game days with the AI connected, once in Chinese and once in English. This is the result of one test; in normal play the AI sometimes fails to answer, and the right-hand column above then applies.')}</p>
                <h3 class="lp-sub-h">${X('在遊戲裡哪裡看得到', 'Where to see it in the game')}</h3>
                <dl class="lp-points lp-points-3 lp-rv" style="--c:var(--lp-accent)">
                    <div><dt>${ic('idcard')}${X('村民卡的「最近的決定」', '"Recent decisions" on the villager card')}</dt><dd>${X('遇到什麼事、選了什麼、為什麼、結果怎樣，還有他接下來的打算。每一筆會標出是 AI 自己想的，還是依個性推估的。', 'What came up, what they chose, why, how it went, and what they plan next. Each entry says whether the AI decided or it was estimated from personality.')}</dd></div>
                    <div><dt>${ic('list')}${X('動態裡的決定', 'Decisions in the feed')}</dt><dd>${X('「某某想了想，決定……」是 AI 選的；「某某自己拿了主意……」是他做了選單以外的事。', '"So-and-so thought it over and decided to..." is the AI\'s choice; "So-and-so made up their own mind..." means they did something that was not on the list.')}</dd></div>
                    <div><dt>${ic('sliders')}${X('設定裡的「完整智能體模式」', '"Full agent mode" in Settings')}</dt><dd>${X('開著時由 AI 決定，每天最多 10 件；其他的，或 AI 沒回話的時候，依他的個性和處境推估，不是固定機率。', 'When on, the AI decides up to 10 matters a day. The rest, and anything the AI doesn\'t answer, is estimated from personality and situation rather than fixed odds.')}</dd></div>
                </dl>
            </section>`;

        // ---------- 一件事怎麼牽動整個鎮 ----------
        const chainSec = `<section class="landing-section lp-sec lp-chain-sec" id="landing-chain">${head(X('連鎖', 'Ripples'), X('一件事怎麼牽動整個鎮', 'How one thing ripples through a town'), X('以下沒有寫在劇本裡。每一步都是村民依自己的個性和處境決定的，換一局就不一樣。', 'None of this is scripted. Every step is decided by villagers according to their own character and circumstances, and it plays out differently every game.'))}
                <ol class="lp-chain">${chain.map(([cid, txt], i) => `<li class="lp-rv" style="--c:${CH[cid].c};--i:${i}"><a class="lp-chain-tag" href="#lp-ch-${cid}" data-lp-jump="lp-ch-${cid}">${num(CH[cid].n)} ${CH[cid].scale}</a><span>${txt}</span></li>`).join('')}</ol>
            </section>`;

        // ---------- 從一個人到整個世界:鏡頭隨捲動拉遠 ----------
        const scaleSec = `<section class="lp-scale" id="landing-scale" aria-labelledby="lp-scale-h">
                <div class="lp-scale-pin">
                    <div class="lp-scale-stage" id="lp-scale-stage" role="img" aria-label="${X('同一座小鎮的 3D 場景，鏡頭從一個人慢慢拉遠到整片海', 'A 3D scene of the same town, the camera pulling back from one person to the whole sea')}"><div class="lp-stage-ph" aria-hidden="true"></div></div>
                    <div class="lp-scale-top landing-inner"><span class="lp-kicker">${X('七個尺度', 'Seven scales')}</span><h2 id="lp-scale-h">${X('從一個人到整個世界', 'From one person to a whole world')}</h2></div>
                    <ol class="lp-scale-dots" aria-label="${X('七個尺度', 'Seven scales')}">${chapters.map((c, i) => `<li><button type="button" data-lp-scale="${i}" class="${i ? '' : 'on'}" style="--c:${c.c}"><b>${num(i + 1)}</b><span>${c.scale}</span></button></li>`).join('')}</ol>
                </div>
                <ol class="lp-scale-steps">${chapters.map((c, i) => `<li class="lp-scale-step" data-i="${i}" style="--c:${c.c}"><div class="lp-scale-card"><span class="lp-scale-num">${num(i + 1)} · ${c.scale}</span><h3>${c.h}</h3><p>${c.lead}</p><a href="#lp-ch-${c.id}" data-lp-jump="lp-ch-${c.id}">${X('看這一章的細節', 'See this chapter in detail')}${ic('down')}</a></div></li>`).join('')}</ol>
            </section>`;

        // ---------- 七章細節 ----------
        const topic = (b) => { const f = first(b.lead), rest = b.lead.slice(f.length).trim(); return `<details class="lp-topic" id="lp-${b.id}" style="--c:${b.c}">
                <summary><span class="lp-topic-ic">${ic(LP_BAND_ICON[b.id])}</span><span class="lp-topic-t"><span class="lp-topic-k">${b.k}</span><h3 class="lp-topic-h">${b.h}</h3><span class="lp-topic-sum">${f}</span></span><span class="lp-topic-go">${ic('chev')}</span></summary>
                <div class="lp-topic-body">
                    ${rest ? `<p class="lp-band-lead">${rest}</p>` : ''}
                    <dl class="lp-points">${b.pts.map(p => `<div><dt>${p[0]}</dt><dd>${p[1]}</dd></div>`).join('')}</dl>
                    ${b.log && b.log.length ? `<div class="lp-scene"><div class="lp-scene-head">${X('遊戲裡你會看到', 'What you\'ll see in the game')}</div><ol class="lp-log">${b.log.map(l => `<li><time>${l[0]}</time><span>${l[1]}</span></li>`).join('')}</ol></div>` : ''}
                </div>
            </details>`; };
        const tiersHtml = () => `<div class="lp-ch-tiers"><div class="lp-scene-head">${X('城鎮四級', 'Four town tiers')}</div><ol class="lp-tiers">${tiers.map((x) => `<li><span class="lp-tier-ic">${ic(x[0])}</span><h3>${x[1]}</h3><span class="lp-tier-reqs">${String(x[2]).split(/\s*[＋+]\s*/).map(r => `<span class="lp-tier-req">${r}</span>`).join('')}</span><p>${x[3]}</p></li>`).join('')}</ol><p class="lp-note">${X('人口、繁榮或時代掉下來，城鎮也會降級。', 'If population, prosperity or era drops, the town is demoted.')}</p></div>`;
        const chapter = (c, i) => {
            const ts = c.topics.map(id => B[id]).filter(Boolean);
            const next = chapters[i + 1];
            return `<section class="lp-chapter" id="lp-ch-${c.id}" style="--c:${c.c}" aria-labelledby="lp-ch-${c.id}-h">
            <div class="lp-ch-in">
                <header class="lp-ch-head">
                    <span class="lp-kicker"><b class="lp-ch-num" aria-hidden="true">${num(i + 1)}</b>${X('第 {n} 章', 'Chapter {n}').replace('{n}', i + 1)} · ${c.scale}</span>
                    <h2 id="lp-ch-${c.id}-h">${c.h}</h2>
                    <p class="lp-ch-lead">${c.lead}</p>
                </header>
                <div class="lp-ch-body">
                    <div class="lp-topics">${ts.map(topic).join('')}</div>
                    ${c.tiers ? tiersHtml() : ''}
                    <p class="lp-ch-bridge${next ? '' : ' is-end'}">${next ? `<a href="#lp-ch-${next.id}" data-lp-jump="lp-ch-${next.id}"><span class="lp-ch-bridge-txt">${c.bridge}</span><span class="lp-ch-bridge-go">${X('下一章', 'Next')} ${num(i + 2)} · ${next.scale}${ic('down')}</span></a>` : `<span class="lp-ch-bridge-txt">${c.bridge}</span>`}</p>
                </div>
            </div>
        </section>`;
        };
        const chnav = `<nav class="lp-chnav" aria-label="${X('章節', 'Chapters')}"><div class="lp-chnav-in"><span class="lp-chnav-k">${X('每一章的細節', 'Each chapter in detail')}</span><ol>${chapters.map((c, i) => `<li style="--c:${c.c}"><a href="#lp-ch-${c.id}" data-lp-jump="lp-ch-${c.id}"><b>${num(i + 1)}</b>${c.scale}</a></li>`).join('')}</ol></div></nav>`;
        const badges = [['monitor', X('免安裝', 'No install')], ['phone', X('手機也能玩', 'Works on phones')], ['cloud', X('雲端存檔', 'Cloud saves')], ['globe', X('中文／English', '中文／English')]];
        const links = [['landing-decide', X('智能體', 'Agents')], ['landing-scale', X('小鎮', 'The town')], ['landing-faq', X('常見問題', 'FAQ')], ['landing-log', X('更新', 'Updates')]];
        const D0 = (typeof LANDING3D !== 'undefined' && LANDING3D.DECISIONS) ? LANDING3D.DECISIONS[0] : null;

        el.innerHTML = `<div class="lp lp-${L}" id="lp-top">
            <nav class="lp-top" aria-label="${X('主選單', 'Main')}">
                <a class="lp-brand" href="#lp-top" data-lp-jump="lp-top">${X('邊境鎮', 'RimTown')}<span>${L === 'en' ? 'Frontier Town' : 'RimTown'}</span></a>
                <ul class="lp-top-links">${links.map(l => `<li><a href="#${l[0]}" data-lp-jump="${l[0]}">${l[1]}</a></li>`).join('')}</ul>
                <div class="landing-lang" role="group" aria-label="Language">
                    <button type="button" data-lang="zh" class="${L === 'zh' ? 'active' : ''}" aria-pressed="${L === 'zh'}">中文</button><button type="button" data-lang="en" class="${L === 'en' ? 'active' : ''}" aria-pressed="${L === 'en'}">EN</button>
                </div>
                <button type="button" class="lp-top-cta" data-lp-go="${loggedIn ? 'continue' : 'register'}">${loggedIn ? t('繼續遊戲') : t('註冊')}</button>
            </nav>
            <header class="lp-hero">
                <div class="lp-stage" id="lp-stage" role="img" aria-label="${X('黃昏的 3D 小鎮：方塊村民在鎮上走動，一個接一個遇到事情、自己做決定', 'A 3D town at dusk: blocky villagers walk around, and one after another runs into something and makes their own decision')}"><div class="lp-stage-ph" aria-hidden="true">${D0 && typeof LANDING3D !== 'undefined' ? `<div class="lp-dc on p5 is-static">${LANDING3D.cardHtml(D0)}</div>` : ''}</div></div>
                <div class="lp-hero-in landing-inner">
                    <div class="lp-hero-copy">
                        <span class="lp-kicker">${X('瀏覽器 3D・AI 小鎮沙盒', 'Browser 3D · AI town sandbox')}</span>
                        <h1 class="lp-title">${X('這座小鎮裡，<br>每個人都自己拿主意', 'In this town, everyone <br>makes up their own mind')}</h1>
                        <p class="lp-tagline">${X('邊境鎮是一座 AI 村民自己過日子的 3D 小鎮。借不借錢、原不原諒、要不要出來選，都由本人依自己的處境決定，而且說得出理由。你在天上看，偶爾推一把。', 'RimTown is a 3D town where AI villagers live their own lives. Whether to lend money, forgive someone or run for office is each villager\'s own call, made from their own situation, with a reason they can give. You watch from above and nudge things now and then.')}</p>
                        <div class="landing-cta">${cta}</div>
                        <ul class="lp-badges">${badges.map(b => `<li>${ic(b[0])}${b[1]}</li>`).join('')}</ul>
                        <div class="landing-version">v${esc(ver)}${loggedIn ? ` · ${esc(this.auth.username)}` : ''}</div>
                    </div>
                </div>
                <p class="lp-hero-note">${X('畫面上的理由，是 9.28 版接上 AI 實測時村民自己說的話。', 'The reasons on screen are what villagers said in a test run of v9.28 with the AI connected (translated).')}</p>
            </header>
            <div class="landing-inner">
                <ul class="lp-stats lp-rv" aria-label="${X('遊戲規模', 'Game scale')}">${stats.map(s => `<li><b>${s[0]}</b><span>${s[1]}</span></li>`).join('')}</ul>
                ${core}
                ${decide}
                ${kinds}
                ${aiSec}
                ${chainSec}
            </div>
            ${scaleSec}
            <div class="lp-chwrap">${chnav}
            <div id="landing-features" class="lp-chapters">${chapters.map(chapter).join('')}</div></div>
            <div class="landing-inner">
                ${this._renderBrainSection()}
                ${sec('landing-faq', X('常見問題', 'FAQ'), X('你可能想問', 'You might be wondering'), `<div class="lp-faq">${faq.map(f => `<details><summary>${f[0]}${ic('chev')}</summary><p>${f[1]}</p></details>`).join('')}</div>`)}
                <section class="landing-section lp-sec" id="landing-updates">${head(X('一直在更新', 'Always updating'), X('更新紀錄', 'Changelog'))}
                    <div class="landing-log" id="landing-log">${logHtml || `<div class="landing-log-item">${typeof RIMTOWN_CHANGELOG === 'undefined' ? t('載入中…') : t('尚無紀錄')}</div>`}</div>
                    ${log.length > 3 ? `<button class="landing-more" id="landing-log-more">${t('顯示全部')} (${log.length})</button>` : ''}
                </section>
                <section class="landing-section lp-sec" id="landing-roadmap">${head(X('接下來', 'Next'), X('路線圖', 'Roadmap'))}
                    <div class="lp-rm">
                        <div class="lp-rm-col lp-rm-done"><div class="lp-rm-h"><span class="lp-rm-dot" aria-hidden="true"></span>${X('已上線', 'Shipped')}<small>${X('最近三版', 'latest three')}</small></div>
                            ${roadmap.done.map(([v, h, d]) => `<div class="lp-rm-item"><span class="lp-rm-ver">${v}</span><div><b>${h}</b><p>${d}</p></div></div>`).join('')}
                            <a class="lp-rm-more" href="#landing-log" data-lp-log>${X('更早的版本看上面的更新紀錄', 'Earlier versions are in the changelog above')}</a></div>
                        <div class="lp-rm-col lp-rm-next"><div class="lp-rm-h"><span class="lp-rm-dot" aria-hidden="true"></span>${X('下一步', 'Up next')}<small>${X('正在設計', 'in design')}</small></div>
                            ${roadmap.next.map(([h, d]) => `<div class="lp-rm-item"><div><b>${h}</b><p>${d}</p></div></div>`).join('')}</div>
                        <div class="lp-rm-col lp-rm-idea"><div class="lp-rm-h"><span class="lp-rm-dot" aria-hidden="true"></span>${X('構想', 'Ideas')}<small>${X('還沒排時程', 'not scheduled')}</small></div>
                            <div class="lp-rm-pills">${roadmap.ideas.map(x => `<span>${x}</span>`).join('')}</div></div>
                    </div>
                </section>
                <section class="lp-final"><h2>${X('去看看你的小鎮今天發生了什麼', 'Go see what happened in your town today')}</h2><p>${X('註冊需要邀請碼。存檔自動同步雲端，換裝置登入就能接著玩。', 'Sign-up needs an invite code. Saves sync to the cloud, so you can continue on any device.')}</p><div class="landing-cta">${loggedIn ? `<button class="landing-btn primary" data-lp-go="continue">${t('繼續遊戲')}${ic('arrow')}</button>` : `<button class="landing-btn primary" data-lp-go="register">${t('註冊')}${ic('arrow')}</button><button class="landing-btn secondary" data-lp-go="login">${t('登入')}</button>`}</div></section>
                <footer class="landing-footer">${X('邊境鎮 RimTown', 'RimTown')} · v${esc(ver)}</footer>
            </div>
        </div>`;

        const still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const onScroll = [];
        // 3D 場景(閒置時才載 three.js;沒有 WebGL 時首屏改放一張實際畫面)
        try { if (typeof LANDING3D !== 'undefined') LANDING3D.mount(el.querySelector('#lp-stage')); } catch (e) {}
        // 目錄跳段:在 #landing 這個捲動容器裡平滑捲過去
        el.querySelectorAll('[data-lp-jump]').forEach(a => a.addEventListener('click', (ev) => { const tg = a.dataset.lpJump === 'lp-top' ? el.querySelector('.lp') : el.querySelector('#' + a.dataset.lpJump); if (!tg) return; ev.preventDefault(); if (tg.tagName === 'DETAILS') tg.open = true; tg.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); }));
        this._wireBrainDemo(el);
        // 一個決定是怎麼來的:五個步驟自動往下走,點任何一步就停在那一步
        try {
            // 一個決定是怎麼來的：往下捲時照順序一步一步亮。哪一步最靠近畫面中間就亮哪一步，右邊（手機在下面）的紀錄跟著亮同一列。
            // 9.29.2 以前是每 3.8 秒自己換一步，捲動時對不上；手機上這一區比畫面高很多，還常常停在第 1 步
            const flow = el.querySelector('#lp-flow'); clearInterval(this._lpFlowT); this._lpFlowObs?.disconnect();
            if (flow) {
                const steps = [...flow.querySelectorAll('.lp-step')], rows = [...flow.querySelectorAll('.lp-rec-row')], rec = flow.querySelector('.lp-rec');
                let cur = -1, pin = -1, pinAt = 0;
                const set = (i) => { if (i === cur) return; cur = i; flow.dataset.step = i; steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); s.querySelector('button')?.setAttribute('aria-pressed', k === i ? 'true' : 'false'); }); rows.forEach((r, k) => { r.classList.toggle('on', k === i); r.classList.toggle('done', k < i); }); };
                set(0);
                // 點某一步：直接跳到那一步，之後再捲一段才又跟著捲動走
                steps.forEach((s, k) => s.querySelector('.lp-step-btn')?.addEventListener('click', () => { pin = k; pinAt = el.scrollTop; set(k); fit(); }));
                // 電腦版紀錄卡固定在右邊；卡片比畫面高時，往上推一點，讓亮的那一列一定看得到
                const fit = () => { if (!rec) return; const sticky = getComputedStyle(rec).position === 'sticky'; const row = rows[cur]; if (!sticky || !row) { rec.style.transform = ''; return; }
                    const vh = el.clientHeight || window.innerHeight, top = parseFloat(getComputedStyle(rec).top) || 0, rt = row.offsetTop, rb = rt + row.offsetHeight;
                    const shift = Math.max(0, Math.min(rb + top - (vh - 20), rt + top - 76)); rec.style.transform = shift > 0 ? `translateY(${-Math.round(shift)}px)` : ''; };
                if (still) flow.classList.add('all');
                onScroll.push(() => {
                    if (pin >= 0 && Math.abs(el.scrollTop - pinAt) < 120) return; pin = -1;
                    const box = el.getBoundingClientRect(), vh = el.clientHeight || window.innerHeight, fr = flow.getBoundingClientRect();
                    if (fr.bottom < box.top || fr.top > box.top + vh) return;
                    const mid = box.top + vh * 0.45, stacked = !rec || getComputedStyle(rec).position !== 'sticky';
                    // 手機上紀錄卡排在步驟下面，捲到紀錄卡時看紀錄卡那一列；電腦版只看左邊的步驟
                    const cands = stacked ? [...steps, ...rows] : steps; let best = cur < 0 ? 0 : cur, bd = Infinity;
                    cands.forEach((c, j) => { const r = c.getBoundingClientRect(); const d = mid < r.top ? r.top - mid : (mid > r.bottom ? mid - r.bottom : 0); if (d < bd) { bd = d; best = j % steps.length; } });
                    set(best); fit();
                });
            }
        } catch (e) {}
        // 從一個人到整個世界:捲動進度 → 鏡頭位置;旁邊的七個點可以直接跳
        try {
            const sc = el.querySelector('#landing-scale'), stage = el.querySelector('#lp-scale-stage');
            if (sc && stage) {
                const steps = [...sc.querySelectorAll('.lp-scale-step')], dots = [...sc.querySelectorAll('[data-lp-scale]')]; let p = 0;
                const mark = (n) => { dots.forEach((d, k) => { d.classList.toggle('on', k === n); if (k === n) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); }); steps.forEach((s, k) => s.classList.toggle('on', k === n)); };
                if (still) { sc.classList.add('is-static'); p = 4; }
                const measure = () => { if (still) return; const vh = el.clientHeight || window.innerHeight, er = el.getBoundingClientRect(); let best = 0, bd = 1e9; const mid = er.top + vh * 0.5; const cs = steps.map(s => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; }); for (let k = 0; k < cs.length; k++) { const d = Math.abs(cs[k] - mid); if (d < bd) { bd = d; best = k; } } const k2 = cs[best] > mid ? best - 1 : best + 1; p = (k2 < 0 || k2 >= cs.length) ? best : best + (k2 - best) * Math.min(1, Math.abs(cs[best] - mid) / Math.max(1, Math.abs(cs[k2] - cs[best]))); mark(Math.round(p)); };
                onScroll.push(measure);
                dots.forEach((d, k) => d.addEventListener('click', () => { if (still) { el.querySelector('#lp-ch-' + chapters[k].id)?.scrollIntoView({ block: 'start' }); return; } steps[k]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
                mark(still ? -1 : 0); measure();
                if (typeof LANDING3D !== 'undefined' && LANDING3D.mountScale) LANDING3D.mountScale(stage, { root: el, progress: () => p });
            }
        } catch (e) {}
        // 捲到才淡入(偏好減少動態的人直接顯示)。用捲動位置直接算,不靠觀察器:觀察器在機器很忙時可能晚到,整段會空著
        try {
            let rv = [...el.querySelectorAll('.lp-rv')];
            if (still) { rv.forEach(x => x.classList.add('in')); rv = []; }
            onScroll.push(() => { if (!rv.length) return; const lim = el.getBoundingClientRect().top + (el.clientHeight || window.innerHeight) * 0.94; rv = rv.filter(x => { if (x.getBoundingClientRect().top < lim) { x.classList.add('in'); return false; } return true; }); });
        } catch (e) { el.querySelectorAll('.lp-rv').forEach(x => x.classList.add('in')); }
        // 捲動與改變視窗大小:一格只算一次
        try {
            const top = el.querySelector('.lp-top'); onScroll.push(() => top?.classList.toggle('solid', el.scrollTop > 24));
            let tick = 0; const run = () => { tick = 0; for (const f of onScroll) { try { f(); } catch (e) {} } };
            if (this._lpOnScroll) { el.removeEventListener('scroll', this._lpOnScroll); window.removeEventListener('resize', this._lpOnScroll); }
            this._lpOnScroll = () => { if (!tick) tick = requestAnimationFrame(run); };
            el.addEventListener('scroll', this._lpOnScroll, { passive: true }); window.addEventListener('resize', this._lpOnScroll);
            run(); setTimeout(run, 400);
        } catch (e) {}
        try { this._lpChObs?.disconnect(); const ls = [...el.querySelectorAll('.lp-chnav a')]; if (ls.length && 'IntersectionObserver' in window) { this._lpChObs = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; ls.forEach(a => { const on = a.dataset.lpJump === e.target.id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }), { root: el, rootMargin: '-40% 0px -55% 0px' }); el.querySelectorAll('.lp-chapter').forEach(s => this._lpChObs.observe(s)); } } catch (e) {} // v9.1.1
        if (typeof RIMTOWN_CHANGELOG === 'undefined' && !this._changelogLoading) {
            const box = el.querySelector('#landing-log');
            if (box && 'IntersectionObserver' in window) { try { this._lpLogObs?.disconnect(); this._lpLogObs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { this._lpLogObs.disconnect(); loadLog(); } }, { root: el, rootMargin: '900px 0px' }); this._lpLogObs.observe(box); } catch (e) { loadLog(); } } else loadLog();
            // v7.9.0 保險:有時(英文手機版重畫之後)觀察器沒觸發,捲到接近底部也載
            if (!el._logScroll) { el._logScroll = true; el.addEventListener('scroll', () => { if (typeof RIMTOWN_CHANGELOG === 'undefined' && el.scrollTop + el.clientHeight > el.scrollHeight - 2500) loadLog(); }, { passive: true }); }
        }
        // 語言切換:切完整頁重畫(首頁本身全部字串都有英文對照)
        el.querySelectorAll('.landing-lang [data-lang]').forEach(b => b.addEventListener('click', () => {
            const v = b.getAttribute('data-lang');
            if (v === I18N.getLang()) return;
            I18N.setLang(v);
            // 英文字典是另外載的:等它載好再重畫,不然按鈕上的字還是中文
            const go = () => { if (!this._landingActive) return; try { if (typeof LANDING3D !== 'undefined') LANDING3D.unmount(); } catch (e) {} this._renderLanding(); };
            let waited = false; try { if (v === 'en' && I18N.ensureDict && !(I18N.dictReady && I18N.dictReady())) { I18N.ensureDict(go); waited = true; } } catch (e) {}
            if (!waited) go();
        }));
        el.querySelector('#landing-register')?.addEventListener('click', () => this._openAuth('register'));
        el.querySelector('#landing-login')?.addEventListener('click', () => this._openAuth('login'));
        el.querySelector('#landing-continue')?.addEventListener('click', () => this._enterGame());
        el.querySelectorAll('[data-lp-log]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); el.querySelector('#landing-log')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); }));
        el.querySelectorAll('[data-lp-go]').forEach(btn => btn.addEventListener('click', () => { const g = btn.dataset.lpGo; if (g === 'continue') this._enterGame(); else this._openAuth(g); }));
        el.querySelector('#landing-logout')?.addEventListener('click', () => this._doLogout());
        el.querySelector('#landing-log-more')?.addEventListener('click', (ev) => {
            const box = el.querySelector('#landing-log'); if (!box) return;
            const expanded = box.classList.toggle('expanded');
            ev.currentTarget.textContent = expanded ? t('只看最近 3 版') : `${t('顯示全部')} (${log.length})`;
        });
        this._landingUpdateContinue();
    },
    _lpFillLog() {
        const el = document.getElementById('landing'); const box = el?.querySelector('#landing-log'); if (!box) return false;
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const log = (typeof RIMTOWN_CHANGELOG !== 'undefined' && Array.isArray(RIMTOWN_CHANGELOG)) ? RIMTOWN_CHANGELOG : [];
        box.innerHTML = log.map((e, i) => `<div class="landing-log-item${i >= 3 ? ' extra' : ''}">
                <div class="landing-log-head"><span>v${esc(e.version)}</span><time>${esc(e.date || '')}</time></div>
                <ul>${((I18N.getLang() === 'en' && e.changes_en && e.changes_en.length) ? e.changes_en : (e.changes || [])).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('') || `<div class="landing-log-item">${t('尚無紀錄')}</div>`;
        if (log.length > 3 && !el.querySelector('#landing-log-more')) {
            const b = document.createElement('button'); b.className = 'landing-more'; b.id = 'landing-log-more'; b.textContent = `${t('顯示全部')} (${log.length})`; box.after(b);
            b.addEventListener('click', () => { const ex = box.classList.toggle('expanded'); b.textContent = ex ? t('只看最近 3 版') : `${t('顯示全部')} (${log.length})`; });
        }
        return true;
    },
    // ============================================================
    // v5.69.0 首頁「村民的大腦」:村民怎麼社交:感知/挑人/八卦/對話/效果/記憶/反思/計畫
    // 內容直接讀遊戲常數(TRAIT_POOL / THOUGHT_DEFS / REL_TYPES),數字與程式一致
    // ============================================================
    _renderBrainSection() {
        const esc = s => this._escapeHtml ? this._escapeHtml(String(s)) : String(s);
        const steps = [
            ['', t('感知'), t('每 15 分鐘（1 tick）看一次同地點還醒著的人。睡覺的人不會主動搭話。')],
            ['', t('挑對象'), t('權重 = 5 ＋ 好感÷10 ＋ 心動÷10；好感低於 −30 的人權重大減。互動後冷卻 6 tick。')],
            ['', t('八卦'), t('30% 機率先講一則八卦。八卦性格的人一定講，其他人 30%。傳到第 2 手有 40% 會被誇大，20% 的八卦本來就是假的。')],
            ['', t('約出去'), t('好感 ≥ 30 時 12% 機率相約去酒館、公園、廣場、教堂、森林或圖書館；心動 > 40 就算約會。')],
            ['', t('對話'), t('鏡頭附近的對話由 AI 生成（受每日額度限制）；遠處的對話走規則式模板，但同樣寫進記憶。')],
            ['', t('效果'), t('對話改變雙方好感（−2 到 +5）與心動；正向增幅乘上性格相容度 0.2 到 1.6。約定會寫成「計畫」記憶，情緒波動大就當場改寫今天剩下的行程。')],
            ['', t('記憶'), t('每人 500 條記憶流。對話寫進「他會記住的那句話」，重要度 4 到 8。')],
            ['', t('反思與計畫'), t('每晚合成 1 到 2 條想法（跟誰走得近、暗戀、夢想）；每天最多 3 位由 AI 深度反思。清晨依記憶排今日行程。')],
        ];
        const traitFx = tr => {
            const d = tr || {}; const out = [];
            if (d.social) out.push(`${t('社交')} ${d.social > 0 ? '+' : ''}${d.social}`);
            if (d.work) out.push(`${t('工作')} ${d.work > 0 ? '+' : ''}${d.work}`);
            if (d.mood_base) out.push(`${t('基礎心情')} ${d.mood_base > 0 ? '+' : ''}${d.mood_base}`);
            if (d.mood_sensitivity) out.push(`${t('情緒敏感')} ×${d.mood_sensitivity}`);
            if (d.romance) out.push(`${t('戀愛')} ${d.romance > 0 ? '+' : ''}${d.romance}`);
            if (d.schedule) out.push(d.schedule === 'late' ? t('晚睡') : t('早起'));
            if (d.food) out.push(`${t('食量')} ×${d.food}`);
            if (d.comfort) out.push(`${t('舒適')} ${d.comfort}`);
            return out.join(' · ');
        };
        const traits = (typeof TRAIT_POOL !== 'undefined') ? Object.entries(TRAIT_POOL) : [];
        const traitChips = traits.map(([k, d]) => `<span class="landing-chip" title="${esc(d.description || '')}">${esc(t(d.label || k))}<small>${esc(traitFx(d))}</small></span>`).join('');
        const incompat = (typeof INCOMPATIBLE !== 'undefined') ? INCOMPATIBLE.map(([a, b]) => `${esc(t(TRAIT_POOL[a]?.label || a))} × ${esc(t(TRAIT_POOL[b]?.label || b))}`).join(t('、')) : '';
        const values = ['家庭', '自由', '知識', '財富', '權力', '藝術', '自然', '社群', '冒險', '和平'].map(v => `<span class="landing-chip small">${t(v)}</span>`).join('');
        const thoughts = (typeof THOUGHT_DEFS !== 'undefined') ? Object.values(THOUGHT_DEFS) : [];
        const thoughtRows = thoughts.map(d => `<tr><td>${esc(t(d.label))}</td><td class="${d.mood >= 0 ? 'pos' : 'neg'}">${d.mood > 0 ? '+' : ''}${d.mood}</td><td>${d.days}</td><td>${d.opinion ? (d.opinion > 0 ? '+' : '') + d.opinion : '-'}</td></tr>`).join('');
        const ladder = [
            ['≥ 61', t('摯友')], ['21 ~ 60', t('朋友')], ['−19 ~ 20', t('認識 / 陌生人')], ['−59 ~ −20', t('對手')], ['≤ −60', t('敵人')],
        ].map(([r, l]) => `<div class="landing-ladder-row"><span>${r}</span><b>${l}</b></div>`).join('');
        return `<section class="landing-section landing-brain" id="landing-brain"><details class="landing-fold"><summary><h2>${t('村民的大腦：他們是怎麼社交的')}</h2><span class="landing-fold-hint">${t('點開看完整的運作方式')}</span></summary>
            <p class="landing-brain-intro">${t('沒有劇本。每位村民每 15 分鐘做一次決定，靠的是自己的記憶、性格和跟對方的關係。下面是一輪社交的完整流程，數字都是遊戲裡實際用的參數。')}</p>
            <div class="landing-steps">${steps.map((s, i) => `<div class="landing-step"><div class="landing-step-no">${i + 1}</div><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join('')}</div>

            <div class="landing-brain-grid">
                <div class="landing-card">
                    <h3>${t('記憶流與檢索')}</h3>
                    <p>${t('每條記憶有時間、類別、內容、重要度（1 到 10）、涉及的人。要說話或做計畫時，用三個分數挑出最該想起的幾條，不會整本翻：')}</p>
                    <div class="landing-formula">${t('分數')} = 0.5 × ${t('時近')} + 3 × ${t('相關')} + 2 × ${t('重要度')}</div>
                    <ul class="landing-list">
                        <li><b>${t('時近')}</b>：0.85 ^ ${t('已過天數')}${t('，一週前的事只剩三成份量。')}</li>
                        <li><b>${t('相關')}</b>：${t('內容與當下話題的字元重疊度，加上「有沒有提到眼前這個人」。')}</li>
                        <li><b>${t('重要度')}</b>：${t('表白、絕交、劈腿這類事件是 8 到 10；日常觀察只有 2。')}</li>
                    </ul>
                    <div class="landing-demo" id="landing-mem-demo">
                        <div class="landing-demo-title">${t('自己調調看：一條記憶會被想起來嗎？')}</div>
                        <label>${t('已過天數')} <span data-out="age">3</span><input type="range" min="0" max="30" value="3" data-k="age"></label>
                        <label>${t('重要度')} <span data-out="imp">6</span><input type="range" min="1" max="10" value="6" data-k="imp"></label>
                        <label>${t('相關程度')} <span data-out="rel">0.5</span><input type="range" min="0" max="100" value="50" data-k="rel"></label>
                        <div class="landing-demo-score">${t('分數')} <b data-out="score">…</b> <span data-out="verdict"></span></div>
                    </div>
                </div>
                <div class="landing-card">
                    <h3>${t('性格參數')}</h3>
                    <p>${t('每人出生時抽 3 個特質（互斥的不會同時出現），加上 1 到 3 個價值觀。特質決定社交加成、工作效率、基礎心情、情緒敏感度與戀愛傾向。')}</p>
                    <div class="landing-chips">${traitChips}</div>
                    <p class="landing-muted">${t('互斥：')}${incompat}</p>
                    <p><b>${t('價值觀')}</b>：${values}</p>
                    <p><b>${t('相容度')}</b>：${t('善良配善良、魅力配害羞、沉穩配神經質會加分；刻薄配害羞、樂觀配悲觀、懶惰配勤勞會扣分。換算成 0.2 到 1.6 的倍率，乘在每次好感增幅上。')}</p>
                    <p><b>${t('六項需求')}</b>：${t('飢餓、休息、社交、舒適、娛樂、美感。白天每 tick 飢餓 −2、休息 −1.5、社交 −1；夜裡衰減放慢。任一項見底就拖累心情，心情又決定他今天想不想理人。')}</p>
                </div>
                <div class="landing-card">
                    <h3>${t('關係階梯')}</h3>
                    <p>${t('對每個人各記三個數：好感（−100 到 100）、信任、心動（0 到 100）。好感決定稱呼，心動超過 50 就是暗戀。')}</p>
                    <div class="landing-ladder">${ladder}</div>
                    <ul class="landing-list">
                        <li>${t('50 tick 沒互動，好感每天往 0 漂 0.8；情侶夫妻只漂 0.3。')}</li>
                        <li>${t('好感 > 20 且互動超過 3 次，相配的人每天 45% 機率心動 +1 到 +5；高好感高相配還有 6% 的「來電火花」+8 到 +16。')}</li>
                        <li>${t('雙方好感 ≤ −35：每隔 5 天 15% 機率在廣場對嗆；雙方 ≤ −60：正式絕交，觸發劇情名場面。')}</li>
                        <li>${t('聽到自己被造謠會當面對質，造謠者好感 −12；紅娘式八卦會讓兩位當事人開始注意彼此。')}</li>
                        <li>${t('戲劇導演每天看一眼全鎮：太平靜就悄悄推一把暗戀、舊帳或吃醋。')}</li>
                    </ul>
                </div>
                <div class="landing-card">
                    <h3>${t('想法與心情')}</h3>
                    <p>${t('事件會留下有期限的「想法」，直接加減心情，有些還會改變對當事人的看法：')}</p>
                    <div class="landing-table-wrap"><table class="landing-table"><thead><tr><th>${t('想法')}</th><th>${t('心情')}</th><th>${t('持續天數')}</th><th>${t('對人看法')}</th></tr></thead><tbody>${thoughtRows}</tbody></table></div>
                </div>
            </div>
            <p class="landing-muted landing-brain-foot">${t('成本閘門：只有鏡頭附近的對話、重要人物與每日額度內的行程／反思會呼叫 AI，其餘一律規則式運算，所以一百多人的城鎮同時「活著」也不會燒錢。')}</p>
            ${this._renderTechDetails()}
        </details></section>`;
    },
    // v5.70.0 首頁「技術細節」摺疊區:一次 AI 請求的旅程、兩個 AI 怎麼協作
    _renderTechDetails() {
        const flow = [
            ['', t('鏡頭附近發生對話')],
            ['', t('組提示詞')],
            ['', t('先問 Claude')],
            ['', t('失敗依序換 GPT、Groq 接手')],
            ['', t('守門：拒答／洩漏／簡體')],
            ['', t('寫回記憶與關係')],
        ];
        const ingredients = [
            [t('身分行'), t('「你是某某；跟你說話的是常路過的旅人（村民不知道祂是神）；現任鎮長是誰」，避免叫錯人')],
            [t('抽出的記憶'), t('用時近×相關×重要度挑出最該想起的 3 到 6 條，不是整本翻')],
            [t('關係數字'), t('對這個人的好感、信任、心動，以及目前的稱呼（朋友／對手／暗戀）')],
            [t('今天的計畫'), t('清晨排好的行程與現在正在做的事，讓對話有上下文')],
            [t('性格與心情'), t('三個特質、價值觀、當下心情與最近的想法')],
            [t('輸出格式'), t('只准輸出台詞與 EFFECTS 行（好感／心動／記憶變動），不准前言、分析、免責聲明')],
        ];
        const lanes = [
            [t('快車道 chat'), t('鏡頭附近的即時對話、完整智能體決策'), t('Claude'), t('GPT → Groq'), '15s → 15s → 12s'],
            [t('慢車道 background'), t('每日行程、深度反思、八卦與劇情'), t('Claude'), t('GPT → Groq'), '15s → 15s → 12s'],
        ];
        const handoff = [
            t('所有渠道共用一個 26 秒預算（無伺服器函式上限 30 秒），前面用掉多少，後面就只剩多少。'),
            t('逾時、限流（429）、伺服器錯誤：那條路冷卻。Groq 依回傳的重試時間冷卻，最短 5 分鐘；Claude 與 GPT 每失敗一次冷卻多 60 秒，上限 5 分鐘，成功即解除。'),
            t('回空白或拒絕扮演不算那條路壞掉，不冷卻，只是這一次換人。'),
            t('每次回應都帶著 provider、lane、model 與 fallback_from，出問題可以直接從紀錄看出是哪一段接手的。'),
        ];
        const quota = [
            t('每次 Groq 回應都會讀 x-ratelimit 標頭，記下剩餘 token、剩餘請求數與重置時間。'),
            t('下一次請求先估算要用多少：中文每字算 1 token，其他每 4 個字元算 1，再加輸出上限（至少 160）與 50 的緩衝。'),
            t('輪到 Groq 備援時，估算超過剩餘額度就排到最後，不會撞到 429 才發現。'),
            t('推理型模型（gpt-oss）固定輸出下限 160 token、推理強度 low、隱藏推理過程，避免它「想太久」回空白。'),
        ];
        const guard = [
            t('系統指示寫死：一律繁體中文（台灣用語）、不准自報 AI 身分、不准拒絕扮演、不准加前言。'),
            t('回覆若出現「I\'m Kiro / I am an AI / not designed for roleplay」這類句型，視同失敗，換另一條路重打。'),
            t('伺服器端先做簡轉繁（OpenCC 台灣用語），前端再掃一次；載入舊存檔時也會把殘留的簡體與洩漏句清掉。'),
            t('每位村民 500 條記憶上限，對話結束後只把「他會記住的那句話」寫進去，重要度 4 到 8。'),
        ];
        const cost = [
            t('只有鏡頭附近的村民才會呼叫 AI 對話，遠處的走規則式模板，但一樣寫進記憶、一樣影響好感。'),
            t('每天有 AI 額度：行程一批打包成一次請求（每人約 450 token），深度反思每天最多 3 位。'),
            t('Groq 免費層大約每分鐘 30 次、每天 1,000 次、每分鐘 8,000 token；只在 Claude 與 GPT 都故障時才用到，玩家不會感覺到斷線。'),
        ];
        const esc = (x) => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        return `<details class="landing-tech" id="landing-tech">
            <summary>${t('想看更深的技術細節：一次 AI 請求的旅程、兩個 AI 怎麼協作')}</summary>
            <div class="landing-tech-body">
                <div class="landing-flow">${flow.map((f, i) => `<div class="landing-flow-step"><span>${esc(f[1])}</span></div>${i < flow.length - 1 ? '<span class="landing-flow-arrow">→</span>' : ''}`).join('')}</div>
                <h4>① ${t('提示詞怎麼組')}</h4>
                <p class="landing-muted">${t('一次對話只打一個請求，裡面把村民「此刻腦子裡的東西」全部塞進去：')}</p>
                <dl class="landing-dl">${ingredients.map(x => `<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl>
                <h4>② ${t('兩條車道：誰先上')}</h4>
                <div class="landing-table-wrap"><table class="landing-table"><thead><tr><th>${t('車道')}</th><th>${t('用在哪')}</th><th>${t('先問誰')}</th><th>${t('備援')}</th><th>${t('時限')}</th></tr></thead><tbody>${lanes.map(l => `<tr>${l.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
                <p class="landing-muted">${t('對話、行程、反思、投票與鎮長裁決一律先問 Claude，品質一致；Claude 不能用才換 GPT，兩個都不能用才用 Groq 備援。')}</p>
                <h4>③ ${t('互相接手與冷卻')}</h4>
                <ul class="landing-list">${handoff.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>④ ${t('免費額度保護')}</h4>
                <ul class="landing-list">${quota.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>⑤ ${t('品質守門')}</h4>
                <ul class="landing-list">${guard.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <h4>⑥ ${t('成本閘門')}</h4>
                <ul class="landing-list">${cost.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
                <p class="landing-muted">${t('AI 金鑰全部放在伺服器環境變數，網頁原始碼與存檔裡都沒有；玩家不需要、也不能填自己的金鑰。')}</p>
            </div>
        </details>`;
    },
    _wireBrainDemo(root) {
        const box = root.querySelector('#landing-mem-demo');
        if (!box) return;
        const upd = () => {
            const age = parseFloat(box.querySelector('[data-k="age"]').value);
            const imp = parseFloat(box.querySelector('[data-k="imp"]').value);
            const rel = parseFloat(box.querySelector('[data-k="rel"]').value) / 100;
            const score = 0.5 * Math.pow(0.85, age) + 3 * rel + 2 * (imp / 10);
            box.querySelector('[data-out="age"]').textContent = age;
            box.querySelector('[data-out="imp"]').textContent = imp;
            box.querySelector('[data-out="rel"]').textContent = rel.toFixed(2);
            box.querySelector('[data-out="score"]').textContent = score.toFixed(2);
            const v = box.querySelector('[data-out="verdict"]');
            v.textContent = score >= 3.2 ? t('→ 幾乎一定會想起來') : score >= 2.2 ? t('→ 有機會被想起') : t('→ 大概忘了');
            v.style.color = score >= 3.2 ? '#34d399' : score >= 2.2 ? '#fbbf24' : '#f87171';
        };
        box.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', upd));
        upd();
    },
});
