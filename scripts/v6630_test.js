// v6.63.0 報社:媒體隨城鎮等級、讀者與信任度、選舉期間表態／民調／揭弊／抹黑與更正、收買、影響投票、AI 讀到的報導、國王查禁與地下報紙、存讀檔
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine, E = w.election; app._setPaused?.(true); WALLET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      let D = 200; const _ad = w._absDay; w._absDay = () => D;
      const out = {};
      w.tierState.lv = 0; w.press = null; const R0 = PRESS.S(w); out.village = R0.papers.map(P => P.st);
      w.tierState.lv = 2; const R = PRESS.S(w); out.city = R.papers.map(P => P.st); out.allRead = npcs().every(a => R.reads[a.agentId]);
      const gossip = npcs().find(a => (a.personality.traits || []).includes('gossip')); out.gossipTrust = gossip ? PRESS.trust(w, gossip, R.papers.find(P => P.st === 'gossip')) > PRESS.trust(w, npcs().find(a => !(a.personality.traits || []).includes('gossip')), R.papers.find(P => P.st === 'gossip')) : true;
      // 選舉:兩位候選人
      const [A, B] = npcs().filter(a => a.job?.key !== 'mayor').slice(0, 2);
      E.active = true; E.phase = 'campaign'; E.candidates = [{ agentId: A.agentId, name: A.name, votes: 0, policy: 'economy' }, { agentId: B.agentId, name: B.name, votes: 0, policy: 'welfare' }]; E.lastElectionDay = 199;
      // 收買:B 有錢、不老實
      w.wallet.bal[B.agentId] = 1000; const _hon = DARK.honesty; DARK.honesty = (a) => a === B ? 1 : 4;
      for (const P of R.papers) { const j = w.agents[P.journo]; if (j) j.personality.traits = j.personality.traits.filter(x => x !== 'perfectionist'); }
      // A 有一個沒被發現的祕密
      const sec = DARK.secret(w, { kind: 'scheme', culprit: A.agentId, victim: B.agentId, k: '{a}私下塞錢給{m}拉票爭王位', p: { a: A.name, m: B.name } });
      fix(0.01, () => { R.lastDay = null; PRESS.daily(w); }); DARK.honesty = _hon;
      out.bribed = R.papers.some(P => P.bribedBy === B.agentId) && (DARK.S(w).secrets || []).some(s => /收買|paid off/.test(JSON.stringify(s)));
      out.exposed = sec.found && R.papers.some(P => P.stories.some(s => s.kind === 'expose' && s.cand === A.agentId)) && logHas(/揭弊|Exposed/);
      // 再幾天:表態、民調、抹黑、更正
      for (let i = 0; i < 4; i++) { D++; fix(i % 2 ? 0.01 : 0.2, () => { R.lastDay = null; PRESS.daily(w); }); }
      const all = R.papers.flatMap(P => P.stories); out.kinds = [...new Set(all.map(s => s.kind))];
      out.endorse = all.some(s => s.kind === 'endorse'); out.smear = all.some(s => s.kind === 'smear'); out.correct = all.some(s => s.kind === 'correct');
      out.bribedEndorse = R.papers.filter(P => P.bribedBy === B.agentId).every(P => P.stories.some(s => s.kind === 'endorse' && s.cand === B.agentId) || !P.stories.some(s => s.kind === 'endorse'));
      // 影響投票:讀到揭弊的讀者對 A 扣分
      const Pex = R.papers.find(P => P.stories.some(s => s.kind === 'expose' && s.cand === A.agentId)); const reader = npcs().find(a => a !== A && a !== B && R.reads[a.agentId] === Pex?.id) || npcs().find(a => a !== A && a !== B);
      if (Pex) R.reads[reader.agentId] = Pex.id; const ra = reader.relationships.getOrCreate(A.agentId, A.name); ra.affinity = 0;
      out.biasA = PRESS.bias(w, reader, A.agentId);
      out.brief = JSON.stringify(CE._agentBrief(w, reader, null));
      out.readerMem = (reader.memory.entries || []).slice(-12).some(m => /讀到|read in/.test(m.text ? m.text() : m.content));
      E.active = false; E.phase = 'none'; E.candidates = [];
      // 國王查禁
      w.tierState.lv = 3; PRESS.S(w); out.capital = R.papers.some(P => P.st === 'crown');
      w.crown = null; w.council._formCouncil(w); for (const id of w.council.members) { const m = w.agents[id]; for (const o of npcs()) m.relationships.getOrCreate(o.agentId, o.name).affinity = 10; }
      fix(0.5, () => CROWN.daily(w)); w.crown.legit = 30; D++;
      fix(0.01, () => { R.lastDay = null; PRESS.daily(w); }); out.banned = R.papers.some(P => P.banned) && logHas(/查禁|banned/);
      D++; fix(0.01, () => { R.lastDay = null; PRESS.daily(w); }); out.underground = R.papers.some(P => P.underground);
      w._absDay = _ad;
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-press')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.press?.papers?.length === R.papers.length; w2.reset(); out.reset = !w2.press;
      return out;
    });
    ok(JSON.stringify(r.village) === '["board"]', '村莊只有公告欄', r.village);
    ok(['town', 'cons', 'prog', 'gossip'].every(s => r.city.includes(s)) && r.allRead, '城市有鎮報與保守／革新／八卦報社，每人各讀一份', r);
    ok(r.gossipTrust, '愛八卦的人比較信八卦報', r);
    ok(r.bribed, '有錢又不老實的候選人收買報社（真相頁看得到）', r);
    ok(r.exposed, '記者揭弊，挖出候選人的祕密', r);
    ok(r.endorse && r.smear && r.correct, '報社表態、抹黑，假新聞會被更正', r.kinds);
    ok(r.biasA < 0, '讀到揭弊的讀者投票時對該候選人扣分', r.biasA);
    ok(/讀到|read in/.test(r.brief) && r.readerMem, 'AI 投票看得到最近讀到的報導', r.brief.slice(-200));
    ok(r.capital, '王都有皇家官報', r);
    ok(r.banned && r.underground, '民心低落時國王查禁批評的報社，轉成地下報紙', r);
    ok(/📰/.test(r.ui) && /可信度|credibility/.test(r.ui), '鎮況頁有報社一覽', r.ui.slice(0, 300));
    ok(r.rt && r.reset, '報社存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
