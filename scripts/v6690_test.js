// v6.69.0 政治深化:選舉辯論(規則／AI、在場者加分、報紙)、議會人情交換與倒戈、外交談判(AI)、法庭(冤案起訴、陳詞、陪審受辯護影響、翻案與真兇起訴)、畫面、存讀檔
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
      const stubAI = (resp) => { const s = { fa: w.fullAgentMode, ok: CE.fullAgentOk, aj: CE._askJson }; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => resp; return () => { w.fullAgentMode = s.fa; CE.fullAgentOk = s.ok; CE._askJson = s.aj; }; };
      let D = 1100; const _ad = w._absDay; w._absDay = () => D; const out = {}; const P = POLITICS.S(w); const all = npcs().filter(a => a.job?.key !== 'mayor');
      // 辯論
      const [A, B] = all; A.personality.traits = [...A.personality.traits.filter(x => x !== 'shy'), 'charismatic']; B.personality.traits = B.personality.traits.filter(x => x !== 'charismatic');
      E.active = true; E.phase = 'campaign'; E.candidates = [{ agentId: A.agentId, name: A.name, votes: 0 }, { agentId: B.agentId, name: B.name, votes: 0 }];
      const rec = await POLITICS.debate(w, P, E, D); out.debate = !!rec && logHas(/辯論|debate/i) && rec.lines.length === 2;
      out.watched = all.slice(2).some(v => (v.memory.entries || []).slice(-4).some(m => /辯論|debate/i.test(m.text ? m.text() : m.content)));
      let restore = stubAI({ lines: ['我會讓大家都吃飽！', '別信他的空話。'], best: 1 }); const rec2 = await POLITICS.debate(w, P, E, D + 1); restore();
      out.aiDebate = rec2 && /吃飽/.test(Memory.render(rec2.lines[0].k, rec2.lines[0].p)) && rec2.winner === B.name;
      E.active = false; E.phase = 'none'; E.candidates = [];
      // 議會人情
      const [C1, C2] = all.slice(2, 4); w.council.members = [C1.agentId, C2.agentId, all[4].agentId]; C2.relationships.getOrCreate(C1.agentId, C1.name).affinity = 40; P.pacts = [];
      const mk = (key) => ({ kind: 'feast', key, jobs: [], make: () => ({ kind: 'feast', key, tk: '測試提案', tp: {}, dk: '測試', dp: {}, cost: {}, category: 'culture' }) });
      const p1 = w.proposals._createWith(w, D, mk('feast:t1'), C1); out.pact = P.pacts.some(x => x.from === C1.agentId && x.to === C2.agentId) && logHas(/談好|struck a deal/);
      w.proposals._ruleVote(w, p1, C2); out.pactVote = p1.votes[C2.agentId] === 'for';
      // C2 提案:C1 欠人情 → 不老實又不熟 → 倒戈
      C1.relationships.getOrCreate(C2.agentId, C2.name).affinity = 0; const _h = DARK.honesty; DARK.honesty = (a) => a === C1 ? 1 : 4;
      w.proposals.proposerCooldown = {}; const p2 = w.proposals._createWith(w, D, mk('feast:t2'), C2); fix(0.01, () => w.proposals._ruleVote(w, p2, C1)); DARK.honesty = _h;
      out.betray = p2.votes[C1.agentId] === 'against' && logHas(/倒戈|switched sides/);
      // 外交談判
      TIDINGS.S(w); DIPLO.S(w); const pid = 'capital'; const r0 = w.diplo.rel[pid]; restore = stubAI({ result: 'treaty', text: '雙方同意互通有無' }); const ng = await POLITICS.negotiate(w, pid, A.name); restore();
      out.nego = ng?.result === 'treaty' && w.diplo.rel[pid] > r0 && logHas(/談判|Negotiations/);
      // 法庭:冤案起訴
      const framer = all[5], victim = all[6]; for (const o of all) o.relationships.getOrCreate(victim.agentId, victim.name).affinity = 0; all[7].relationships.getOrCreate(victim.agentId, victim.name).affinity = -30;
      const sec = DARK.secret(w, { kind: 'frame', culprit: framer.agentId, victim: victim.agentId, k: '公庫少的 {n} 銀幣是{a}拿的，還栽贓給{v}', p: { n: 20, a: framer.name, v: victim.name } }); sec.day = D;
      fix(0.01, () => POLITICS.accuseFramed(w, P, D)); const vp = (w.proposals.items || []).find(p => p.kind === 'verdict' && p.culprit === victim.agentId && p.status === 'open');
      out.accused = !!vp && vp.wrongful === sec.id;
      // 審判:陳詞、陪審受辯護影響
      const fr = all[8]; fr.personality.traits = [...fr.personality.traits.filter(x => x !== 'shy'), 'charismatic']; victim.relationships.getOrCreate(fr.agentId, fr.name).affinity = 60;
      const T = vp ? await POLITICS.trial(w, P, vp) : null; out.trial = !!T && logHas(/審判|trial of/i) && T.lines.length === 3;
      if (T) { T.defS = 10; T.proS = 0; } out.jury = vp ? fix(0.01, () => POLITICS.juryShift(w, vp, 'for')) === 'against' : false;
      // 判決執行 → 日後翻案、真兇被起訴
      if (vp) { vp.pen = 'fine'; DARK.punish(w, w.proposals, vp); }
      D += 3; fix(0.01, () => POLITICS.appeals(w, P, D)); out.appeal = sec.found && logHas(/翻案|Overturned/) && (w.proposals.items || []).some(p => p.kind === 'verdict' && p.culprit === framer.agentId);
      w._absDay = _ad;
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-politics')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.politics?.pacts?.length === P.pacts.length; w2.reset(); out.reset = !w2.politics;
      return out;
    });
    ok(r.debate && r.watched, '選舉辯論：候選人互相攻擊對手弱點，在場的人記得誰講得好', r);
    ok(r.aiDebate, '完整智能體模式由 AI 寫辯詞、判斷誰贏', r);
    ok(r.pact && r.pactVote, '議員私下交換條件，答應的人會投支持', r);
    ok(r.betray, '欠人情又不老實的議員可能倒戈', r);
    ok(r.nego, '外交談判由 AI 扮演雙方，談出條約', r);
    ok(r.accused, '被栽贓的人可能被告上法庭（冤案）', r);
    ok(r.trial, '審判有控方、辯方、法官陳詞', r);
    ok(r.jury, '辯護講得好會讓陪審改變心意', r);
    ok(r.appeal, '冤案日後翻案，真兇被起訴', r);
    ok(/🏛️/.test(r.ui), '鎮況頁有政壇', r.ui.slice(0, 200));
    ok(r.rt && r.reset, '政治狀態存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
