// v6.51.0 寵物動物 + 人性陰暗面(講壞話、說謊、陰謀、誤會) + 農田破壞修正
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(3500);
    // ---------- 寵物 ----------
    const pet = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; const S = PETS.ensure(w);
      const owned = S.list.filter(p => p.owner), strays = S.list.filter(p => !p.owner && p.sp !== 'chicken'), hens = S.list.filter(p => p.sp === 'chicken');
      const o = w.agents[owned[0].owner]; const food0 = w.stockpile.get('food');
      PETS.daily(w);
      const th = (o.thoughts || []).map(x => x.kind); const eggs = w.stockpile.get('food') - food0;
      const brief = w.conversationEngine._agentBrief(w, o).mem.join(' | ');
      const prof = w.conversationEngine._buildCharacterProfile(o).status;
      // 3D:每隻都有模型,跟著主人的會靠近主人
      app._petViewAt = 0; await new Promise(r => setTimeout(r, 2500));
      const tm = app.tileMap; const meshes = Object.keys(tm._petMeshes || {}).length;
      const near = owned.map(p => { const m = tm._petMeshes?.[p.id]; const op = tm.agentPositions[p.owner]; const om = tm._agentMeshes[p.owner]; if (!m || !op || !om?.visible) return null; return Math.hypot(m.position.x - op.x / TILE, m.position.z - op.y / TILE); }).filter(x => x !== null);
      // 主人離開 → 流浪
      const p0 = owned[0]; const keep = w.agents[p0.owner]; delete w.agents[p0.owner]; PETS.daily(w); const becameStray = !p0.owner; w.agents[keep.agentId] = keep;
      // 存讀檔
      const blob = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(blob);
      // 村民卡顯示寵物
      const other = owned[1] && owned[1].owner; let card = '';
      if (other) { app.state = w.getState(); app._showNpcCard(other); card = document.getElementById('npc-quick-card').innerText; app._hideNpcCard(); }
      return { owned: owned.length, strays: strays.length, hens: hens.length, farm: !!w.townMap?.locations?.farm, th, eggs, brief, prof, meshes, total: S.list.length, near, becameStray, rt: (w2.pets?.list || []).length, card, petName: owned[1] ? PETS.view(w).find(x => x.id === owned[1].id)?.name : '' };
    });
    ok(pet.owned >= 2 && pet.strays >= 2 && (!pet.farm || pet.hens >= 4), '一開始就有主人的貓狗、廣場流浪貓、農場的雞', pet);
    ok(pet.th.includes('pet_company') && (!pet.farm || pet.eggs >= pet.hens), '有寵物陪伴的心情；雞每天下蛋', { th: pet.th, eggs: pet.eggs });
    ok(/養了|Has a/.test(pet.brief) && /養了|Has a/.test(pet.prof), 'AI 知道自己養了寵物（提案資料與聊天角色資料）', { b: pet.brief.slice(0, 160), p: pet.prof });
    ok(pet.meshes === pet.total, '3D 每隻動物都有模型', { meshes: pet.meshes, total: pet.total });
    ok(pet.near.length === 0 || pet.near.some(d => d < 3), '寵物會跟在主人身邊', pet.near);
    ok(pet.becameStray, '主人不在了，寵物變成流浪的', null);
    ok(pet.rt === pet.total, '寵物存讀檔', { rt: pet.rt, total: pet.total });
    ok(!pet.petName || pet.card.includes(pet.petName), '村民卡上看得到他養的寵物', { card: pet.card.slice(0, 200), n: pet.petName });
    // ---------- 陰暗面 ----------
    const dk = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; const ag = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const R = Math.random; const low = () => { Math.random = () => 0.01; }; const back = () => { Math.random = R; };
      const A = ag[0], B = ag[1], C = ag[2], V = ag[3];
      A.personality.traits = ['jealous', 'abrasive']; C.personality.traits = ['kind']; B.personality.traits = ['optimist'];
      const set = (x, y, v) => { x.relationships.getOrCreate(y.agentId, y.name).affinity = v; };
      set(A, B, 40); set(A, C, -70); set(B, C, 0);
      // 講壞話
      DARK.S(w).spoke = {}; low(); const bm = DARK.badmouth(w, A, B); back();
      const g = (w.gossipNetwork.activeGossip || []).filter(x => x.tone === 'diss' && x.source === A.name).pop();
      const bMem = (B.memory.entries || []).slice(-3).map(e => e.content).join(' | ');
      // 正直的朋友會幫忙說話、可能告訴本人
      const K = ag[4]; K.personality.traits = ['kind']; set(A, K, 40); set(K, C, 60); DARK.S(w).spoke = {}; low(); DARK.badmouth(w, A, K); back();
      const kMem = (K.memory.entries || []).slice(-2).map(e => e.content).join(' | '); const cTh = (C.thoughts || []).map(x => x.kind);
      // 陰謀:A 恨 V
      set(A, V, -90); V.personality.traits = []; DARK.S(w).cool = {};
      const D = DARK.S(w); const n0 = D.secrets.length;
      const d0 = w.proposals._abs(w);
      w.proposals._abs = () => d0; low(); DARK.daily(w); back();
      const plan = D.secrets.slice(n0).find(s => s.stage === 'plan');
      w.proposals._abs = () => d0 + 1; Math.random = () => 0.5; DARK.daily(w); back();
      const acted = plan && plan.stage;
      const vTh = (V.thoughts || []).map(x => x.kind);
      const view = DARK.view(w);
      // 拆穿
      const trust0 = ag[6].relationships.getOrCreate(A.agentId, A.name).trust; if (plan) DARK.reveal(w, plan, ag[5]);
      const aTh = (A.thoughts || []).map(x => x.kind), vTh2 = (V.thoughts || []).map(x => x.kind);
      const trust = ag[6].relationships.getOrCreate(A.agentId, A.name).trust - trust0;
      delete w.proposals._abs;
      // 誤會:內向的人被誤會,之後解開
      const shy = ag[7]; shy.personality.traits = ['shy']; ag.filter(a => a !== shy).forEach(a => { a.personality.traits = (a.personality.traits || []).filter(t => t !== 'shy'); });
      D.mis = []; Math.random = () => 0.1; DARK.daily(w); back();
      const mis = D.mis[0]; let cleared = false;
      if (mis) { w.proposals._abs = () => d0 + 3; Math.random = () => 0.05; DARK.daily(w); back(); delete w.proposals._abs; cleared = !!mis.ok; }
      const shyTh = (shy.thoughts || []).map(x => x.kind);
      // 善意的謊言
      const kindA = ag[8], sad = ag[9]; kindA.personality.traits = ['kind']; sad.mood = 10; set(kindA, sad, 50);
      const s0 = D.secrets.length; Math.random = () => 0.01; try { DARK.daily(w); } finally { back(); }
      const white = D.secrets.slice(s0).some(s => s.kind === 'white');
      // 競選對手
      const E = w.election; const oldE = { active: E.active, phase: E.phase, candidates: E.candidates };
      const X = ag[10], Y = ag[11]; X.personality.traits = ['gossip', 'jealous']; E.active = true; E.phase = 'campaign'; E.candidates = [{ agentId: X.agentId, name: X.name }, { agentId: Y.agentId, name: Y.name }];
      const g0 = DARK.grudge(w, X, Y); const s1 = D.secrets.length; Math.random = () => 0.05; try { DARK.daily(w); } finally { back(); }
      const dirty = D.secrets.slice(s1).some(s => s.culprit === X.agentId && (s.kind === 'slander' || s.kind === 'promise'));
      Object.assign(E, oldE);
      // AI 知道自己的恩怨與秘密
      const brief = w.conversationEngine._agentBrief(w, A).mem.join(' | ');
      // 存讀檔
      const blob = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(blob);
      // 提案頁:只有你知道的真相
      app.state = w.getState(); app._ppTab = 'truth'; const box = document.createElement('div'); app.renderProposals(box);
      return { bm, g: !!g, gTone: g?.tone, bMem, kMem, cTh, plan: !!plan, kind: plan?.kind, acted, vTh, viewN: view.secrets.length, aTh, vTh2, trust, mis: mis?.kind, cleared, shyTh, white, g0: g0.why, dirty, brief, rtSecrets: (w2.dark?.secrets || []).length, panel: box.innerHTML.includes('pp-secrets') };
    });
    ok(dk.bm && dk.g && dk.gTone === 'diss' && /說|told|said/.test(dk.bMem), '講壞話:跟朋友抱怨仇人，壞話會傳出去、聽的人記得', { bm: dk.bm, mem: dk.bMem.slice(0, 120) });
    ok(/替|stood up/.test(dk.kMem), '正直又跟被講的人要好的朋友會幫忙說話', dk.kMem.slice(0, 150));
    ok(dk.plan && dk.acted === 'done', '有深仇又陰險的人會籌劃陷害，隔天動手', { plan: dk.plan, kind: dk.kind, acted: dk.acted });
    ok(dk.viewN > 0 && dk.panel, '玩家看得到真相（提案頁「只有你知道的真相」）', { n: dk.viewN, panel: dk.panel });
    ok(dk.aTh.includes('exposed') && dk.trust < 0, '被拆穿：信任崩盤、心情大跌', { aTh: dk.aTh, trust: dk.trust });
    ok(['frame', 'sabotage', 'lobby', 'credit'].includes(dk.kind) && (dk.kind === 'lobby' || dk.vTh.some(k => ['wrongly_blamed', 'work_ruined', 'credit_stolen'].includes(k))), '被陷害的人真的受影響（被冤枉、工作被破壞…）', { kind: dk.kind, vTh: dk.vTh });
    ok(dk.mis && dk.cleared, '誤會會發生，也會解開', { mis: dk.mis, cleared: dk.cleared });
    ok(dk.mis !== 'cold' || dk.shyTh.includes('misunderstood') || dk.shyTh.includes('cleared_up'), '內向的人被誤會會覺得委屈，解開後鬆一口氣', dk.shyTh);
    ok(dk.white, '善良的人會說善意的謊言安慰朋友', null);
    ok(dk.g0 === 'election' && dk.dirty, '競選對手之間有恩怨，不老實的候選人會抹黑對手或開空頭支票', { g0: dk.g0, dirty: dk.dirty });
    ok(/記恨|grudge/.test(dk.brief), 'AI 知道自己記恨誰', dk.brief.slice(0, 200));
    ok(dk.rtSecrets > 0, '秘密存讀檔', dk.rtSecrets);
    // ---------- 同行搶生意 ----------
    const biz = await page.evaluate(() => {
      const w = window.rimtownApp.world; const ag = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const a = ag[12], b = ag[13]; a.job = { ...(b.job || {}), key: 'trader', title: '商人' }; b.job = { ...(b.job || {}), key: 'trader', title: '商人' }; a.personality.traits = ['jealous']; b.personality.traits = ['jealous'];
      const before = DARK.grudge(w, a, b).s; const R = Math.random; Math.random = () => 0.01; try { DARK.daily(w); } finally { Math.random = R; }
      const th = [...(a.thoughts || []), ...(b.thoughts || [])].map(x => x.kind);
      return { why: DARK.grudge(w, a, b).why, before, th };
    });
    ok(biz.why === 'business' || biz.why === 'quarrel', '同行會搶生意、產生恩怨', biz);
    ok(biz.th.includes('jealous') || biz.th.includes('competitive'), '搶輸生意的人會嫉妒、不服氣', biz.th);
    // ---------- 日常糾紛:買賣、借錢不還、情敵 ----------
    const dsp = await page.evaluate(() => {
      const w = window.rimtownApp.world; const D = DARK.S(w); const ag = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const R = Math.random; const seq = (arr) => { let i = 0; Math.random = () => arr[Math.min(i++, arr.length - 1)]; };
      const th = () => ag.flatMap(a => (a.thoughts || []).map(x => x.kind));
      // 買賣糾紛(roll < 0.35)
      ag[15].job = { ...(ag[15].job || {}), key: 'trader', title: '商人' };
      const shop = () => (w.messageLog || []).filter(m => String(m.k || '').startsWith('🛒')).length; const before = shop();
      seq([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]); try { DARK.daily(w); } finally { Math.random = R; }
      const cheated = shop() > before && th().includes('cheated');
      // 借錢不還:放一筆到期的債,借的人不老實
      const L = ag[16], Rr = ag[17]; Rr.personality.traits = ['lazy', 'gossip', 'jealous'];
      D.debts = [{ l: L.agentId, r: Rr.agentId, n: 20, day: 0, due: 0 }]; Math.random = () => 0.9; try { DARK.daily(w); } finally { Math.random = R; }
      const unpaid = (L.thoughts || []).some(x => x.kind === 'debt_unpaid');
      // 情敵
      const c = ag[18], a = ag[19], b = ag[20]; a.relationships.getOrCreate(c.agentId, c.name).romanticInterest = 70; b.relationships.getOrCreate(c.agentId, c.name).romanticInterest = 70;
      const before2 = a.relationships.getOrCreate(b.agentId, b.name).affinity;
      seq([0.1, 0.9]); try { DARK.daily(w); } finally { Math.random = R; }
      const rival = a.relationships.getOrCreate(b.agentId, b.name).affinity < before2 || ag.some(x => (x.thoughts || []).some(y => y.kind === 'jealous'));
      return { cheated, unpaid, rival, why: DARK.grudge(w, L, Rr).why };
    });
    ok(dsp.cheated, '買賣糾紛：覺得被坑的人會記恨賣家', dsp);
    ok(dsp.unpaid && dsp.why === 'quarrel', '借錢不還：借出錢的人心裡有疙瘩，變成恩怨', dsp);
    ok(dsp.rival, '兩個人喜歡同一個人會變成情敵', dsp);
    // ---------- 農田破壞修好 ----------
    const sab = await page.evaluate(() => {
      const w = window.rimtownApp.world; if (!w.farm?.plots?.length) return { skip: true };
      const ag = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const n = ag[14]; n.personality.traits = ['neurotic']; n.mood = 10;
      ag.filter(a => a !== n).forEach(a => { a.personality.traits = (a.personality.traits || []).filter(x => x !== 'neurotic'); });
      w.farm.plots[0].state = 'growing'; const s0 = (w.dark?.secrets || []).length;
      const R = Math.random; Math.random = () => 0.01; try { w.npcEvents._checkSabotage(w); } finally { Math.random = R; }
      return { withered: w.farm.plots.some(p => p.state === 'withered'), secret: (w.dark?.secrets || []).slice(s0).some(s => s.kind === 'sabotage' && s.culprit === n.agentId) };
    });
    ok(sab.skip || (sab.withered && sab.secret), '農田破壞會發生了（心情很差的神經質村民），而且你看得到是誰', sab);
    // ---------- 跑幾天不出錯 ----------
    const run = await page.evaluate(async () => { const w = window.rimtownApp.world; w.paused = false; for (let i = 0; i < 96 * 6; i++) w.tick(); w.paused = true; return { pets: (w.pets?.list || []).length, secrets: (w.dark?.secrets || []).length }; });
    ok(run.pets > 0, '跑 6 天不出錯', run);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
