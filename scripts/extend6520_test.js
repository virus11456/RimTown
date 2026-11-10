// v6.52.0 六項延伸:道歉與原諒、報復連鎖、小團體派系、名聲、寵物延伸(生寶寶／走失／離世)、審判提案
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
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
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(3000);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, P = w.proposals; const ag = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const R = Math.random; const seq = (arr) => { let i = 0; Math.random = () => arr[Math.min(i++, arr.length - 1)]; }; const back = () => { Math.random = R; };
      const set = (x, y, v) => { x.relationships.getOrCreate(y.agentId, y.name).affinity = v; };
      const kinds = (a) => (a.thoughts || []).map(x => x.kind);
      const D = DARK.S(w); const d0 = P._abs(w); const dayAt = (n) => { P._abs = () => d0 + n; };
      const out = {};
      // 1) 道歉 → 原諒(善良的人)
      const A = ag[0], B = ag[1]; A.personality.traits = ['kind']; B.personality.traits = ['kind'];
      D.wrongs = []; DARK.wrong(w, A, B, 2, '在背後說{v}壞話', { v: B.name }); dayAt(3); seq([0.01, 0.5, 0.01]); try { DARK.apologies(w); } finally { back(); }
      out.forgive = { a: kinds(A).includes('forgiven'), b: kinds(B).includes('forgave'), done: D.wrongs[0]?.forgiven };
      // 2) 道歉被拒 → 記恨的人報復,恩怨連載
      const C = ag[2], E = ag[3]; C.personality.traits = ['abrasive']; E.personality.traits = ['jealous', 'abrasive'];
      D.wrongs = []; D.feuds = {}; DARK.wrong(w, C, E, 3, '栽贓{v}', { v: E.name }); dayAt(6); seq([0.01, 0.5, 0.99]); try { DARK.apologies(w); } finally { back(); }
      out.unforgiving = kinds(E).includes('unforgiving');
      dayAt(7); seq([0.01, 0.2, 0.2, 0.2, 0.2, 0.2]); try { DARK.revenge(w); } finally { back(); }
      out.revenge = { avenged: kinds(E).includes('avenged'), counter: D.wrongs.some(x => x.by === E.agentId && x.to === C.agentId) };
      // 對方再報復回來 → 連載第 2 回
      C.personality.traits = ['abrasive', 'jealous']; const cw = D.wrongs.find(x => x.by === E.agentId && x.to === C.agentId); if (cw) { cw.day = d0; }
      dayAt(10); seq([0.01, 0.2, 0.2, 0.2, 0.2]); try { DARK.revenge(w); } finally { back(); }
      out.feud = Math.max(0, ...Object.values(D.feuds).map(f => f.n));
      // 3) 小團體:常一起講同一個人壞話
      const F = ag[4], G = ag[5], H = ag[6]; F.personality.traits = ['jealous', 'gossip']; G.personality.traits = ['optimist']; H.personality.traits = [];
      set(F, G, 40); set(F, H, -80); set(G, H, 0); D.cliques = []; D.allies = {}; D.rep[F.agentId] = {};
      for (let i = 0; i < 2; i++) { D.spoke = {}; seq([0.01, 0.9, 0.5, 0.5, 0.5]); try { DARK.badmouth(w, F, G); } finally { back(); } }
      const cq = DARK.cliqueOf(w, G.agentId); out.clique = !!cq && cq.members.includes(F.agentId) && cq.against.includes(H.agentId);
      const pH = { proposerId: H.agentId, kind: 'free', votes: {}, why: {} }, pF = { proposerId: F.agentId, kind: 'free', votes: {}, why: {} };
      out.cliqueVote = { againstH: DARK.cliqueVote(w, pH, G), forF: DARK.cliqueVote(w, pF, G) };
      // 4) 名聲:講很多次壞話 → 愛八卦,說的話大家打折聽
      D.rep[F.agentId] = { badmouth: 3 }; out.rep = DARK.reputation(w, F); out.cred = DARK.credibility(w, F);
      // 5) 審判:陰謀被拆穿 → 提案處置 → 通過後執行
      const X = ag[7], Y = ag[8]; D.exposedCount = {};
      const s = DARK.secret(w, { kind: 'frame', culprit: X.agentId, victim: Y.agentId, k: '公庫少的 {n} 銀幣是{a}拿的，還栽贓給{v}', p: { n: 20, a: X.name, v: Y.name } });
      P.items = P.items.filter(p => p.status !== 'open'); DARK.reveal(w, s, ag[9]);
      const vp = P.items.find(p => p.kind === 'verdict' && p.culprit === X.agentId);
      out.verdict = { made: !!vp, pen: vp?.pen, title: vp ? P.title(vp) : '' };
      if (vp) { ag.forEach(a => P._ruleVote(w, vp, a)); out.verdict.votes = Object.values(vp.votes).length; out.verdict.victimFor = vp.votes[Y.agentId] === 'for'; if (typeof WALLET !== 'undefined') { WALLET.S(w); w.wallet.bal[X.agentId] = Math.max(100, WALLET.get(w, X)); } /* v7.6.0 起罰款從被告錢包扣,先讓被告付得起 */ const s0 = w.stockpile.get('silver'); vp.status = 'approved'; P._execute(w, vp, d0 + 12); out.verdict.status = vp.status; out.verdict.silver = w.stockpile.get('silver') - s0; out.verdict.punished = kinds(X).includes('punished'); out.verdict.justice = kinds(Y).includes('justice'); }
      // 第三次被拆穿 → 逐出小鎮
      D.exposedCount[X.agentId] = 2; const s2 = DARK.secret(w, { kind: 'sabotage', culprit: X.agentId, victim: Y.agentId, k: '{a}偷偷破壞了{v}的工作', p: { a: X.name, v: Y.name } }); P.items = P.items.filter(p => !(p.kind === 'verdict' && p.status === 'open'));
      const R2 = Math.random; Math.random = () => 0.99; try { DARK.reveal(w, s2, ag[9]); } finally { Math.random = R2; }
      const vp2 = P.items.find(p => p.kind === 'verdict' && p.status === 'open' && p.culprit === X.agentId); out.exile = vp2?.pen;
      if (vp2) { vp2.status = 'approved'; P._execute(w, vp2, d0 + 13); const _ff = (id) => { if (typeof EXILE === 'undefined' || !EXILE.pendingOf(w, id)) return false; EXILE.S(w).pending[id].until = w._absDay(); EXILE.S(w).lastDay = null; EXILE.daily(w); return true; }; out.grace = !!w.agents[X.agentId] && _ff(X.agentId); /* v9.9.4 限期 7 天才離開 */ out.exiled = !w.agents[X.agentId]; }
      // 6) 寵物:生寶寶分送鄰居、走失被找回、老了離開
      const S = PETS.ensure(w); const pet = S.list.find(p => p.owner && p.sp !== 'chicken' && w.agents[p.owner]);
      const owner = w.agents[pet.owner]; const others = S.list.filter(p => p !== pet); const live = () => ag.filter(a => w.agents[a.agentId]);
      S.list = [pet]; pet.born = P._abs(w); pet.lost = null; w.clock.season = '春季';
      seq([0.5, 0.5, 0.001, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]); try { PETS.lifeEvents(w, S, live()); } finally { back(); }
      const kids = S.list.filter(p => p.parent === pet.id); out.litter = { kids: kids.length, adopters: kids.map(k => w.agents[k.owner]?.name), gift: kids.length ? kinds(w.agents[kids[0].owner]).includes('pet_gift') : false };
      S.list = [pet]; seq([0.001]); try { PETS.lifeEvents(w, S, live()); } finally { back(); }
      out.lost = { lost: pet.lost !== null && pet.lost !== undefined, hidden: !PETS.view(w).some(v => v.id === pet.id), thought: kinds(owner).includes('pet_lost') };
      seq([0.1, 0.1, 0.5, 0.5]); try { PETS.lifeEvents(w, S, live()); } finally { back(); }
      out.found = { back: pet.lost === null, thought: kinds(owner).includes('pet_found') };
      S.list = [pet, ...others, ...kids];
      pet.born = (P._abs(w) || 0) - 999; PETS.lifeEvents(w, S, ag.filter(a => w.agents[a.agentId]));
      out.died = { gone: !S.list.includes(pet), grief: kinds(owner).includes('pet_died') };
      delete P._abs;
      // AI 與村民卡
      D.wrongs.push({ by: C.agentId, to: ag[10].agentId, w: 1, day: d0, tries: 0 });
      out.brief = w.conversationEngine._agentBrief(w, F).mem.join(' | ');
      app.state = w.getState(); app._showNpcCard(F.agentId); out.card = document.getElementById('npc-quick-card').innerText; app._hideNpcCard();
      app._ppTab = 'town'; const box = document.createElement('div'); app.renderProposals(box); out.panel = box.innerHTML.includes('🫂');
      // 存讀檔
      const blob = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(blob);
      out.rt = { cliques: (w2.dark?.cliques || []).length, rep: Object.keys(w2.dark?.rep || {}).length, feuds: Object.keys(w2.dark?.feuds || {}).length };
      // 跑 8 天
      w.paused = false; for (let i = 0; i < 96 * 8; i++) w.tick(); w.paused = true;
      return out;
    });
    ok(r.forgive.a && r.forgive.b && r.forgive.done, '做錯事的人會道歉，善良的人會原諒', r.forgive);
    ok(r.unforgiving, '記恨的人不肯原諒', null);
    ok(r.revenge.avenged && r.revenge.counter, '不肯原諒、又心眼小的人會報復，報復又變成新的虧欠', r.revenge);
    ok(r.feud >= 2, '你來我往的報復變成恩怨連載', r.feud);
    ok(r.clique && r.cliqueVote.againstH === -1 && r.cliqueVote.forF === 1, '常一起講同一個人壞話會變成小圈圈，投票一起行動', { c: r.clique, v: r.cliqueVote });
    ok(r.rep.includes('gossip') && r.cred < 1, '名聲：愛八卦的人講的話大家打折聽', { rep: r.rep, cred: r.cred });
    ok(r.verdict.made && r.verdict.pen === 'fine' && r.verdict.votes > 5 && r.verdict.victimFor, '陰謀被拆穿後，全鎮提案審判（第一次是罰款道歉）並投票', r.verdict);
    ok(r.verdict.status === 'done' && r.verdict.silver >= 30 && r.verdict.punished && r.verdict.justice, '判決執行：被處罰的人心情大跌，受害者討回公道', r.verdict);
    ok(r.exile === 'exile' && r.grace && r.exiled, '一再被拆穿 → 投票逐出小鎮（限期 7 天收拾後離開）', { pen: r.exile, grace: r.grace, gone: r.exiled });
    ok(r.litter.kids >= 1 && r.litter.adopters.every(Boolean) && r.litter.gift, '寵物生了小寶寶，分送給鄰居', r.litter);
    ok(r.lost.lost && r.lost.hidden && r.lost.thought, '寵物會走失（主人擔心、畫面上看不到）', r.lost);
    ok(r.found.back && r.found.thought, '大家幫忙找，找回來了', r.found);
    ok(r.died.gone && r.died.grief, '寵物老了會離開，主人很難過', r.died);
    ok(/大家眼中|How people see|那一派|clique/.test(r.brief), 'AI 知道自己的名聲與派系', r.brief.slice(0, 220));
    ok(/名聲|Reputation/.test(r.card), '村民卡顯示名聲與派系', r.card.slice(0, 260));
    ok(r.panel, '提案頁顯示小團體與恩怨', null);
    ok(r.rt.cliques > 0 && r.rt.rep > 0 && r.rt.feuds > 0, '派系、名聲、恩怨存讀檔', r.rt);
    ok(errs.length === 0, '沒有頁面錯誤（含跑 8 天）', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
