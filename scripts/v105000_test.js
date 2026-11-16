// v10.5.0 智能體認得鎮上已經有什麼；已經有的、剛提過的不再提；放寬兩個限制
//   1) 像不像：真實存檔裡那五條「寒冬夜裡，廣場爐火…」互相算重複；不相干的、只是套話一樣的標題不算
//   2) 整理：存檔裡重複的規矩與地標合併（留最早的編號、最完整的文字）；正在表決廢除的那一條不動
//   3) 認知：發想提案的題目裡有【鎮上已經有的】（建築、產業、店家、規矩、地標、正在表決的），而且放得進長度上限
//   4) 硬擋：AI 想出重複的 → 告訴它撞到什麼、再問一次；還是重複就不成案；不重複的照常成案
//   5) 放寬：智能體同一條規定 5 天內不重提（以前 10 天）；罷免沒過 45 天後可以再提（以前一個任期一次）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`);
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; w.clock.year = 6; const out = {}; const P = w.proposals; const d = w._absDay();
    const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16);
    const logs = () => (w.messageLog || []).slice(-30).map(m => m.content || '').join('\n');
    const FIRE = ['寒冬夜裡，廣場爐火由公庫補足木柴，冷的人隨時來烤火。', '寒冬夜裡，廣場爐火常燃，冷的人隨時來烤火，有心結的人同坐一桌喝熱湯。', '寒冬夜裡，廣場爐火常燃，冷的人隨時來烤火，有心結的人同坐一桌喝熱湯。', '鎮上有心結，就同坐一桌喝熱湯把話說開。', '寒夜爐火共享：廣場爐火常燃，冷的人隨時來烤火，有心結的人同坐一桌喝熱湯。'];
    const OTHER = '每月初一全鎮大掃除，掃完一起吃一頓。';
    // 1) 像不像
    const S = AWARE.sim, R = AWARE.TH.rule, T = AWARE.TH.title;
    out.sim = { f12: S(FIRE[0], FIRE[1]) >= R, f24: S(FIRE[1], FIRE[3]) >= R, f25: S(FIRE[1], FIRE[4]) >= R, f23: S(FIRE[1], FIRE[2]) === 1, other: FIRE.some(x => S(x, OTHER) >= R),
      t1: S('在鎮上蓋穀倉', '在鎮上蓋學堂') >= T, t2: S('替貓立雕像', '替狗立雕像') >= T, t3: S('辦一場秋收歌謠比賽', '辦秋收歌謠比賽') >= T, t4: S('替貓立雕像', '「替貓立雕像」') === 1,
      en1: S('On winter nights the plaza hearth stays lit for anyone who is cold', 'Keep the plaza hearth burning on winter nights for the cold') >= R, en2: S('Sweep the whole town on the first of each month', 'Keep the plaza hearth burning on winter nights') >= R,
      n1: AWARE.sameName('貓之石像', '貓之石像'), n2: AWARE.sameName('貓之石像', '狗之石像'), n3: AWARE.sameName('雷鷹禮拜堂', '雷鷹禮拜堂（東側）'), n4: AWARE.sameName('石像', '貓之石像') };
    // 2) 整理
    P.items = (P.items || []).filter(p => !['open', 'shelved', 'approved'].includes(p.status));
    P.traditions = FIRE.map((x, i) => ({ text: x, by: A[i].name, id: 'L10' + (i + 1), day: d - 40 + i })).concat([{ text: OTHER, by: A[6].name, id: 'L120', day: d - 5 }]);
    P.landmarks = [{ name: '貓之石像', icon: '🐱', by: A[0].name, id: 'L130', day: d - 30 }, { name: '貓之石像', icon: '🐈', by: A[1].name, id: 'L131', day: d - 20 }, { name: '雷鷹禮拜堂', icon: '⛪', by: A[2].name, id: 'L132', day: d - 10 }];
    w.aware = null; const n1 = AWARE.tidy(w);
    out.tidy = { n: n1, trads: P.traditions.map(x => [x.id, x.text]), marks: P.landmarks.map(x => [x.id, x.name]), log: /整併了 5 條|merged 5 rules/.test(logs()), again: (() => { AWARE.S(w).tidyDay = -1; return AWARE.tidy(w); })(), merged: AWARE.S(w).merged };
    // 正在表決廢除的那一條不動
    P.traditions = [{ text: FIRE[1], by: A[0].name, id: 'L201', day: d - 9 }, { text: FIRE[4], by: A[1].name, id: 'L202', day: d - 8 }];
    P.items.push({ id: 'L900', n: 900, kind: 'law_repeal', key: 'law_repeal:trad:L202', refKey: 'trad:L202', status: 'open', tk: '廢除', tp: {}, dk: '', dp: {}, votes: {}, why: {}, createdDay: d, proposerId: A[3].agentId, proposerName: A[3].name });
    AWARE.S(w).tidyDay = -1; out.busy = { n: AWARE.tidy(w), left: P.traditions.length }; P.items = P.items.filter(p => p.id !== 'L900'); AWARE.S(w).tidyDay = -1; out.busy.after = AWARE.tidy(w); out.busy.left2 = P.traditions.length;
    // 3) 認知：鎮上已經有的
    P.traditions = [{ text: FIRE[1], by: A[0].name, id: 'L201', day: d - 9 }, { text: OTHER, by: A[6].name, id: 'L120', day: d - 5 }]; P.landmarks = [{ name: '貓之石像', icon: '🐱', by: A[0].name, id: 'L130', day: d - 30 }];
    const BT = Object.entries(BUILDING_TEMPLATES).slice(0, 14); w.buildings.completed = BT.map(([k, v], i) => ({ id: 'b' + i, name: v.name, buildingKey: k, level: i === 1 ? 2 : 1, effects: {} })); w.buildings.projects = [{ id: 'bp', name: BUILDING_TEMPLATES.theater.name, status: 'building', workRequired: 10, workDone: 1 }];
    const ik = Object.keys(INDUSTRIES).slice(0, 3); for (const k of ik) w.industry.industries[k] = w.industry.industries[k] || { key: k, level: 1, workers: [], dailyOutput: {} };
    const fk = Object.keys(FACTORIES).slice(0, 2); for (const k of fk) w.processing.builtFactories[k] = w.processing.builtFactories[k] || { key: k, status: 'active', workers: [], warehouse: {} };
    try { const B = BIZ.S(w); if (!B.shops.length) B.shops.push({ id: 's1', type: 'teahouse', name: ['老陳茶館', "Chen's Teahouse"], owner: A[2].agentId, partner: null, profit: 3, price: 3, since: d - 10 }); } catch (e) { out.bizErr = String(e.message); }
    P.items.push({ id: 'L901', n: 901, kind: 'free', key: 'free:秋收歌謠比賽', status: 'open', tk: '辦一場秋收歌謠比賽', tp: {}, dk: 'x', dp: {}, votes: {}, why: {}, createdDay: d, proposerId: A[4].agentId, proposerName: A[4].name, fx: [] });
    P.items.push({ id: 'L902', n: 902, kind: 'free', key: 'free:替貓立雕像', status: 'rejected', decidedDay: d - 3, tk: '替鎮上的貓立一座雕像', tp: {}, dk: 'x', dp: {}, votes: {}, why: {}, createdDay: d - 6, proposerId: A[5].agentId, proposerName: A[5].name, fx: [] });
    const blk = AWARE.block(w); const H = AWARE.have(w);
    out.blk = { text: blk, len: blk.length, built: H.built.length, works: H.works.length, shops: H.shops.length, open: H.open.map(x => x.title), recent: H.recent.map(x => x.title) };
    // 發想提案的題目
    const eng = w.conversationEngine; const ok0 = eng.fullAgentOk; eng.fullAgentOk = () => true; const ask0 = eng._askJson; let prompts = []; eng._askJson = async (p) => { prompts.push(p); return { skip: true }; };
    w.fullAgentMode = true; const who = A[7];
    await eng.inventProposal(w, who, []); await eng.inventProposal(w, who, [], AWARE.avoidLine('冬夜爐火', { what: 'rule', text: FIRE[1] }));
    const brief = eng._townBrief(w);
    out.prompt = { len: prompts[0].length, max: eng._promptMax(), hasBlk: prompts[0].includes(blk), briefHasRule: brief.includes(OTHER.slice(0, 8)), inBrief: (prompts[0].split('\n').find(l => /^【鎮況】|^\[Town status\]|^【/.test(l) && l.includes(brief.slice(0, 12))) || '').includes(OTHER.slice(0, 8)), briefLine: (prompts[0].split('\n').find(l => l.includes(brief.slice(0, 12))) || '').slice(0, 60), avoid: prompts[1].slice(-300), avoidLast: /skip/.test(prompts[1].slice(-60)), noAvoid: !/剛才想提|just wanted to propose/.test(prompts[0]) };
    eng._askJson = ask0;
    // 4) 硬擋
    const inv0 = eng.inventProposal; let calls = []; const seq = (arr) => { let i = 0; eng.inventProposal = async (W, a, h, avoid) => { calls.push(avoid || ''); return arr[Math.min(i++, arr.length - 1)]; }; };
    const count = () => P.items.length; const last = () => P.items[P.items.length - 1]; const PR = () => { P.proposerCooldown = {}; };
    const dupRule = { title: '冬夜爐火不熄', pitch: '天冷了，讓大家有地方取暖。', category: 'welfare', cost: {}, effects: [{ type: 'tradition', text: '寒冬夜裡廣場爐火常燃，冷的人隨時來烤火。' }] };
    const fresh = { title: '河邊辦放燈夜', pitch: '夏夜到河邊放燈，替過世的人祈福。', category: 'culture', cost: { silver: 10 }, effects: [{ type: 'mood', who: 'all', amount: 2 }] };
    const dupMark = { title: '再立一座貓像', pitch: '貓守著糧倉，該有座像。', category: 'culture', cost: {}, effects: [{ type: 'landmark', name: '貓之石像', icon: '🐱' }] };
    const dupOpen = { title: '辦秋收歌謠比賽', pitch: '大家來唱。', category: 'culture', cost: {}, effects: [{ type: 'mood', who: 'all', amount: 2 }] };
    const dupRecent = { title: '替鎮上的貓立雕像', pitch: '貓該有座像。', category: 'culture', cost: {}, effects: [{ type: 'mood', who: 'all', amount: 1 }] };
    // a) 第一次重複、第二次換一件 → 成案一件，第二次有被告知撞到什麼
    let c0 = count(); calls = []; seq([dupRule, fresh]); PR(); await P._inventLLM(w, d, A[8], () => { out.fb1 = true; }, []);
    out.g1 = { made: count() - c0, calls: calls.length, told: /爐火|hearth|rule/.test(calls[1] || ''), title: last().tk, llm: !!last().llm };
    P.items = P.items.filter(p => p.tk !== fresh.title);
    // b) 兩次都重複 → 不成案、寫進日誌、也不退回系統的現成點子
    c0 = count(); calls = []; seq([dupRule, dupRule]); PR(); let fb = false; await P._inventLLM(w, d, A[9], () => { fb = true; }, []);
    out.g2 = { made: count() - c0, calls: calls.length, fb, log: /就沒再提|let it go/.test(logs()), blocked: AWARE.S(w).blocked };
    // c) 地標同名、跟正在表決的一樣、跟最近被否決的一樣
    const one = async (j, a) => { const c = count(); calls = []; seq([j, j]); PR(); await P._inventLLM(w, d, a, () => {}, []); return { made: count() - c, calls: calls.length, avoid: calls[1] || '' }; };
    out.g3 = { mark: await one(dupMark, A[10]), open: await one(dupOpen, A[11]), recent: await one(dupRecent, A[12]) };
    // d) 不重複的照常成案，只問一次
    c0 = count(); calls = []; seq([fresh]); PR(); await P._inventLLM(w, d, A[13], () => {}, []); out.g4 = { made: count() - c0, calls: calls.length }; P.items = P.items.filter(p => p.tk !== fresh.title);
    // e) 被表決廢除的規矩：另立一條一樣的也擋（要它回來是提恢復）
    try { REPEAL.S(w).shelf['trad:L300'] = { text: '入夜後街上不許喧嘩，違者掃街三天。', by: A[0].name, id: 'L300', day: d - 50 }; } catch (e) {}
    const dg = AWARE.dupOf(w, '夜裡安靜', [{ type: 'tradition', text: '入夜後街上不許喧嘩。' }]); out.g5 = dg ? dg.what : null; try { delete REPEAL.S(w).shelf['trad:L300']; } catch (e) {}
    // f) 同一種補法：已經有兩個案子在補木材，第三個就擋；補別的東西不擋；只有一個時不擋
    const woodP = (id, st, ago) => ({ id, n: +id.slice(1), kind: 'free', key: 'free:' + id, status: st, decidedDay: st === 'done' ? d - ago : undefined, tk: '補柴' + id, tp: {}, dk: 'x', dp: {}, votes: {}, why: {}, createdDay: d - ago, proposerId: A[0].agentId, proposerName: A[0].name, fx: [{ type: 'resource', res: 'wood', amount: 40 }] });
    const fxW = [{ type: 'resource', res: 'wood', amount: 30 }], fxF = [{ type: 'daily', res: 'food', amount: 3, days: 5 }];
    P.items.push(woodP('L951', 'open', 0)); const s1 = AWARE.dupOf(w, '夜裡多送一把柴火', fxW);
    P.items.push(woodP('L952', 'done', 2)); const s2 = AWARE.dupOf(w, '夜裡多送一把柴火', fxW); const s3 = AWARE.dupOf(w, '替孩子多備一點糧', fxF);
    P.items.find(p => p.id === 'L952').decidedDay = d - 9; const s4 = AWARE.dupOf(w, '夜裡多送一把柴火', fxW);
    out.g6 = { one: s1 ? s1.what : null, two: s2 ? s2.what : null, name: s2 ? s2.text : '', other: s3 ? s3.what : null, old: s4 ? s4.what : null, line: s2 ? AWARE.avoidLine('夜裡多送一把柴火', s2) : '' };
    P.items = P.items.filter(p => !/^L95/.test(p.id));
    eng.inventProposal = inv0; eng.fullAgentOk = ok0;
    // 5) 放寬
    const E = w.election; const L = E._officeHolder(w); const RS = REPEAL.S(w); const others = A.filter(a => a.agentId !== L.agentId);
    if (!w.power) w.power = {}; w.power.scandal = {}; for (const a of others) a.relationships.getOrCreate(L.agentId, L.name).affinity = -40;
    P.items = P.items.filter(p => p.kind !== 'recall'); E.lastElectionDay = d - 40; w.clock.season = '春季'; w.clock.day = 5; /* 第 6 年春天：首長選舉在第 7 年秋，離得很遠 */
    const d2 = w._absDay(); E.lastElectionDay = d2 - 40; RS.recallTerm = E.lastElectionDay; const why = (ago) => { RS.recallDay = d2 - ago; const I = REPEAL.recallInfo(w, others[0]); return I.ok ? 'ok' : I.why; };
    out.loose = { again: REPEAL.RC.again, w44: why(44), w45: why(45), w10: why(10), gap: REPEAL.AIGAP };
    w.fullAgentMode = true; w.casino = w.casino || {}; const V = (() => { try { RS.last.casino_ban = d2 - 4; const a = REPEAL.view(w); RS.last.casino_ban = d2 - 5; const b = REPEAL.view(w); return [a.ai, b.ai]; } catch (e) { return String(e.message); } })(); out.loose.view = V; w.fullAgentMode = false;
    // 存讀檔
    const data = JSON.parse(JSON.stringify(w.serialize())); const b0 = AWARE.S(w).blocked; w.loadSave(data); out.save = { blocked: w.aware?.blocked === b0, merged: w.aware?.merged >= 5 };
    out.ver = RIMTOWN_APP_VERSION; out.zh = /[一-鿿]/.test(blk.split('\n')[0]);
    return out;
  });
  const zh = lang === 'zh'; const S = r.sim;
  ok(S.f12 && S.f24 && S.f25 && S.f23 && !S.other, '存檔裡那五條爐火規矩互相算重複，跟大掃除那條不算', S);
  ok(!S.t1 && !S.t2 && S.t3 && S.t4, '標題：只是套話一樣（在鎮上蓋…、替…立雕像）不算重複；幾乎一樣的算', S);
  ok(S.en1 && !S.en2, '英文的規矩也比得出來', S);
  ok(S.n1 && !S.n2 && S.n3 && !S.n4, '地標：同名或整個包在裡面才算，「狗之石像」不算', S);
  const TD = r.tidy;
  ok(TD.n === 5 && TD.trads.length === 2 && TD.trads[0][0] === 'L101' && TD.trads[0][1] === '寒夜爐火共享：廣場爐火常燃，冷的人隨時來烤火，有心結的人同坐一桌喝熱湯。' && TD.trads[1][0] === 'L120', '五條爐火規矩合併成一條：留最早的編號、最完整的文字；不相干的留著', TD);
  ok(TD.marks.length === 2 && TD.marks[0][0] === 'L130' && TD.log && TD.again === 0 && TD.merged === 5, '兩個貓之石像剩一個；日誌寫出整併了幾條；再整理一次不會再動', TD);
  ok(r.busy.n === 0 && r.busy.left === 2 && r.busy.after === 1 && r.busy.left2 === 1, '正在表決廢除的那一條先不動，表決完才整理', r.busy);
  const B = r.blk;
  ok(B.built === 14 && B.works === 5 && B.shops >= 1 && B.open.length === 1 && B.recent.length === 1, '認得出鎮上有的建築、產業與工廠、店家、正在表決與最近提過的案子', { b: B.built, w: B.works, s: B.shops, o: B.open, r: B.recent });
  ok((zh ? /鎮上已經有的/.test(B.text) && /不要再提一次/.test(B.text) && /建築：/.test(B.text) && /蓋到一半：/.test(B.text) && /產業與工廠：/.test(B.text) && /店家：/.test(B.text) && /規矩與傳統：/.test(B.text) && /地標：/.test(B.text) && /貓之石像/.test(B.text) && /秋收歌謠比賽/.test(B.text) && /Lv2/.test(B.text)
    : /What the town already has/.test(B.text) && /do not propose it again/.test(B.text) && /Shops: /.test(B.text) && /Industries and workshops: /.test(B.text) && /under construction: /.test(B.text)) && B.len < 700, '【鎮上已經有的】寫出每一類，講明不要再提；長度控制在 700 字內', { len: B.len, text: B.text });
  const PM = r.prompt;
  ok(PM.hasBlk && !PM.inBrief && PM.briefLine && PM.briefHasRule && PM.noAvoid, '發想提案的題目裡有這一段；鎮況那一行不再重複列規矩（其他 AI 呼叫用的鎮況照舊有）', PM);
  ok(PM.len < PM.max, `題目放得進長度上限（${PM.len}／${PM.max}）`, PM);
  ok((zh ? /你剛才想提「冬夜爐火」，可是鎮上已經有這條規矩/.test(PM.avoid) && /完全不同的事/.test(PM.avoid) : /You just wanted to propose "冬夜爐火", but the town already has this rule/.test(PM.avoid)) && PM.avoidLast, '撞到重複時，題目最後告訴它撞到哪一條、請它換一件事', PM.avoid);
  ok(r.g1.made === 1 && r.g1.calls === 2 && r.g1.told && r.g1.title === '河邊辦放燈夜' && r.g1.llm && !r.fb1, '第一次想的重複 → 再問一次（告訴它撞到什麼）→ 換一件事就成案', r.g1);
  ok(r.g2.made === 0 && r.g2.calls === 2 && !r.g2.fb && r.g2.log && r.g2.blocked >= 1, '兩次都重複 → 不成案、日誌寫「就沒再提」、不退回系統的現成點子', r.g2);
  ok(r.g3.mark.made === 0 && r.g3.open.made === 0 && r.g3.recent.made === 0 && r.g3.mark.calls === 2 && (zh ? /已經有這個地標/.test(r.g3.mark.avoid) && /正在表決/.test(r.g3.open.avoid) && /最近才有人提過/.test(r.g3.recent.avoid) : /already has this landmark/.test(r.g3.mark.avoid) && /being voted on/.test(r.g3.open.avoid) && /only recently/.test(r.g3.recent.avoid)), '同名地標、跟正在表決的一樣、跟最近被否決的一樣，都擋下', r.g3);
  ok(r.g4.made === 1 && r.g4.calls === 1, '不重複的照常成案，只問一次', r.g4);
  ok(r.g6.one === null && r.g6.two === 'same' && r.g6.other === null && r.g6.old === null && (zh ? /已經有好幾個案子在補/.test(r.g6.line) : /several proposals are already adding/.test(r.g6.line)), '已經有兩個案子在補同一種物資，第三個擋下；只有一個、補別的、或那是好幾天前的事都不擋', r.g6);
  ok(r.g5 === 'gone', '被表決廢除的規矩：另立一條一樣的也擋（要它回來是提恢復）', r.g5);
  const LO = r.loose;
  ok(LO.again === 45 && LO.w44 === 'once' && LO.w45 === 'ok' && LO.w10 === 'once', '罷免沒過 45 天後可以再提（以前一個任期只能一次）', LO);
  ok(LO.gap === 5, '智能體同一條規定 5 天內不重提（以前 10 天）', LO);
  ok(r.save.blocked && r.save.merged, '存讀檔保留統計', r.save);
  ok(/^\d+\.\d+\.\d+$/.test(r.ver), '讀得到版本號', r.ver); // 不寫死版本：這支測試之後每一版都要照過
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
