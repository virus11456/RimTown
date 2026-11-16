// v10.6.0 蓋出來的東西可以表決拆掉
//   1) 鎮上可以拆的：蓋好的建築（含升級）、運轉中的工廠、產業（只剩一個時不列）
//   2) 提案：一般提案（種類 demolish）；同時只有一件；剛蓋好、剛被否決的不提
//   3) 投票（沒開 AI）：提的人贊成、在那裡做事的人反對、公庫見底時在意錢的人贊成
//   4) 通過：建築真的不見、效果消失、維護費變少、回收三成建材；工廠倉庫的貨歸公庫；產業至少留一個、空出的位置可以再開
//   5) 沒開智能體：公庫連續五天見底又要付不少維護費 → 有人提拆最花錢的那一棟；開了智能體就不自動提
//   6) 智能體：發想提案的題目裡有【可以拆掉的】；AI 回 demolish 效果 → 開成正式的拆除案；代碼不對、已經有一件在表決就不成案
//   7) 城鎮以上要先過議會；存讀檔；中英
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
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const P = w.proposals; const sp = w.stockpile; const B = w.buildings;
    const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16);
    const clearOpen = () => { P.items = (P.items || []).filter(p => !['open', 'shelved', 'approved'].includes(p.status)); };
    const old = (id) => { DEMOLISH.S(w).seen[id] = w._absDay() - 60; };
    const addB = (key) => { const T = BUILDING_TEMPLATES[key]; B._counter = (B._counter || 0) + 1; B.completed.push({ id: 'build_t' + B._counter, name: T.name, description: T.description, costs: T.costs, workRequired: T.work, workDone: T.work, effects: T.effects || {}, status: 'complete', buildingKey: key, level: 1 }); B.recomputeEffects(w); };
    const rnd0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = rnd0; } };
    out.ver = RIMTOWN_APP_VERSION; out.kind = PROPOSAL_KINDS.demolish?.icon === '🏚️'; out.label = t(PROPOSAL_KINDS.demolish?.label || '');
    clearOpen(); B.completed = []; B.projects = []; w.processing.builtFactories = {}; w.demolish = null;
    // 1) 可以拆的
    addB('granary'); addB('town_walls');
    let L = DEMOLISH.list(w);
    out.list = { n: L.filter(x => x.kind === 'b').length, gran: L.find(x => x.id === 'b:granary')?.upkeep, wall: L.find(x => x.id === 'b:town_walls')?.upkeep, jobs: (L.find(x => x.id === 'b:granary')?.jobs || []).includes('farmer'), age: L.find(x => x.id === 'b:granary')?.age };
    out.effBefore = B.getEffect('food_capacity', 0);
    // 2) 剛蓋好的不提；夠久了才可以
    const gran = () => DEMOLISH.get(w, 'b:granary');
    out.fresh = DEMOLISH.okNow(w, gran(), false); out.freshAI = DEMOLISH.okNow(w, gran(), true);
    old('b:granary'); old('b:town_walls');
    out.aged = DEMOLISH.okNow(w, gran(), false);
    const farmer = A.find(a => a.job?.key === 'farmer'); const who = A.find(a => a.job?.key !== 'farmer' && a.job?.key !== 'cook' && a.job?.key !== 'mayor');
    const p1 = DEMOLISH.propose(w, 'b:granary', who, '');
    out.p1 = { made: !!p1, kind: p1?.kind, status: p1?.status, ref: p1?.refKey, title: P.title(p1), desc: P._fill(p1.dk, p1.dp).slice(0, 220) };
    out.second = !!DEMOLISH.propose(w, 'b:town_walls', who, ''); // 同時只有一件
    out.major = (() => { const lv0 = TIERS.S(w).lv; try { TIERS.S(w).lv = 1; return ASSEMBLY.isMajor(w, p1); } finally { TIERS.S(w).lv = lv0; } })();
    out.villageMajor = (() => { const lv0 = TIERS.S(w).lv; try { TIERS.S(w).lv = 0; return ASSEMBLY.isMajor(w, p1); } finally { TIERS.S(w).lv = lv0; } })();
    // 3) 投票
    const vote = (a) => { delete p1.votes[a.agentId]; P._ruleVote(w, p1, a); return { v: p1.votes[a.agentId], why: p1.why?.[a.agentId] }; };
    out.vMine = vote(who);
    out.vWork = farmer ? fix(0.99, () => vote(farmer)) : null;
    const other = A.find(a => a !== who && a !== farmer && !['farmer', 'cook'].includes(a.job?.key)); other.relationships.relationships[who.agentId] = other.relationships.relationships[who.agentId] || { affinity: 0 }; other.relationships.relationships[who.agentId].affinity = 0;
    const silver0 = sp.get('silver'); sp.resources.silver = 500; out.vKeep = fix(0.5, () => vote(other));
    sp.resources.silver = 5; other.personality.traits = [...new Set([...(other.personality.traits || []), 'greedy'])]; out.vBroke = fix(0.5, () => vote(other));
    sp.resources.silver = silver0;
    out.whyText = ['demolish_keep', 'demolish_work', 'demolish_cost', 'demolish_mine'].every(k => typeof VOTE_WHY[k] === 'string' && t(VOTE_WHY[k]).length > 3);
    // 4) 通過：真的拆
    const wood0 = sp.get('wood'), stone0 = sp.get('stone'); const mood0 = farmer ? (farmer.moodModifier || 0) : 0;
    P._decide(w, p1, 'approve', 'mayor'); if (p1.status === 'approved') P._execute(w, p1, w._absDay());
    L = DEMOLISH.list(w);
    out.gone = { status: p1.status, inList: L.some(x => x.id === 'b:granary'), completed: B.completed.some(b => b.buildingKey === 'granary'), eff: B.getEffect('food_capacity', 0), wood: sp.get('wood') - wood0, stone: sp.get('stone') - stone0, result: String(t(p1.result || '')).slice(0, 80), done: DEMOLISH.S(w).done.length, mood: farmer ? (farmer.moodModifier || 0) - mood0 : null,
      log: (w.messageLog || []).slice(-20).some(m => /🏚️/.test(m.content || '')) };
    // 被否決的 20 天內不再提（智能體 5 天）
    clearOpen(); const p2 = DEMOLISH.propose(w, 'b:town_walls', who, ''); P._decide(w, p2, 'reject', 'mayor');
    out.retry = { now: DEMOLISH.okNow(w, DEMOLISH.get(w, 'b:town_walls'), false), ai: DEMOLISH.okNow(w, DEMOLISH.get(w, 'b:town_walls'), true) };
    DEMOLISH.S(w).last['b:town_walls'] = w._absDay() - 6; out.retry.ai6 = DEMOLISH.okNow(w, DEMOLISH.get(w, 'b:town_walls'), true); out.retry.rule6 = DEMOLISH.okNow(w, DEMOLISH.get(w, 'b:town_walls'), false);
    DEMOLISH.S(w).last['b:town_walls'] = w._absDay() - 21; out.retry.rule21 = DEMOLISH.okNow(w, DEMOLISH.get(w, 'b:town_walls'), false);
    // 工廠
    w.processing.builtFactories.bakery = { key: 'bakery', status: 'active', buildProgress: 5, buildRequired: 5, recipe: null, productionProgress: 0, workers: [], warehouse: { bread: 7 } };
    w.processing.builtFactories.tea_house = { key: 'tea_house', status: 'building', buildProgress: 1, buildRequired: 5, recipe: null, productionProgress: 0, workers: [], warehouse: {} };
    L = DEMOLISH.list(w); out.fac = { active: L.some(x => x.id === 'f:bakery'), building: L.some(x => x.id === 'f:tea_house') };
    old('f:bakery'); const bread0 = sp.get('bread') || 0, w1 = sp.get('wood');
    const p3 = DEMOLISH.propose(w, 'f:bakery', who, ''); P._decide(w, p3, 'approve', 'mayor'); if (p3.status === 'approved') P._execute(w, p3, w._absDay());
    out.fac.gone = !w.processing.builtFactories.bakery; out.fac.bread = (sp.get('bread') || 0) - bread0; out.fac.wood = sp.get('wood') - w1; out.fac.status = p3.status;
    // 產業：只剩一個不列；兩個以上才可以拆，拆到剩一個為止
    const I = w.industry; const ks0 = Object.keys(I.industries); I.industries = { farming: { key: 'farming', level: 1, workers: [], dailyOutput: {} } }; I.firstChoice = 'farming';
    out.ind = { one: DEMOLISH.list(w).some(x => x.kind === 'i') };
    I.industries.lumber = { key: 'lumber', level: 1, workers: [], dailyOutput: {} };
    out.ind.two = DEMOLISH.list(w).filter(x => x.kind === 'i').length; old('i:farming'); old('i:lumber');
    const p4 = DEMOLISH.propose(w, 'i:farming', who, ''); P._decide(w, p4, 'approve', 'mayor'); if (p4.status === 'approved') P._execute(w, p4, w._absDay());
    out.ind.left = Object.keys(I.industries).join(','); out.ind.first = I.firstChoice; out.ind.unlock = I._pendingUnlock === true; out.ind.status = p4.status; out.ind.lastListed = DEMOLISH.list(w).some(x => x.kind === 'i');
    // 5) 沒開智能體：公庫見底又要付維護費
    clearOpen(); addB('clock_tower'); addB('bank'); old('b:clock_tower'); old('b:bank'); old('b:town_walls'); DEMOLISH.S(w).last = {}; DEMOLISH.S(w).lastAny = -99; DEMOLISH.S(w).poor = 0;
    const s1 = sp.get('silver'); sp.resources.silver = 3;
    const cnt = () => P.items.filter(p => p.kind === 'demolish' && p.status === 'open').length;
    const days = []; for (let i = 0; i < 6; i++) { DEMOLISH.S(w).lastDay = -1; DEMOLISH.daily(w); days.push(cnt()); }
    out.poor = { days, poor: DEMOLISH.S(w).poor, pick: P.items.find(p => p.kind === 'demolish' && p.status === 'open')?.refKey, big: ['b:town_walls', 'b:clock_tower', 'b:bank'].includes(P.items.find(p => p.kind === 'demolish' && p.status === 'open')?.refKey) };
    clearOpen(); DEMOLISH.S(w).last = {}; DEMOLISH.S(w).lastAny = -99; DEMOLISH.S(w).poor = 9; w.fullAgentMode = true; DEMOLISH.S(w).lastDay = -1; DEMOLISH.daily(w); out.poor.agentMode = cnt(); w.fullAgentMode = false;
    DEMOLISH.S(w).poor = 9; sp.resources.silver = 900; DEMOLISH.S(w).lastDay = -1; DEMOLISH.daily(w); out.poor.rich = { n: cnt(), poor: DEMOLISH.S(w).poor };
    sp.resources.silver = s1;
    // 6) 智能體
    clearOpen(); DEMOLISH.S(w).last = {}; w.fullAgentMode = true;
    const eng = w.conversationEngine; const ok0 = eng.fullAgentOk; eng.fullAgentOk = () => true; const ask0 = eng._askJson; let prompts = []; eng._askJson = async (p) => { prompts.push(p); return { skip: true }; };
    await eng.inventProposal(w, who, []);
    const pr = prompts[0] || ''; const PP = DEMOLISH.promptParts(w);
    out.prompt = { ctx: !!PP.ctx && pr.includes(PP.ctx.trim()), fx: pr.includes('"type":"demolish"'), code: pr.includes('b:town_walls'), upkeep: /b:town_walls[^、\n]*4/.test(pr), len: pr.length };
    eng._askJson = ask0;
    const inv0 = eng.inventProposal; const seq = (j) => { eng.inventProposal = async () => j; };
    const c0 = P.items.length; seq({ title: 'x', pitch: '城牆每天吃掉公庫的錢，拆了吧。', category: 'economy', effects: [{ type: 'demolish', key: 'b:town_walls' }] });
    let fb = false; await P._inventLLM(w, w._absDay(), who, () => { fb = true; }, []);
    const pa = P.items.find(p => p.kind === 'demolish' && p.status === 'open');
    out.ai = { made: P.items.length - c0, ref: pa?.refKey, llm: !!pa?.llm, pitch: !!pa?.pitch, fb };
    // 已經有一件在表決：不再成案；題目裡也不再列
    out.ai.busyPrompt = DEMOLISH.promptParts(w).ctx === '';
    out.ai.busy = DEMOLISH.fromAI(w, who, { effects: [{ type: 'demolish', key: 'b:bank' }] }) === null;
    clearOpen(); out.ai.bad = DEMOLISH.fromAI(w, who, { effects: [{ type: 'demolish', key: 'b:nothing' }] }) === null; out.ai.none = DEMOLISH.fromAI(w, who, { effects: [{ type: 'mood', who: 'all', amount: 3 }] }) === null;
    const byName = DEMOLISH.fromAI(w, who, { effects: [{ type: 'demolish', key: BUILDING_TEMPLATES.bank.name }] }); out.ai.byName = byName?.refKey;
    eng.inventProposal = inv0; eng.fullAgentOk = ok0; w.fullAgentMode = false;
    // 7) 存讀檔
    const dn = DEMOLISH.S(w).done.length; const data = JSON.parse(JSON.stringify(w.serialize()));
    w.demolish = null; w.loadSave(data); out.save = { done: (w.demolish?.done || []).length === dn && dn >= 3, seen: Object.keys(w.demolish?.seen || {}).length > 0 };
    out.view = DEMOLISH.view(w).done.length;
    I.industries = I.industries; void ks0;
    return out;
  });
  const zh = lang === 'zh';
  ok(/^\d+\.\d+\.\d+$/.test(r.ver) && r.kind && (zh ? r.label === '拆除' : r.label === 'Demolish'), '模組載入、提案種類「拆除」有圖示與名稱', { v: r.ver, k: r.kind, l: r.label });
  ok(r.list.n === 2 && r.list.gran === 2 && r.list.wall === 4 && r.list.jobs && r.list.age === 0, '可以拆的清單：一般建築每天維護 2、大型 4，知道誰靠它做事', r.list);
  ok(r.fresh === false && r.freshAI === false && r.aged === true, '剛蓋好的不提，夠久了才可以', { f: r.fresh, a: r.freshAI, o: r.aged });
  ok(r.p1.made && r.p1.kind === 'demolish' && r.p1.status === 'open' && r.p1.ref === 'b:granary' && (zh ? /拆除/.test(r.p1.title) && /回收三成建材/.test(r.p1.desc) : /Demolish/.test(r.p1.title) && /30%/.test(r.p1.desc)), '開成一般提案，說明寫出拆掉以後會怎樣', r.p1);
  ok(r.second === false, '同時只有一件拆除案', r.second);
  ok(r.major === true && r.villageMajor === false, '城鎮以上是大事要先過議會，村莊不用', { m: r.major, v: r.villageMajor });
  ok(r.vMine.v === 'for' && r.vMine.why === 'demolish_mine', '提的人贊成', r.vMine);
  ok(!r.vWork || (r.vWork.v === 'against' && r.vWork.why === 'demolish_work'), '在那裡做事的人反對', r.vWork);
  ok(r.vKeep.v === 'against' && r.vKeep.why === 'demolish_keep', '公庫有錢時一般人捨不得', r.vKeep);
  ok(r.vBroke.v === 'for' && r.vBroke.why === 'demolish_cost', '公庫見底時在意錢的人贊成', r.vBroke);
  ok(r.whyText, '投票理由都有文字', r.whyText);
  ok(r.gone.status === 'done' && !r.gone.inList && !r.gone.completed, '通過後建築真的不見', r.gone);
  ok(r.effBefore === 500 && r.gone.eff === 0, '它帶來的效果跟著消失', { b: r.effBefore, a: r.gone.eff });
  ok(r.gone.wood === 9 && r.gone.stone === 6, '回收三成建材（木 30→9、石 20→6）', { w: r.gone.wood, s: r.gone.stone });
  ok(r.gone.done === 1 && r.gone.log && (zh ? /拆掉了/.test(r.gone.result) : /Torn down/.test(r.gone.result)), '有紀錄、有日誌、提案結果寫出回收了什麼', r.gone);
  ok(r.gone.mood === null || r.gone.mood < 0, '靠它做事的人會難過', r.gone.mood);
  ok(r.retry.now === false && r.retry.ai === false && r.retry.ai6 === true && r.retry.rule6 === false && r.retry.rule21 === true, '被否決後 20 天內不再提（智能體 5 天）', r.retry);
  ok(r.fac.active && !r.fac.building, '工廠：運轉中的可以拆，還在蓋的不列', r.fac);
  ok(r.fac.status === 'done' && r.fac.gone && r.fac.bread === 7 && r.fac.wood === 6, '拆工廠：倉庫的貨歸公庫、回收三成建材', r.fac);
  ok(r.ind.one === false && r.ind.two === 2, '產業只剩一個時不能拆', r.ind);
  ok(r.ind.status === 'done' && r.ind.left === 'lumber' && r.ind.first === 'lumber' && r.ind.unlock && r.ind.lastListed === false, '拆掉一個產業：剩下的那個不能再拆，空出的位置可以再開', r.ind);
  ok(r.poor.days.join('') === '000011' && r.poor.big, '沒開智能體：公庫連續五天見底，有人提拆最花錢的大型建築', r.poor);
  ok(r.poor.agentMode === 0, '開了智能體就不自動提（交給村民自己）', r.poor.agentMode);
  ok(r.poor.rich.n === 0 && r.poor.rich.poor === 0, '公庫有錢就不提，天數歸零', r.poor.rich);
  ok(r.prompt.ctx && r.prompt.fx && r.prompt.code && r.prompt.upkeep, '發想提案的題目裡有【可以拆掉的】、代碼、維護費與 demolish 效果', r.prompt);
  ok(r.prompt.len < (zh ? 5700 : 17000), '題目長度在上限內', r.prompt.len);
  ok(r.ai.made === 1 && r.ai.ref === 'b:town_walls' && r.ai.llm && r.ai.pitch && !r.ai.fb, 'AI 回 demolish 效果 → 開成正式的拆除案', r.ai);
  ok(r.ai.busyPrompt && r.ai.busy && r.ai.bad && r.ai.none, '已有一件在表決、代碼不對、不是拆除的，都不成案', r.ai);
  ok(r.ai.byName === 'b:bank', 'AI 寫建築名稱也認得', r.ai.byName);
  ok(r.save.done && r.save.seen && r.view >= 3, '存讀檔後紀錄還在', { s: r.save, v: r.view });
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
