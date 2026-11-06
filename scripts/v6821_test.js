// v6.82.1 議會提早成立＋舊議會提案併入提案頁:觀察者模式鎮上有 6 人就成立議會(村莊叫長老會)、不再跑舊的議會自訂提案、
// 不會跳視窗要觀察者投票、政令改由議員在提案頁提出;中英
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch();
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
      w.reset(); w.observerMode = true; w.fullAgentMode = false;
      const out = { pros: Math.round(w.prosperity?.prosperity || 0) };
      const d0 = w._absDay(); for (let i = 0; i < 96 * 12 && w._absDay() - d0 < 10; i++) { w.paused = false; w.tick(); }
      const logs = () => (w.messageLog || []).map(m => w.logText ? w.logText(m) : (m.content || '')).join('\n');
      out.formed = w.council._formed; out.n = (w.council.members || []).length; out.lv = TIERS.level(w); out.formLog = /長老會成立|Council of Elders is formed/.test(logs());
      // 舊存檔帶進來的議會自訂提案會被清掉,也不會再產生
      w.council.pendingProposal = { id: 'tax_trade', title: 'x', desc: 'y', votes: {}, daysLeft: 3, proposerName: 'z', effects: {} };
      w.council.dailyUpdate(w); out.pendCleared = !w.council.pendingProposal;
      w.council._generateProposal(w); out.noGen = !w.council.pendingProposal;
      // 不會跳視窗要觀察者投票
      let shown = 0; const orig = app._showCouncilCard; app._showCouncilCard = () => { shown++; };
      w.council.pendingProposal = { id: 'tax_trade', title: 'x', desc: 'y', votes: {}, daysLeft: 3, proposerName: 'z', effects: {} }; app._shownCouncilId = null;
      app._checkV4Notifications(); out.popup = shown; app._showCouncilCard = orig; w.council.pendingProposal = null;
      // 政令由議員提出
      const ps = w.proposals; const day = ps._abs(w); const ms = new Set(ASSEMBLY.seated(w).map(a => a.agentId));
      for (const id of ms) ps.proposerCooldown[id] = day; ps.cooldown = {};
      out.allBusy = (ps._candidates(w, day) || []).filter(c => c.kind === 'policy' && String(c.key).startsWith('policy:')).length;
      for (const id of ms) delete ps.proposerCooldown[id];
      const pol = (ps._candidates(w, day) || []).filter(c => c.kind === 'policy' && String(c.key).startsWith('policy:'));
      out.pol = pol.length; out.predOk = pol.every(c => typeof c.pred === 'function');
      const any = Object.values(w.agents).filter(a => !a.isPlayer);
      out.predMembers = pol.length ? any.filter(a => pol[0].pred(a)).every(a => ms.has(a.agentId)) && any.some(a => pol[0].pred(a)) : null;
      if (pol.length) { const p = ps._create(w, day, pol[0]); out.created = p ? ms.has(p.proposerId) : 'none'; }
      return out;
    });
    ok(r.formed && r.n >= 3 && r.lv === 0, '觀察者模式：開局十天內就成立議會（村莊 3 席），不必等繁榮 70', r);
    ok(r.formLog, '成立公告用目前等級的名稱（村莊是長老會）', r.formLog);
    ok(r.pendCleared && r.noGen, '舊的議會自訂提案會被清掉、也不再產生', { c: r.pendCleared, g: r.noGen });
    ok(r.popup === 0, '不會跳視窗要觀察者投票', r.popup);
    ok(r.pol > 0 && r.predOk && r.predMembers, '政令提案限定由議員提出', { pol: r.pol, pred: r.predOk, m: r.predMembers });
    ok(r.created === true, '建立出來的政令提案者是議員', r.created);
    ok(r.allBusy === 0, '議員這幾天都提過案時，政令改天再提（不會由一般村民代提）', r.allBusy);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
