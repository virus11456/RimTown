// v6.71.0 文化、宗教、媒體深化:記者頭條(規則／AI)、讀者投書與筆戰、藝術作品與傳世傑作、吟遊詩人歌謠、講道、神諭、新教派教義、謠言變形、AI 知道鎮上的歌、畫面、存讀檔
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
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const seq = async (vals, f) => { let i = 0; Math.random = () => (i < vals.length ? vals[i++] : vals[vals.length - 1]); try { return await f(); } finally { Math.random = _r; } };
      const stubAI = (resp) => { const s = { fa: w.fullAgentMode, ok: CE.fullAgentOk, aj: CE._askJson }; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => resp; return () => { w.fullAgentMode = s.fa; CE.fullAgentOk = s.ok; CE._askJson = s.aj; }; };
      let D = 1500; const _ad = w._absDay; w._absDay = () => D; const out = {}; const C = CULTURE.S(w); const all = npcs().filter(a => a.job?.key !== 'mayor');
      w.tierState.lv = 2; const R = PRESS.S(w); MIND.S(w);
      // 記者頭條
      w.dailyNews.todayEvents.push({ category: 'event', content: '倉庫半夜起火', importance: 9, agents: [] });
      await CULTURE.headline(w, C, D); out.head = R.papers.some(P => P.stories.some(s => s.kind === 'headline'));
      let restore = stubAI({ headline: '大火燒掉半個倉庫，誰該負責？' }); await CULTURE.headline(w, C, D + 1); restore(); out.aiHead = R.papers.some(P => P.stories.some(s => s.kind === 'headline' && /誰該負責/.test(JSON.stringify(s.p))));
      // 投書與筆戰
      const [a, b] = all; const P0 = R.papers.find(x => x.st === 'town'); R.reads[a.agentId] = P0.id; R.reads[b.agentId] = P0.id;
      for (const x of npcs()) { const o = w.mind.op[x.agentId]; for (const k of Object.keys(o)) o[k] = 0; } w.mind.op[a.agentId].king = 2; w.mind.op[b.agentId].king = -2;
      const ab0 = a.relationships.getOrCreate(b.agentId, b.name).affinity; fix(0.01, () => CULTURE.letters(w, C, D));
      out.letter = P0.stories.some(s => s.kind === 'letter') && logHas(/筆戰|trading barbs/) && a.relationships.relationships[b.agentId].affinity < ab0;
      // 藝術作品(傳世傑作)
      const artist = all[2]; artist.personality.traits = [...artist.personality.traits.filter(x => !['creative', 'perfectionist'].includes(x)), 'creative', 'perfectionist']; for (const x of npcs()) if (x !== artist) x.personality.traits = x.personality.traits.filter(y => y !== 'creative');
      w.biz = null; const n0 = C.works.length; await seq([0.01, 0.2, 0.3, 0.4, 0.99], () => CULTURE.art(w, C, D)); const wk = C.works[C.works.length - 1];
      out.art = C.works.length === n0 + 1 && wk.by === artist.agentId && logHas(/完成了|finished a/); out.legend = wk?.legend === true && logHas(/傳世傑作|masterpiece/);
      restore = stubAI({ title: '霧中的母親' }); await seq([0.01, 0.2, 0.3, 0.4, 0.5], () => CULTURE.art(w, C, D + 1)); restore(); out.aiArt = C.works[C.works.length - 1].title[0] === '霧中的母親';
      // 吟遊詩人
      w.logMessageT('event', '⚔️ 政變成功！{a}推翻舊王，自立為王，建立{d}。', { a: a.name, d: '金冠王朝' }); C.lastSong = -99; await CULTURE.bard(w, C, D); out.song = C.songs.length >= 1 && logHas(/歌謠|ballad/);
      out.townBrief = CE._townBrief(w);
      // 講道
      const F = FAITH.S(w); const Rl = F.rels[0]; for (const x of all.slice(0, 6)) F.of[x.agentId] = { rel: Rl.id, piety: 60 }; all[3].job.key = 'priest'; F.of[all[3].agentId].piety = 100; F.heads = {}; FAITH2.pickHeads(w);
      D = 1503 + ((3 - (1503 % 7)) + 7) % 7; const p0 = FAITH.pietyOf(w, all[4]); CULTURE.sermon(w, C, D); out.sermon = logHas(/講道|preached/) && FAITH.pietyOf(w, all[4]) > p0;
      // 神諭
      Rl.sk = 'ling'; F.of[all[5].agentId] = { rel: Rl.id, piety: 90 }; fix(0.01, () => CULTURE.oracle(w, C, D)); out.oracle = C.oracles.length >= 1 && logHas(/神諭|oracle/);
      // 新教派教義
      const R2 = FAITH.makeReligion(FAITH.rng(3), 'sheng', 9); restore = stubAI({ claim: '人人都是自己的祭司' }); await CULTURE.doctrine(w, R2, all[1]); restore(); out.doctrine = R2.doctrine?.[0] === '人人都是自己的祭司' && logHas(/教義|teaching/);
      // 謠言變形
      const T = TIDINGS.S(w); T.items.push({ id: 'N999', pid: 'realm', pn: '赤陽王國', k: '{p}跟鄰國開戰了', ch: 'traveler', dist: true, made: D, day: D, by: null, m: {} }); T.known = { a: ['N999'], b: ['N999'], c: ['N999'] };
      C.lastMut = null; restore = stubAI({ rumor: '聽說敵軍已經打到山腳下了！' }); await CULTURE.mutate(w, C, D); restore(); out.mutate = TIDINGS.render(T.items[T.items.length - 1]) === '聽說敵軍已經打到山腳下了！';
      w._absDay = _ad;
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-culture')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.culture?.works?.length === C.works.length; w2.reset(); out.reset = !w2.culture;
      return out;
    });
    ok(r.head && r.aiHead, '記者挑當天最重要的事寫頭條（規則或 AI）', r);
    ok(r.letter, '立場強的人投書，立場相反的人回嗆，掀起筆戰', r);
    ok(r.art && r.legend, '有創意的人完成作品，傑作被譽為傳世之作', r);
    ok(r.aiArt, '完整智能體模式由 AI 為作品取名', r);
    ok(r.song && /歌|Songs/.test(r.townBrief), '吟遊詩人把大事編成歌謠，AI 知道鎮上傳唱的歌', r.townBrief.slice(-120));
    ok(r.sermon, '宗教領袖每週依時事講道，信徒更虔誠', r);
    ok(r.oracle, '虔誠的巫者給出模稜兩可的神諭', r);
    ok(r.doctrine, '新教派立下自己的教義', r);
    ok(r.mutate, '重要謠言被 AI 改寫得更離譜', r);
    ok(/🎭/.test(r.ui), '鎮況頁有文化', r.ui.slice(0, 200));
    ok(r.rt && r.reset, '文化存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
