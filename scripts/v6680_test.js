// v6.68.0 村民的內心:意見初值與漂移(朋友、報紙、經歷)、立場影響選舉與提案投票、人生野心(依個性、達成換下一個、放棄轉向)、睡前日記(規則／AI)、AI 知道立場與心願、畫面、存讀檔
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w); CLASS.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-30).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      let D = 900; const _ad = w._absDay; w._absDay = () => D; const out = {};
      const M = MIND.S(w); const all = npcs(); out.allOp = all.every(a => M.op[a.agentId] && Object.keys(MIND.ISSUES).every(k => typeof M.op[a.agentId][k] === 'number'));
      // 個性決定初值:有創意的研究員支持新科技
      const sci = all[0]; sci.personality.traits = [...sci.personality.traits.filter(x => x !== 'creative'), 'creative']; sci.job.key = 'researcher'; delete M.op[sci.agentId]; MIND.S(w); out.sciTech = M.op[sci.agentId].tech > 0.5;
      // 朋友影響
      const a = all[1], b = all[2]; M.op[a.agentId].king = -2; M.op[b.agentId].king = 2; for (const r of Object.values(a.relationships.relationships)) r.affinity = 0; a.relationships.getOrCreate(b.agentId, b.name).affinity = 80;
      const k0 = M.op[a.agentId].king; for (let i = 0; i < 10; i++) MIND.drift(w, M); out.friend = M.op[a.agentId].king > k0;
      // 經歷:加稅讓大家更討厭稅
      const t0 = M.op[a.agentId].tax; MIND.onEvent(w, 'tax_up'); out.exp = M.op[a.agentId].tax < t0;
      // 立場影響選舉
      const v = all[3], c1 = all[4], c2 = all[5]; for (const k of Object.keys(MIND.ISSUES)) { M.op[v.agentId][k] = 1.5; M.op[c1.agentId][k] = 1.5; M.op[c2.agentId][k] = -1.5; }
      out.aff = MIND.affinity(w, v, c1) > MIND.affinity(w, v, c2);
      // 立場影響提案投票(稅)
      M.op[v.agentId].tax = -1.8; const p = { kind: 'tax', dir: 'up', votes: {}, category: 'economy' }; w.proposals._ruleVote(w, p, v); out.taxVote = p.votes[v.agentId] === 'against';
      // 野心
      M.amb = {}; M.lastAmb = null; MIND.reviewAmb(w, M, D); out.allAmb = all.filter(x => (x.age || 30) >= 16).every(x => M.amb[x.agentId]);
      const rich = all[6]; M.amb[rich.agentId] = { key: 'rich', since: D - 5 }; w.wallet.bal[rich.agentId] = 500; D += 15; MIND.reviewAmb(w, M, D);
      out.achieved = (M.done?.[rich.agentId] || []).includes('rich') && M.amb[rich.agentId] && (rich.memory.entries || []).slice(-5).some(m => /做到了|finally did it/.test(m.text ? m.text() : m.content));
      const quitter = all[7]; M.amb[quitter.agentId] = { key: 'leader', since: D - 80 }; w.wallet.bal[quitter.agentId] = 0; let changed = false; for (let i = 0; i < 20 && !changed; i++) { fix(0.01, () => MIND.reviewAmb(w, M, D)); changed = M.amb[quitter.agentId].key !== 'leader' || M.amb[quitter.agentId].since === D; }
      out.giveUp = changed;
      // 日記(規則)
      M.diary = {}; await MIND.diaries(w, M, D); const anyD = Object.keys(M.diary); out.diary = anyD.length >= 1 && MIND.lastDiary(w, w.agents[anyD[0]]).length > 3;
      // 日記(AI)
      const _fa = w.fullAgentMode, _ok = CE.fullAgentOk, _aj = CE._askJson; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => ['今天好累，但值得。', '明天要更努力。', '想念家人。', '有點擔心收成。'];
      M.diary = {}; await MIND.diaries(w, M, D + 1); w.fullAgentMode = _fa; CE.fullAgentOk = _ok; CE._askJson = _aj; const ids = Object.keys(M.diary); out.aiDiary = ids.length >= 1 && M.diary[ids[0]][0].ai === true && /今天好累/.test(MIND.lastDiary(w, w.agents[ids[0]]));
      w._absDay = _ad;
      out.brief = JSON.stringify(CE._agentBrief(w, v, null));
      app.state = w.getState(); app._showNpcCard(rich.agentId); out.card = document.getElementById('npc-quick-card')?.innerText || ''; app._hideNpcCard();
      const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-mind')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = !!w2.mind?.op?.[v.agentId] && w2.mind.op[v.agentId].tax === M.op[v.agentId].tax; w2.reset(); out.reset = !w2.mind;
      return out;
    });
    ok(r.allOp, '每個村民對五個議題都有立場', r);
    ok(r.sciTech, '有創意的研究員支持新科技', r);
    ok(r.friend, '跟好朋友聊久了立場會靠近', r);
    ok(r.exp, '親身經歷（加稅）會改變立場', r);
    ok(r.aff, '選舉時立場相近的候選人加分', r);
    ok(r.taxVote, '提案投票會看自己的立場', r);
    ok(r.allAmb, '每個大人都有人生心願', r);
    ok(r.achieved, '心願達成會開心、記住，並換下一個', r);
    ok(r.giveUp, '太久沒進展可能放棄、轉向', r);
    ok(r.diary && r.aiDiary, '重要人物每晚寫日記（規則或 AI）', r);
    ok(/立場|views/.test(r.brief) && /心願|goal/.test(r.brief), 'AI 知道自己的立場與心願', r.brief.slice(-200));
    ok(/心願|Goal/.test(r.card), '角色卡顯示心願與日記', r.card.slice(0, 300));
    ok(/🗣️/.test(r.ui), '鎮況頁有民意', r.ui);
    ok(r.rt && r.reset, '內心狀態存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
