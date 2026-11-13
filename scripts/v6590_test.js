// v6.59.0 國王:只有王都有、第一位國王議會確認加冕、官職標籤與王族、王令(規則與 AI)、政變(被識破走審判／成功改朝換代)、世襲與繼承危機、起義推翻王室、降級失去王位、存讀檔
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w); CLASS.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-25).some(m => re.test(m.content || ''));
      const out = {}; const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      CROWN.daily(w); out.villageKing = !!CROWN.king(w);
      // 升格王都:議會大致不反對 → 第一位國王
      w.tierState.lv = 3; w.council._formCouncil(w); for (const id of w.council.members) { const m = w.agents[id]; for (const o of npcs()) m.relationships.getOrCreate(o.agentId, o.name).affinity = 10; }
      fix(0.5, () => CROWN.daily(w)); const k1 = CROWN.king(w); out.k1 = k1?.name; out.first = logHas(/加冕為王|crowned king/);
      out.badge = k1 && TIERS.badge(w, k1)?.cls; out.royal = k1 && CLASS.level(w, k1) === 5; out.notMayor = k1 && !TIERS.qualified(w, k1);
      out.brief = CE._townBrief(w); out.dyn = !!w.crown.dynasty;
      // 王令(規則)
      w.crown.lastDecree = -99; const nd0 = w.crown.decrees.length; const fa0 = w.fullAgentMode; w.fullAgentMode = false; fix(0.5, () => CROWN.daily(w)); w.fullAgentMode = fa0; /* 規則版王令:先關掉完整智能體模式(預設開著,AI 冷卻狀態會讓它時走 AI、時走規則) */ await new Promise(r => setTimeout(r, 300)); out.ruleDecree = w.crown.decrees.length === nd0 + 1;
      // 王令(AI)
      const _fa = w.fullAgentMode, _ok = CE.fullAgentOk, _aj = CE._askJson; w.fullAgentMode = true; CE.fullAgentOk = () => true; let asked = '';
      CE._askJson = async (p) => { asked = p; return { key: 'tax_down', text: '減輕百姓負擔' }; }; const tax0 = w.wallet.tax;
      w.crown.lastDecree = -99; fix(0.5, () => CROWN.daily(w)); await new Promise(r => setTimeout(r, 50));
      w.fullAgentMode = _fa; CE.fullAgentOk = _ok; CE._askJson = _aj;
      const last = w.crown.decrees[w.crown.decrees.length - 1]; out.aiDecree = last?.key === 'tax_down' && last.text === '減輕百姓負擔' && w.wallet.tax < tax0 && /王令|decree/i.test(asked);
      // UI
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-crown')?.innerText || ''; box.remove();
      app._showNpcCard(k1.agentId); out.card = document.getElementById('npc-quick-card')?.innerHTML || ''; app._hideNpcCard();
      // 政變被識破 → 審判提案
      const others = npcs().filter(a => a !== k1); const plotter = others[0], loyal = others[1];
      for (const o of npcs()) { o.relationships.getOrCreate(k1.agentId, k1.name).affinity = 0; }
      plotter.relationships.getOrCreate(k1.agentId, k1.name).affinity = -40; WALLET.add(w, plotter, 1000);
      loyal.relationships.getOrCreate(k1.agentId, k1.name).affinity = 60; loyal.job.key = 'guard';
      w.crown.legit = 10; w.crown.lastDecree = w._absDay(); w.crown.plot = null; w.crown.poverty = 0;
      { const cand = npcs().find(a => CROWN.plotInfo?.(w, a)); if (cand) CROWN.plotBy(w, cand); } // v9.27.0 動不動手由最有可能的那個人自己決定(不再擲骰)：這裡讓他決定動手
      fix(0.01, () => CROWN.daily(w)); out.plotStarted = !!w.crown.plot || logHas(/政變|coup/i);
      const sec = (w.dark?.secrets || []).some(s => /密謀推翻|plotting/.test(JSON.stringify(s)) || s.victim === k1.agentId);
      if (w.crown.plot) fix(0.01, () => CROWN.daily(w));
      out.secret = sec; out.foiled = !w.crown.plot && CROWN.king(w) === k1 && logHas(/識破|政變失敗|uncovered|coup failed/i);
      out.verdict = (w.proposals.items || []).some(p => p.kind === 'verdict' && p.culprit && w.agents[p.culprit] && p.status === 'open');
      // 政變成功(沒有忠臣)
      loyal.relationships.getOrCreate(k1.agentId, k1.name).affinity = 0; const L2 = others[2]; L2.relationships.getOrCreate(k1.agentId, k1.name).affinity = -40; WALLET.add(w, L2, 1000);
      w.crown.legit = 10; w.crown.plot = { leader: L2.agentId, members: [L2.agentId, others[3].agentId, others[4].agentId], start: w._absDay(), ready: w._absDay() };
      fix(0.01, () => CROWN.daily(w)); const k2 = CROWN.king(w); out.coup = k2 === L2 && w.crown.history.slice(-1)[0].how === 'coup' && CLASS.level(w, k1) !== 5;
      // 世襲
      const kid = others[5]; kid._parentNames = [k2.name, 'x']; kid.age = 20; k2.isDead = true;
      fix(0.5, () => CROWN.daily(w)); out.heir = CROWN.king(w) === kid && w.crown.history.slice(-1)[0].how === 'heir';
      // 無子嗣 → 繼承危機 → 議會推舉
      /* v6.90 開局有家族:先讓這位國王沒有其他子嗣、配偶,才會出現繼承危機 */ for (const o of Object.values(w.agents)) { if (o === kid) continue; if ((o._parentNames || []).includes(kid.name)) o._parentNames = o._parentNames.filter(n => n !== kid.name); const rr = o.relationships?.relationships?.[kid.agentId]; if (rr && ['married', 'dating'].includes(rr.status)) rr.status = 'ex'; }
      kid.isDead = true; fix(0.5, () => CROWN.daily(w)); out.crisis = !!w.crown.crisis && !CROWN.king(w) && w.crown.crisis.claimants.length >= 1;
      w.crown.crisis.until = w._absDay(); fix(0.5, () => CROWN.daily(w)); out.elected = !!CROWN.king(w) && w.crown.history.slice(-1)[0].how === 'elected';
      // 起義
      const k3 = CROWN.king(w); w.crown.legit = 5; w.crown.poverty = 6; w.crown.lastDecree = w._absDay(); w.crown.plot = null;
      for (const a of npcs()) { if (a !== k3) { a.mood = 20; if (a.job?.key === 'guard') a.relationships.getOrCreate(k3.agentId, k3.name).affinity = -10; } }
      const _leg = w.crown; fix(0.01, () => { const P = w.proposals; P.issues = P.issues || {}; P.issues.poverty = P.issues.poverty || { key: 'poverty', sev: 3 }; CROWN.daily(w); });
      out.republic = !!w.crown.republic && !CROWN.king(w) && logHas(/起義|uprising/i);
      // 存讀檔與新城鎮
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = !!w2.crown?.republic && w2.crown.history.length >= 4; w2.reset(); out.reset = !w2.crown;
      // 降級:王位消失
      w.crown = null; w.tierState.lv = 3; fix(0.5, () => CROWN.daily(w)); const k4 = CROWN.king(w); w.tierState.lv = 2; CROWN.daily(w); out.demote = !!k4 && !CROWN.king(w) && CLASS.level(w, k4) !== 5;
      return out;
    });
    ok(r.villageKing === false, '村莊沒有國王', r);
    ok(r.k1 && r.first && r.dyn, '升格王都：聲望最高的人經議會確認加冕，開創王朝', r);
    ok(r.badge === 'king' && r.royal && r.notMayor, '國王有專屬標籤、屬於王族、不再參選市長', r);
    ok(/國王|King/.test(r.brief), 'AI 的鎮況裡有國王與民心', r.brief.slice(-120));
    ok(r.ruleDecree, '國王每十天左右頒布王令', r);
    ok(r.aiDecree, '完整智能體模式由 AI 依國況選王令、寫詔書', r);
    ok(/👑/.test(r.ui) && /民心|Popular support/.test(r.ui), '鎮況頁顯示國王、王朝與民心', r.ui);
    ok(/nqc-office-king/.test(r.card), '國王的角色卡有金色皇冠標籤', r.card.slice(0, 100));
    ok(r.plotStarted && r.secret, '民心低落時野心家密謀政變（真相頁看得到）', r);
    ok(r.foiled && r.verdict, '忠臣識破政變，主謀被提交審判', r);
    ok(r.coup, '沒人察覺時政變成功、改朝換代，舊王失去王族身分', r);
    ok(r.heir, '國王死後由成年子女繼位', r);
    ok(r.crisis && r.elected, '沒有子嗣 → 繼承危機 → 議會推舉新王', r);
    ok(r.republic, '民不聊生時起義，可能推翻王室改為共和', r);
    ok(r.rt && r.reset, '王室存讀檔保留、新城鎮重來', r);
    ok(r.demote, '王都降級時王室失去王位', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
