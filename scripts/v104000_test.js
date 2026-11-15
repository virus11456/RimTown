// v10.4.0 表決出來的規定可以再表決改掉；改掉的也可以再表決恢復（都是一般提案）
// 以前：禁賭、生物安全法、清潔空氣法這些規定一通過就是永久的，沒有任何辦法拿掉。
// 現在：規定只是上一次表決的結果。任何一條都可以被提案廢除，被廢除的也可以被提案恢復，走的都是原本的提案流程。
//  1) 禁賭：剛通過時不能提廢除；滿 60 天、有人想廢，就會有人提案；提案寫得出實施幾天、為什麼、廢除後會怎樣
//  2) 立場：廢除案＝當初表決這條規定的立場反過來；恢復案＝當初的立場。理由沿用
//  3) 廢除通過 → 禁令解除；60 天內不能用原本的提案再立，也還不能提恢復。沒通過 → 90 天內不再提
//  4) 恢復：廢除滿 60 天、夠多人想要它回來 → 有人提「恢復」；沒通過 90 天內不再提；通過 → 規定回來，日子重新算
//  5) 其他十七條規定都能廢除、也都能恢復（含廢核、最低工資）；村民立的地標、還在生效的政令也算
//  6) 村民提案立下的規矩與傳統，每一條也算一條規定：可以廢除、可以恢復
//  7) 完整智能體（最大的權限）：村民發想提案時看得到所有現行規定與被廢除的規定，不必等 60 天就能自己提廢除或恢復，
//     可以同時有好幾件在表決；只擋同一條正在表決、同一條 10 天內才提過。還能提赦免（判決翻案）、調稅率與關稅
//     罷免首長門檻高：上任滿 20 天、離選舉 15 天以上、一個任期一次、四分之一的人連署才成案；六成贊成且贊成超過全鎮四成才通過；首長自己不能裁決
//  8) 舊存檔沒記是哪天禁的：用賭場歇業那天；都沒有就從第一次看到那天算
//  9) 鎮況頁列出現行規定與被廢除的規定，各自什麼時候可以提；存檔讀檔保留；中文、英文
// 10) 同一塊地新舊兩家賭場：招牌不再每次互相改
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
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; /* 先測沒開智能體的節奏；智能體的部分各自打開 */ const out = {}; const P = w.proposals; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    w.clock.year = 6; /* 鎮已經過了五年，「61 天前」才是正數 */ const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16); const d = w._absDay();
    const rnd = Math.random; const fixed = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = rnd; } };
    const openOf = (k) => P.items.filter(p => p.kind === k && p.status === 'open'); const repealOpen = () => openOf('law_repeal');
    const R = () => REPEAL.S(w); const tick = () => { R().lastDay = null; REPEAL.daily(w); };
    const strip = () => { for (const a of A) a.personality.traits = (a.personality.traits || []).filter(x => !['greedy', 'ascetic', 'kind'].includes(x)); };
    const pious = () => { for (const a of A) a.personality.traits.push('ascetic', 'kind'); };
    const txt = (p) => p ? P.title(p) + ' ' + P._fill(p.dk, p.dp) : ''; const lang = (n) => (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en' && I18N.localizeNames) ? I18N.localizeNames(n, true) : n;
    // ---------- 1) 禁賭 ----------
    const C = CASINO.S(w); for (const a of A) delete C.v[a.agentId]; strip();
    CASINO.enact(w, {});
    out.banned = { ban: C.ban, day: C.banDay === d, view: REPEAL.view(w).live.find(x => x.id === 'casino_ban') };
    fixed(0.001, tick); out.tooSoon = repealOpen().length;
    // 滿 60 天，可是沒什麼人想廢（大家都清心寡慾）：沒人提
    C.banDay = d - 61; pious();
    out.supNone = REPEAL.support(w, 'casino_ban').f; fixed(0.001, tick); out.noSupport = repealOpen().length; strip();
    // 一半以上的人以前常去賭：有人提案
    const gamblers = A.slice(0, Math.ceil(A.length * 0.6)); for (const a of gamblers) C.v[a.agentId] = 6; const priest = A[A.length - 1]; priest.personality.traits.push('ascetic', 'kind');
    out.sup = REPEAL.support(w, 'casino_ban').f; fixed(0.001, tick);
    const p = repealOpen()[0]; out.prop = p ? { ref: p.refKey, title: P.title(p), desc: P._fill(p.dk, p.dp), kind: t(PROPOSAL_KINDS.law_repeal.label) } : null;
    // 2) 立場：愛賭的贊成廢除、清心寡慾的反對；跟當初表決禁賭的立場相反
    if (p) { const g = gamblers[0]; const orig = fixed(0.5, () => [CASINO.vote(w, { kind: 'casino_ban' }, g), CASINO.vote(w, { kind: 'casino_ban' }, priest)]);
      fixed(0.5, () => { P._ruleVote(w, p, g); P._ruleVote(w, p, priest); }); out.votes = { g: p.votes[g.agentId], pr: p.votes[priest.agentId], orig: orig.map(x => x.v), whyText: [p.why[g.agentId], p.why[priest.agentId]].map(k => t(VOTE_WHY[k] || '')) }; }
    fixed(0.001, tick); out.onlyOne = repealOpen().length;
    // 3a) 沒通過：90 天內不再提
    if (p) P._decide(w, p, 'reject', 'mayor'); out.afterReject = { ban: C.ban, status: p?.status };
    R().lastAny = -99; fixed(0.001, tick); out.retryBlocked = repealOpen().length; out.waitView = REPEAL.view(w).live.find(x => x.id === 'casino_ban')?.wait;
    // 3b) 90 天後再提、這次通過：禁令解除
    R().last.casino_ban = d - 91; R().lastAny = -99; fixed(0.001, tick); const p2 = repealOpen()[0];
    if (p2) P._decide(w, p2, 'approve', 'mayor'); await sleep(50);
    const vd = REPEAL.view(w);
    out.repealed = { made: !!p2, status: p2?.status, ban: C.ban, done: vd.done.map(x => x.id), live: vd.live.map(x => x.id), wait: vd.done.find(x => x.id === 'casino_ban')?.wait };
    // 60 天內不能用原本的提案再立，也還不能提恢復；別的提案不受影響
    const cand = (kind) => ({ kind, key: kind + ':x' + Math.random(), jobs: [], make: () => ({ kind, key: kind + ':x', tk: '禁賭', tp: {}, dk: '{who}', dp: { who: A[0].name }, cost: {}, category: 'culture', jobBias: [] }) });
    const blocked = P._createWith(w, P._abs(w), cand('casino_ban'), A[0]); const other = P._createWith(w, P._abs(w), cand('medaid'), A[0]);
    strip(); for (const a of A) delete C.v[a.agentId]; pious(); R().lastAny = -99; fixed(0.001, tick);
    out.quiet = { blocked: blocked == null, other: !!other, quiet: REPEAL.quiet(w, 'casino_ban'), backTooSoon: openOf('law_restore').length }; if (other) P._decide(w, other, 'reject', 'mayor');
    // ---------- 4) 恢復 ----------
    R().done.forEach(x => { x.d = d - 61; }); R().last.casino_ban = d - 61; /* 廢除是 61 天前的事 */ out.quietOver = !REPEAL.quiet(w, 'casino_ban');
    // 滿 60 天，可是沒什麼人想要它回來（大家都愛賭）：沒人提
    strip(); for (const a of A) C.v[a.agentId] = 6; R().lastAny = -99; out.backSupNone = REPEAL.support(w, 'casino_ban', 'law_restore').f; fixed(0.001, tick); out.backNoSupport = openOf('law_restore').length;
    // 大家想要它回來：有人提恢復
    for (const a of A) delete C.v[a.agentId]; pious(); R().lastAny = -99; out.backSup = REPEAL.support(w, 'casino_ban', 'law_restore').f; fixed(0.001, tick);
    const b1 = openOf('law_restore')[0]; out.back = b1 ? { ref: b1.refKey, title: P.title(b1), desc: P._fill(b1.dk, b1.dp), kind: t(PROPOSAL_KINDS.law_restore.label) } : null;
    if (b1) { const orig = fixed(0.5, () => CASINO.vote(w, { kind: 'casino_ban' }, A[0])); fixed(0.5, () => P._ruleVote(w, b1, A[0])); out.backVote = { v: b1.votes[A[0].agentId], orig: orig.v, why: t(VOTE_WHY[b1.why[A[0].agentId]] || '') }; P._decide(w, b1, 'reject', 'mayor'); }
    R().lastAny = -99; fixed(0.001, tick); out.backRetry = { ban: C.ban, n: openOf('law_restore').length, wait: REPEAL.view(w).done.find(x => x.id === 'casino_ban')?.wait };
    R().lastBack.casino_ban = d - 91; R().lastAny = -99; fixed(0.001, tick); const b2 = openOf('law_restore')[0]; if (b2) P._decide(w, b2, 'approve', 'mayor'); await sleep(50);
    const vb = REPEAL.view(w); out.restored = { made: !!b2, ban: C.ban, banDay: C.banDay === d, live: vb.live.find(x => x.id === 'casino_ban'), done: vb.done.map(x => x.id), quiet: REPEAL.quiet(w, 'casino_ban') };
    strip();
    // ---------- 5) 其他十二條規定：廢除、再恢復 ----------
    const setOn = { bio_safety: () => { BIO.S(w).law = d - 70; }, bio_price: () => { BIO.S(w).price = d - 70; }, bio_gmban: () => { BIO.S(w).gmban = d - 70; }, bio_halt: () => { BIO.S(w).halt = d - 70; },
      steam_air: () => { STEAM.S(w).air = d - 70; }, steam_factory: () => { STEAM.S(w).factory = d - 70; }, steam_homun: () => { STEAM.S(w).homunban = d - 70; },
      sh_audit: () => { SHARES.S(w).sh.law.audit = d - 70; }, sh_staff: () => { SHARES.S(w).sh.law.staff = d - 70; }, medaid: () => { HEALTH.setAid(w); w.health.medaidDay = d - 70; },
      gene_rights: () => { MYTHSOC.rights(w); w.mythsoc.rightsAt = d - 70; }, antitrust_cap: () => { if (!w.cycle) w.cycle = {}; w.cycle.law = true; w.cycle.cap = 2; R().seen.antitrust_cap = d - 70; },
      gene_ban: () => { MYTH.S(w); MYTH.ban(w); R().seen.gene_ban = d - 70; }, tech_safety: () => { TECH.setLaw(w); w.tech.law = d - 70; }, faith_tax: () => { FAITH.setTax(w, true); w.faith.taxDay = d - 70; },
      tech_nonuke: () => { TECH.S(w).noNuke = d - 70; }, minwage: () => { w.wallet.minWage = 4.5; w.wallet.minWageDay = d - 70; } };
    out.laws = {};
    for (const id of Object.keys(setOn)) {
      try { setOn[id](); const L = REPEAL.LAWS[id]; const on0 = L.on(w); const days = REPEAL.view(w).live.find(x => x.id === id)?.days; const v = fixed(0.5, () => REPEAL.vote(w, { refKey: id, kind: 'law_repeal' }, A[0]));
        const pp = REPEAL.propose(w, id, A[0]); const text = txt(pp); if (pp) P._decide(w, pp, 'approve', 'mayor'); const off = !L.on(w);
        R().done.forEach(x => { x.d = d - 61; }); const vb0 = fixed(0.5, () => REPEAL.vote(w, { refKey: id, kind: 'law_restore' }, A[0]));
        const pb = REPEAL.propose(w, id, A[0], 'law_restore'); const textB = txt(pb); if (pb) P._decide(w, pb, 'approve', 'mayor');
        out.laws[id] = { on0, days, v: v.v, vb: vb0.v, why: !!(v.why && t(VOTE_WHY[v.why] || '')), made: !!pp, off, madeB: !!pb, onAgain: L.on(w), days2: REPEAL.view(w).live.find(x => x.id === id)?.days, text, textB };
      } catch (e) { out.laws[id] = { err: String(e.message || e) }; }
    }
    out.lawIds = Object.keys(REPEAL.LAWS);
    // ---------- 6) 村民提案立下的規矩：也可以廢除、恢復 ----------
    P.traditions = [{ text: '每月初一全鎮大掃除', by: A[2].name, id: 'L900', day: d - 100 }]; R().last = {}; R().lastBack = {};
    const tv = REPEAL.view(w).live.find(x => x.id === 'trad:L900'); const tp1 = REPEAL.propose(w, 'trad:L900', A[3]); const tText = txt(tp1);
    fixed(0.5, () => { if (tp1) { P._ruleVote(w, tp1, A[2]); P._ruleVote(w, tp1, A[4]); } }); const tVotes = tp1 ? { own: tp1.votes[A[2].agentId], ownWhy: t(VOTE_WHY[tp1.why[A[2].agentId]] || ''), otherWhy: t(VOTE_WHY[tp1.why[A[4].agentId]] || '') } : null;
    if (tp1) P._decide(w, tp1, 'approve', 'mayor'); const tOff = { n: P.traditions.length, done: REPEAL.view(w).done.find(x => x.id === 'trad:L900') };
    R().done.forEach(x => { x.d = d - 61; }); const tp2 = REPEAL.propose(w, 'trad:L900', A[2], 'law_restore'); const tText2 = txt(tp2); if (tp2) P._decide(w, tp2, 'approve', 'mayor');
    out.trad = { view: tv, text: tText, votes: tVotes, off: tOff, text2: tText2, back: P.traditions.map(x => [x.text, x.day === d, x.id]) };
    // ---------- 地標與政令 ----------
    try { P.landmarks = [{ name: '守望石', icon: '🗿', by: A[2].name, id: 'L901', day: d - 50 }]; R().last = {}; R().lastBack = {}; const C = w.council; C.activeDecrees = (C.activeDecrees || []).concat([{ id: 'prop_L902', title: '夜間巡邏令', effects: { defense_bonus: 0.1 }, expiresDay: d + 10 }]);
      const v1 = REPEAL.view(w); w.fullAgentMode = true; const v2 = REPEAL.view(w); w.fullAgentMode = false;
      const m1 = REPEAL.propose(w, 'mark:L901', A[3]); const mText = txt(m1); if (m1) P._decide(w, m1, 'approve', 'mayor'); const mOff = P.landmarks.length; R().done.forEach(x => { x.d = d - 61; });
      const m2 = REPEAL.propose(w, 'mark:L901', A[2], 'law_restore'); if (m2) P._decide(w, m2, 'approve', 'mayor');
      const dc = REPEAL.fromAI(w, A[4], { effects: [{ type: 'repeal', law: 'decree:prop_L902' }] }); const dText = txt(dc); if (dc) P._decide(w, dc, 'approve', 'mayor');
      out.dyn = { mark: v1.live.some(x => x.id === 'mark:L901'), decreeRule: v1.live.some(x => x.id === 'decree:prop_L902'), decreeAi: v2.live.some(x => x.id === 'decree:prop_L902'), mText, mOff, mBack: P.landmarks.map(x => [x.name, x.day === d]), dText, dGone: !(C.activeDecrees || []).some(x => x.id === 'prop_L902'), dNoRestore: !REPEAL.view(w).done.some(x => x.id === 'decree:prop_L902') };
      P.landmarks = []; } catch (e) { out.dyn = { err: String(e.message || e) }; }
    // ---------- 7) 完整智能體：自己提廢除／恢復 ----------
    R().last = {}; R().lastBack = {}; R().done = [{ id: 'medaid', d: d - 70, n: 90 }]; w.health.medaid = false; BIO.S(w).law = d - 80; STEAM.S(w).air = d - 200; C.banDay = d - 25;
    const eng = w.conversationEngine; const ok0 = eng.fullAgentOk, aj0 = eng._askJson, inv0 = eng.inventProposal; let prm = '';
    try { eng.fullAgentOk = () => true; eng._askJson = async (q) => { prm = q; return { skip: true }; }; await eng.inventProposal(w, A[0], []); } catch (e) { prm = 'ERR ' + e.message; }
    eng._askJson = aj0;
    const bad2 = REPEAL.fromAI(w, A[0], { effects: [{ type: 'repeal', law: 'no_such' }] });
    // 才實施 25 天的禁賭：智能體不必等 60 天，現在就能提；同一條正在表決、或 10 天內才提過，就不能再提
    const early = REPEAL.fromAI(w, A[1], { effects: [{ type: 'repeal', law: 'casino_ban' }] }); const dup = REPEAL.fromAI(w, A[2], { effects: [{ type: 'repeal', law: 'casino_ban' }] });
    if (early) P._decide(w, early, 'reject', 'mayor'); const soon = REPEAL.fromAI(w, A[2], { effects: [{ type: 'repeal', law: 'casino_ban' }] }); const blk1 = REPEAL.promptBlock(w, A[0]).includes('casino_ban');
    R().last.casino_ban = d - 11; const blk2 = REPEAL.promptBlock(w, A[0]).includes('casino_ban'); R().last.casino_ban = d;
    const n0 = P.items.length; let fb = 0;
    eng.inventProposal = async () => ({ title: 'x', pitch: '煤煙沒那麼嚴重，這條法該廢了。', effects: [{ type: 'repeal', law: 'steam_air' }] });
    try { await P._inventLLM(w, d, A[5], () => { fb++; }, []); } catch (e) { fb = 'ERR ' + e.message; }
    const ai1 = P.items[P.items.length - 1]; const aiA = { made: P.items.length === n0 + 1, kind: ai1?.kind, ref: ai1?.refKey, llm: !!ai1?.llm, pitch: ai1?.pitch || '', by: ai1?.proposerId === A[5].agentId, fb };
    const blk3 = REPEAL.promptBlock(w, A[0]);
    eng.inventProposal = async () => ({ title: 'y', pitch: '沒了補助，生病的人只能拖著。', effects: [{ type: 'restore', law: 'medaid' }] });
    try { await P._inventLLM(w, d, A[6], () => { fb++; }, []); } catch (e) { fb = 'ERR ' + e.message; }
    const ai2 = P.items[P.items.length - 1]; const aiB = { kind: ai2?.kind, ref: ai2?.refKey, llm: !!ai2?.llm, both: ai1?.status === 'open' && ai2?.status === 'open' && ai1 !== ai2 };
    if (ai2?.kind === 'law_restore') P._decide(w, ai2, 'approve', 'mayor'); if (ai1?.kind === 'law_repeal') P._decide(w, ai1, 'reject', 'mayor');
    eng.fullAgentOk = ok0; eng.inventProposal = inv0;
    out.ai = { prm: prm.split('\n').filter(l => /"type":"repeal"/.test(l) || l.includes('bio_safety') || /medaid[=＝]/.test(l)).join(' ¶ ').slice(0, 900), hasLive: prm.includes('bio_safety') && prm.includes('steam_air') && prm.includes('casino_ban'), hasGone: /medaid[=＝]/.test(prm), fx: /"type":"repeal"/.test(prm) && /"type":"restore"/.test(prm),
      bad2: bad2 == null, early: early?.kind === 'law_repeal' && early.refKey === 'casino_ban', dup: dup == null, soon: soon == null, blk1, blk2, a: aiA, blk3: { noOpen: !/steam_air/.test(blk3), others: /bio_safety/.test(blk3) }, b: aiB, medaidBack: !!w.health.medaid, own: ['gene_ban', 'tech_safety', 'faith_tax'].every(k => REPEAL.LAWS[k].own) };
    // ---------- 8) 舊存檔沒記是哪天禁的 ----------
    C.ban = true; C.banDay = undefined; w.things = w.things || { list: {} }; w.things.list = w.things.list || {}; w.things.list['casino:old'] = { id: 'casino:old', kind: 'casino', name: ['聚寶閣', 'Treasure Pavilion'], gone: true, goneDay: d - 25, place: 'casino' }; C.thing = 'casino:old';
    R().seen = {}; out.legacy1 = REPEAL.view(w).live.find(x => x.id === 'casino_ban')?.days;
    C.thing = null; R().seen = {}; out.legacy2 = REPEAL.view(w).live.find(x => x.id === 'casino_ban')?.days;
    // ---------- 9) 介面、存讀檔 ----------
    for (const id of Object.keys(REPEAL.LAWS)) { try { if (REPEAL.LAWS[id].on(w)) REPEAL.LAWS[id].off(w); } catch (e) {} } P.traditions = [{ text: '每月初一全鎮大掃除', by: A[2].name, id: 'L900', day: d - 100 }];
    C.ban = true; C.banDay = d - 25; BIO.S(w).law = d - 80; R().last = {}; R().lastBack = {}; R().seen = {}; R().done = [{ id: 'steam_air', d: d - 10, n: 200 }, { id: 'medaid', d: d - 70, n: 90 }];
    document.querySelectorAll('[data-kairo-tab="economy"]').forEach(e => { if (e.offsetParent) e.click(); }); await sleep(300);
    app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'proposals'; app._ppTab = 'town'; app.renderSidebar(); await sleep(300);
    const box = document.querySelector('.pp-laws'); out.ui = box ? { text: box.innerText.replace(/\s+/g, ' ').trim(), rows: box.querySelectorAll('.pp-lore-row').length, inView: (() => { const b = box.getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth + 1; })() } : null;
    out.hs = document.documentElement.scrollWidth > innerWidth + 1;
    const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv);
    out.save = { has: !!sv.repeal, done: (w2.repeal?.done || []).length, banDay: w2.casino?.banDay === d - 25, live: REPEAL.view(w2).live.map(x => x.id).sort().join(), gone: REPEAL.view(w2).done.map(x => x.id).sort().join(), reset: (() => { const w3 = new World(); w3.reset(); return w3.repeal == null; })() };
    // ---------- 赦免（判決翻案）、稅率與關稅 ----------
    try { const X = A[7], Y = A[8]; EXILE.S(w).pending[X.agentId] = { d0: d, until: d + 5, crime: true, reason: 'x' }; DARK.S(w).labor = [{ id: X.agentId, until: d + 3 }]; MONEY.S(w).fines = { [X.agentId]: { owed: 20, since: d, why: '罰款', paid: 0 } }; R().pardon = {};
      const pun = REPEAL.punished(w).map(x => [x.a.name === X.name, x.what]); const blk = REPEAL.promptBlock(w, A[0]);
      const none = REPEAL.fromAI(w, A[1], { effects: [{ type: 'pardon', name: A[9].name }] });   // 沒受處置的人：不成案
      const pp = REPEAL.fromAI(w, A[1], { effects: [{ type: 'pardon', name: X.name }] }); const text = txt(pp); const dup = REPEAL.fromAI(w, A[2], { effects: [{ type: 'pardon', name: X.name }] });
      fixed(0.5, () => { if (pp) { P._ruleVote(w, pp, X); P._ruleVote(w, pp, A[3]); } }); const selfV = pp ? [pp.votes[X.agentId], t(VOTE_WHY[pp.why[X.agentId]] || ''), t(VOTE_WHY[pp.why[A[3].agentId]] || '')] : null;
      if (pp) P._decide(w, pp, 'approve', 'mayor'); await sleep(30);
      const after = { exile: !!w.exile.pending[X.agentId], labor: DARK.S(w).labor.some(x => x.id === X.agentId), owed: MONEY.owedOf(w, X), status: pp?.status };
      // 規則版：被限期逐出小鎮的人，交情好的人夠多就有人出面求情
      EXILE.S(w).pending[Y.agentId] = { d0: d, until: d + 6, crime: false, reason: 'y' }; for (const a of A) if (a !== Y) a.relationships.getOrCreate(Y.agentId, Y.name).affinity = 70;
      const np = P.items.length; fixed(0.001, tick); const rp = P.items.slice(np).find(x => x.kind === 'pardon'); const ruleP = { made: !!rp, ref: rp?.refKey === Y.agentId }; if (rp) P._decide(w, rp, 'reject', 'mayor'); const stillOut = !!w.exile.pending[Y.agentId]; delete w.exile.pending[Y.agentId];
      // 稅率、關稅
      w.wallet.tax = 0.1; TRADE.S(w).tariff = 0; R().taxDay = -999; R().tariffDay = -999; const blk2 = REPEAL.promptBlock(w, A[0]);
      const same = REPEAL.fromAI(w, A[1], { effects: [{ type: 'tax', rate: 10 }] }); const tx = REPEAL.fromAI(w, A[1], { effects: [{ type: 'tax', rate: 15 }] }); const tx2 = REPEAL.fromAI(w, A[2], { effects: [{ type: 'tax', rate: 5 }] }); const tText = txt(tx); if (tx) P._decide(w, tx, 'approve', 'mayor');
      const tf = REPEAL.fromAI(w, A[1], { effects: [{ type: 'tariff', rate: 20 }] }); const fText = txt(tf); if (tf) P._decide(w, tf, 'approve', 'mayor'); const big = REPEAL.fromAI(w, A[3], { effects: [{ type: 'tax', rate: 90 }] });
      out.pardon = { pun, hasBlk: /"type":"pardon"/.test(blk) && blk.includes(lang(X.name)), blkLine: blk.split('\n').filter(l => /"type":"pardon"/.test(l)).join(' '), none: none == null, kind: pp?.kind, ref: pp?.refKey === X.agentId, text, label: t(PROPOSAL_KINDS.pardon.label), dup: dup == null, selfV, after, ruleP, stillOut };
      out.rates = { blk: blk2.split('\n').filter(l => /"type":"tax"/.test(l)).join(' '), same: same == null, kind: tx?.kind, dir: tx?.dir, busy: tx2 == null, tText, tax: w.wallet.tax, tfKind: tf?.kind, fText, tariff: TRADE.S(w).tariff, tenDays: big == null };
    } catch (e) { out.pardon = { err: String(e.message || e) }; out.rates = out.rates || { err: 'x' }; }
    // ---------- 罷免首長：門檻高 ----------
    try { const E = w.election; const Ld = E._officeHolder(w); const asker = A.find(a => a !== Ld); const N = A.length; const set = (v) => { for (const a of A) if (a !== Ld) a.relationships.getOrCreate(Ld.agentId, Ld.name).affinity = v; };
      const why = (fn) => { fn(); return REPEAL.recallInfo(w, asker).why || 'ok'; }; R().recallTerm = null; R().recallDay = -999; if (w.power) w.power.scandal = {};
      E.lastElectionDay = d - 30; set(60); const wSign = why(() => {}); const I0 = REPEAL.recallInfo(w, asker); const blk0 = /"type":"recall"/.test(REPEAL.promptBlock(w, asker)); const noSign = REPEAL.fromAI(w, asker, { effects: [{ type: 'recall' }] });
      set(-60); const wSettle = why(() => { E.lastElectionDay = d - 5; }); E.lastElectionDay = d - 30;
      const c0 = [w.clock.season, w.clock.day]; w.clock.season = '夏季'; w.clock.day = 10; E.lastElectionDay = w._absDay() - 30; const wTail = REPEAL.recallInfo(w, asker).why || 'ok'; w.clock.season = c0[0]; w.clock.day = c0[1]; E.lastElectionDay = d - 30;
      const wSelf = REPEAL.recallInfo(w, Ld).why; const I1 = REPEAL.recallInfo(w, asker); const blk = REPEAL.promptBlock(w, asker);
      const inv1 = eng.inventProposal; eng.inventProposal = async () => ({ title: 'r', pitch: '他只顧自己，不適合再帶這個鎮。', effects: [{ type: 'recall' }] }); await P._inventLLM(w, d, asker, () => {}, []); eng.inventProposal = inv1;
      const rc = P.items[P.items.length - 1]; const text = txt(rc); const wOpen = REPEAL.recallInfo(w, A.find(a => a !== Ld && a !== asker)).why;
      // 開票一：投票的人裡五成五贊成 → 沒過六成
      const vs = A.filter(a => a !== Ld); rc.votes = {}; vs.forEach((a, i) => { rc.votes[a.agentId] = i < Math.round(vs.length * 0.55) ? 'for' : 'against'; }); rc.votes[Ld.agentId] = 'against';
      const aff0 = asker.relationships.getOrCreate(Ld.agentId, Ld.name).affinity; P._mayorRule(w, rc, d, true); await sleep(30);
      const fail = { status: rc.status, by: rc.decidedBy, result: t(rc.result || ''), mayor: Ld.job?.key === 'mayor', electing: !!E.active, worse: asker.relationships.getOrCreate(Ld.agentId, Ld.name).affinity < aff0, once: REPEAL.recallInfo(w, asker).why };
      // 開票二：贊成的全是贊成，可是只有少數人投票 → 沒過「超過全鎮四成」
      const few = REPEAL.recallTally(w, P, { votes: Object.fromEntries(vs.slice(0, Math.max(1, Math.floor(N * 0.3))).map(a => [a.agentId, 'for'])) });
      // 下一個任期：再提，這次大家都贊成 → 通過
      R().recallTerm = null; R().recallDay = -999; E.lastElectionDay = d - 25; rc.key = 'recall:old'; const asker2 = A.find(a => a !== Ld && a !== asker); /* 上一個提的人剛被否決、沒面子，短期內不會再提案（人情世故） */ const why2 = REPEAL.recallInfo(w, asker2).why || 'ok'; const rc2 = REPEAL.recallPropose(w, asker2); if (rc2) { fixed(0.5, () => { for (const a of A) P._ruleVote(w, rc2, a); }); }
      const votes = rc2 ? { leader: rc2.votes[Ld.agentId], leaderWhy: t(VOTE_WHY[rc2.why[Ld.agentId]] || ''), f: P._count(rc2, 'for'), a: P._count(rc2, 'against'), why: t(VOTE_WHY[rc2.why[asker2.agentId]] || '') } : null;
      if (rc2) P._mayorRule(w, rc2, d, true); await sleep(50);
      out.recall = { N, wSign, I0: { s: I0.signers, need: I0.need }, blk0, noSign: noSign == null, wSettle, wTail, wSelf, I1: { ok: I1.ok, s: I1.signers, need: I1.need }, hasBlk: /"type":"recall"/.test(blk), blkLine: blk.split('\n').filter(l => /"type":"recall"/.test(l)).join(' '),
        kind: rc.kind, ref: rc.refKey === Ld.agentId, llm: !!rc.llm, pitch: rc.pitch, text, label: t(PROPOSAL_KINDS.recall.label), wOpen, fail, few: { f: few.f, n: few.n, pass: few.pass }, why2, made2: !!rc2, votes,
        status: rc2?.status, by: rc2?.decidedBy, mayorName: rc2?.mayorName || '', electing: !!E.active, stillMayor: Ld.job?.key === 'mayor', barred: w.power?.recalled === Ld.agentId, ui: REPEAL.view(w).recall };
    } catch (e) { out.recall = { err: String(e.message || e) }; }
    // ---------- 10) 同一塊地新舊兩家：招牌不互相改 ----------
    try { const tm = app.tileMap; const T1 = THINGS.register(w, { kind: 'casino', key: 'tA', name: ['舊賭場', 'Old House'], icon: '🎰', facts: 'x', place: 'casino', usable: true, build: { tmpl: 'tavern' } }); THINGS.syncMap(w, tm);
      THINGS.retire(w, T1.id); THINGS.syncMap(w, tm); const lab1 = tm.labelPositions?.casino?.name;
      const T2 = THINGS.register(w, { kind: 'casino', key: 'tB', name: ['新賭場', 'New House'], icon: '🎰', facts: 'x', place: 'casino', usable: true, build: { tmpl: 'tavern' } });
      const c1 = THINGS.syncMap(w, tm), lab2 = tm.labelPositions?.casino?.name, c2 = THINGS.syncMap(w, tm), c3 = THINGS.syncMap(w, tm), lab3 = tm.labelPositions?.casino?.name;
      out.sign = { built: !!tm.buildingZones?.casino, lab1, lab2, lab3, c1, c2, c3 }; } catch (e) { out.sign = { err: String(e.message || e) }; }
    return out;
  });
  const zh = lang === 'zh'; const noZh = (s) => !/[一-鿿]/.test(s || '');
  ok(r.banned.ban && r.banned.day && r.banned.view && r.banned.view.days === 0 && r.banned.view.wait === 60, '禁賭通過：記下是哪一天；現行規定列得出來，60 天後才能提案廢除', r.banned);
  ok(r.tooSoon === 0, '剛通過的規定不能馬上提廢除', r.tooSoon);
  ok(r.supNone < 0.3 && r.noSupport === 0, '滿 60 天但沒什麼人想廢（鎮上都是清心寡慾的人）：不會有人提', { f: r.supNone, n: r.noSupport });
  ok(r.sup >= 0.3 && r.prop && r.prop.ref === 'casino_ban', '滿 60 天、夠多人想廢：有人提案廢除禁賭', { f: r.sup, prop: r.prop });
  ok(r.prop && (zh ? /廢除「禁賭」/.test(r.prop.title) && /已經實施 61 天/.test(r.prop.desc) && /可以再開賭場/.test(r.prop.desc) : /Repeal "Gambling ban"/.test(r.prop.title) && /61 days/.test(r.prop.desc) && noZh(r.prop.title + r.prop.desc + r.prop.kind)), '廢除案寫得出：哪條規定、實施幾天、為什麼、廢除後會怎樣' + (zh ? '' : '（英文沒有殘留中文）'), r.prop);
  ok(r.votes && r.votes.g === 'for' && r.votes.pr === 'against' && r.votes.orig[0] === 'against' && r.votes.orig[1] === 'for' && r.votes.whyText.every(Boolean), '廢除案的立場跟當初表決禁賭時相反：愛賭的贊成廢除、清心寡慾的反對，各有理由', r.votes);
  ok(r.onlyOne === 1, '一件案子還在表決時，不會再冒出第二件', r.onlyOne);
  ok(r.afterReject.ban === true && r.retryBlocked === 0 && r.waitView > 0, '廢除沒通過：禁令照舊，90 天內不再提同一條', { a: r.afterReject, n: r.retryBlocked, wait: r.waitView });
  ok(r.repealed.made && r.repealed.ban === false && r.repealed.done.includes('casino_ban') && !r.repealed.live.includes('casino_ban') && r.repealed.wait === 60, '90 天後再提、這次通過：禁令解除，列在「被廢除的規定」，60 天後才能提恢復', r.repealed);
  ok(r.quiet.blocked && r.quiet.other && r.quiet.quiet && r.quiet.backTooSoon === 0 && r.quietOver, '廢除後 60 天內：不能用原本的提案再立，也還不能提恢復（別的提案不受影響）', { q: r.quiet, over: r.quietOver });
  ok(r.backSupNone < 0.3 && r.backNoSupport === 0, '廢除滿 60 天但沒什麼人想要它回來（大家都愛賭）：不會有人提恢復', { f: r.backSupNone, n: r.backNoSupport });
  ok(r.backSup >= 0.3 && r.back && r.back.ref === 'casino_ban' && (zh ? /恢復「禁賭」/.test(r.back.title) && /被廢除 61 天/.test(r.back.desc) && /輸光/.test(r.back.desc) && r.back.kind === '恢復規定' : /Restore "Gambling ban"/.test(r.back.title) && /61 days/.test(r.back.desc) && noZh(r.back.title + r.back.desc + r.back.kind)), '夠多人想要它回來：有人提「恢復禁賭」，寫得出廢除幾天、為什麼', { f: r.backSup, back: r.back });
  ok(r.backVote && r.backVote.v === 'for' && r.backVote.orig === 'for' && r.backVote.why, '恢復案的立場＝當初表決禁賭的立場（清心寡慾的贊成恢復），有理由', r.backVote);
  ok(r.backRetry.ban === false && r.backRetry.n === 0 && r.backRetry.wait > 0, '恢復沒通過：照樣沒有禁令，90 天內不再提', r.backRetry);
  ok(r.restored.made && r.restored.ban === true && r.restored.banDay && r.restored.live && r.restored.live.days === 0 && r.restored.live.wait === 60 && !r.restored.done.includes('casino_ban') && !r.restored.quiet, '90 天後再提、這次通過：禁賭回來了，日子從今天重新算（60 天後又可以提廢除）', r.restored);
  const L = r.laws; const ids = Object.keys(L); const bad = ids.filter(id => !(L[id].on0 && L[id].days === 70 && L[id].made && L[id].off && L[id].madeB && L[id].onAgain && L[id].days2 === 0 && L[id].why && L[id].v !== L[id].vb));
  ok(ids.length === 17 && bad.length === 0 && r.lawIds.length === 18, '其他十七條規定：提得出廢除案、通過後真的解除；再提恢復、通過後真的回來（連禁賭共 18 條）', { bad: bad.map(id => [id, L[id]]), n: r.lawIds.length });
  ok(zh ? ids.every(id => /廢除「/.test(L[id].text) && /恢復「/.test(L[id].textB)) : ids.every(id => noZh(L[id].text + L[id].textB)), '每一條的廢除案與恢復案文字' + (zh ? '都寫得出來' : '英文都沒有殘留中文'), zh ? ids.map(id => [L[id].text, L[id].textB].map(x => String(x).slice(0, 30))) : ids.filter(id => !noZh(L[id].text + L[id].textB)).map(id => (L[id].text + ' | ' + L[id].textB).slice(0, 200)));
  const T = r.trad;
  ok(T.view && T.view.free && T.view.days === 100 && T.view.wait === 0 && /每月初一全鎮大掃除/.test(T.text) && T.votes && T.votes.own === 'against' && T.votes.ownWhy && T.votes.otherWhy, '村民立下的規矩也算一條規定：可以提廢除；立規矩的人自己反對，各有理由', { view: T.view, text: T.text, votes: T.votes });
  ok(T.off.n === 0 && T.off.done && /每月初一全鎮大掃除/.test(T.text2) && T.back.length === 1 && T.back[0][1] === true && T.back[0][2] === 'L900', '規矩被廢除後從清單拿掉；提恢復通過後回到清單，日子重新算', { off: T.off, text2: T.text2, back: T.back });
  const AI = r.ai;
  ok(AI.hasLive && AI.hasGone && AI.fx, '智能體發想提案時看得到：所有現行規定（才實施 25 天的禁賭也在）、被廢除的規定、兩種效果怎麼寫', { prm: AI.prm, live: AI.hasLive, gone: AI.hasGone, fx: AI.fx });
  ok(zh || noZh(AI.prm), '給智能體的這段提示' + (zh ? '有內容' : '英文沒有殘留中文'), AI.prm);
  ok(AI.early && AI.bad2, '最大的權限：才實施 25 天的規定，智能體不必等 60 天就能提廢除；不存在的規定不成案', { early: AI.early, bad: AI.bad2 });
  ok(AI.dup && AI.soon && !AI.blk1 && AI.blk2, '只擋重複：同一條正在表決、或 10 天內才提過，就不能再提（也不列在提示裡）；過了 10 天又可以', { dup: AI.dup, soon: AI.soon, blk1: AI.blk1, blk2: AI.blk2 });
  ok(AI.a.made && AI.a.kind === 'law_repeal' && AI.a.ref === 'steam_air' && AI.a.llm && AI.a.pitch && AI.a.by && AI.a.fb === 0, '智能體自己提「廢除清潔空氣法」：開成正式的廢除案，帶著他自己的說法', AI.a);
  ok(AI.b.kind === 'law_restore' && AI.b.ref === 'medaid' && AI.b.llm && AI.b.both && AI.blk3.noOpen && AI.blk3.others && AI.medaidBack, '另一個人同時提「恢復公費醫療補助」：兩件一起表決；通過後補助真的回來', { b: AI.b, blk3: AI.blk3, back: AI.medaidBack });
  ok(AI.own, '本來就有自己提案的三條（基因編輯禁令、核安法、宗教捐獻稅）也進了表，智能體可以自己提；規則版不重複觸發', AI.own);
  const D = r.dyn;
  ok(!D.err && D.mark && /守望石/.test(D.mText) && D.mOff === 0 && D.mBack.length === 1 && D.mBack[0][1], '村民立的地標也算一條規定：廢除＝拆掉，恢復後重新立起來', D);
  ok(!D.err && !D.decreeRule && D.decreeAi && /夜間巡邏令/.test(D.dText) && D.dGone && D.dNoRestore, '還在生效的政令：智能體可以提案提前取消（本來就會到期，所以沒有恢復；沒開智能體時不列）', D);
  const PD = r.pardon;
  ok(!PD.err && PD.pun.length === 1 && PD.pun[0][0] && PD.hasBlk && PD.none && PD.kind === 'pardon' && PD.ref && PD.dup && (zh ? /赦免/.test(PD.text) && /還有 5 天就得走/.test(PD.text) && PD.label === '赦免' : /Pardon /.test(PD.text) && noZh(PD.text + PD.label + PD.blkLine)), '判決也能翻案：智能體看得到正在受處置的人，可以提案赦免；沒受處置的人不成案、同一人不重複提', PD);
  ok(!PD.err && PD.selfV && PD.selfV[0] === 'for' && PD.selfV[1] && PD.selfV[2] && PD.after.exile === false && PD.after.labor === false && PD.after.owed === 0, '赦免通過：撤銷還沒走的驅逐令、剩下的勞役、還沒繳清的罰款；本人贊成，各有理由', { v: PD.selfV, after: PD.after });
  ok(!PD.err && PD.ruleP.made && PD.ruleP.ref && PD.stillOut, '沒開智能體時：被限期逐出小鎮的人，交情好的人夠多就有人出面求情；沒通過就照樣得走', { rule: PD.ruleP, still: PD.stillOut });
  const RT = r.rates;
  ok(!RT.err && RT.same && RT.kind === 'tax' && RT.dir === 'up' && RT.busy && Math.abs(RT.tax - 0.15) < 1e-9 && RT.tfKind === 'tariff' && Math.abs(RT.tariff - 0.2) < 1e-9 && RT.tenDays && (zh ? /10%/.test(RT.tText) && /15%/.test(RT.tText) && /20%/.test(RT.fText) : noZh(RT.tText + RT.fText + RT.blk)) && /"type":"tax"/.test(RT.blk) && /"type":"tariff"/.test(RT.blk), '稅率與關稅：智能體覺得該調就能提（跟現在一樣的不成案、同時只有一件、10 天內不重提），通過後真的改', RT);
  const RC = r.recall;
  ok(!RC.err && RC.wSign === 'sign' && RC.I0.s < RC.I0.need && !RC.blk0 && RC.noSign, '罷免門檻一：連署不夠（對首長不滿的人不到四分之一）就不能成案，智能體也看不到這個選項', { why: RC.wSign, I0: RC.I0, blk0: RC.blk0, noSign: RC.noSign });
  ok(RC.wSettle === 'settle' && RC.wTail === 'tail' && RC.wSelf === 'self', '罷免門檻二：上任不滿 20 天不能提、離下次選舉不到 15 天不能提、首長不能提罷免自己', { settle: RC.wSettle, tail: RC.wTail, self: RC.wSelf });
  ok(RC.I1.ok && RC.I1.s >= RC.I1.need && RC.hasBlk && RC.kind === 'recall' && RC.ref && RC.llm && RC.pitch && RC.wOpen === 'open' && (zh ? /罷免/.test(RC.text) && /個人連署/.test(RC.text) && /六成贊成/.test(RC.text) && RC.label === '罷免首長' && /六成贊成/.test(RC.blkLine) : /Recall /.test(RC.text) && noZh(RC.text + RC.label) && noZh(RC.blkLine)), '條件都到了才看得到罷免選項；提出來是「罷免首長」案，寫明幾人連署與通過門檻；表決期間不能再提第二件', { I1: RC.I1, text: RC.text, blk: RC.blkLine, open: RC.wOpen });
  ok(RC.fail.status === 'rejected' && RC.fail.by === 'vote' && RC.fail.result && RC.fail.mayor && !RC.fail.electing && RC.fail.worse && RC.fail.once === 'once', '罷免門檻三：五成五贊成沒過六成 → 不通過；首長留任，提的人跟首長關係變差，這個任期不能再提', RC.fail);
  ok(RC.few.pass === false && RC.few.f < RC.few.n * 0.4, '罷免門檻四：只有少數人來投票，全部贊成也不算過（贊成的人要超過全鎮四成）', RC.few);
  ok(RC.made2 && RC.votes && RC.votes.leader === 'against' && RC.votes.leaderWhy && RC.votes.f > RC.votes.a && RC.votes.why && RC.status !== 'open' && RC.status !== 'rejected' && RC.by === 'vote' && RC.mayorName === '' && (RC.electing || !RC.stillMayor) && RC.barred, '下一個任期再提、這次大家都贊成：全鎮投票通過（首長沒有裁決權），提前改選，被罷免的人這次不能選', { why2: RC.why2, votes: RC.votes, status: RC.status, by: RC.by, electing: RC.electing, still: RC.stillMayor, barred: RC.barred });
  ok(r.legacy1 === 25 && r.legacy2 === 0, '舊存檔沒記是哪天禁的：用賭場歇業那天（25 天前）；都沒有就從今天算', { a: r.legacy1, b: r.legacy2 });
  ok(r.ui && r.ui.rows === 6 && (zh ? /連署 \d+／\d+ 人/.test(r.ui.text) : /of \d+ signatures/.test(r.ui.text)) && r.ui.inView && !r.hs && (zh ? /現行規定/.test(r.ui.text) && /禁賭 實施第 25 天 · 再 35 天後可以提案廢除/.test(r.ui.text) && /生物安全法 實施第 80 天 · 可以提案廢除/.test(r.ui.text) && /「每月初一全鎮大掃除」 實施第 100 天 · 可以提案廢除/.test(r.ui.text) && /清潔空氣法 10 天前表決廢除 · 再 50 天後可以提案恢復/.test(r.ui.text) && /公費醫療補助 70 天前表決廢除 · 可以提案恢復/.test(r.ui.text) : /Rules in force/.test(r.ui.text) && /in 35 days/.test(r.ui.text) && /restoring it can be proposed/.test(r.ui.text) && noZh(r.ui.text.replace('每月初一全鎮大掃除', ''))), '鎮況頁列出現行規定（含村民立的規矩）、被廢除的規定各自什麼時候可以提，以及罷免的連署門檻', r.ui);
  ok(r.save.has && r.save.done === 2 && r.save.banDay && r.save.live === 'bio_safety,casino_ban,trad:L900' && r.save.gone === 'medaid,steam_air' && r.save.reset, '存檔讀檔保留（哪天禁的、廢除紀錄）；開新鎮清空', r.save);
  ok(r.sign && r.sign.built && (r.sign.lab1 || '').length > 0 && r.sign.lab2 === r.sign.lab3 && r.sign.lab2 !== r.sign.lab1 && r.sign.c2 === false && r.sign.c3 === false, '同一塊地舊的歇業、新的開張：招牌換成新的那家，之後不再每次互相改', r.sign);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
