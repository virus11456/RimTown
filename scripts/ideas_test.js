// v6.46.0 科技樹玩法:研究完成→新觀念靠聊天傳開(有人接受有人反對)、革新派／保守派、匠人抗議提案、發明家靈光、科技面板、存讀檔、中英
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true);
      const step = () => { w.paused = false; w.tick(); w.paused = true; };
      const IS = w.ideaSystem;
      const complete = (k) => { const R = w.research; const p = R.projects[k]; p.status = 'researching'; R.current = k; p.progress = p.cost; R.dailyUpdate(w); };
      // 讓一位裁縫很保守,紡織坊上線時一定有人抗議
      const tailor = Object.values(w.agents).find(a => a.job?.key === 'tailor');
      if (tailor) { tailor.personality.traits = ['pessimist', 'ascetic', 'stoic']; tailor.age = 62; }
      const props0 = w.proposals.items.length;
      complete('agriculture'); complete('medicine_research'); complete('textiles');
      const seededBy = IS.ideas.agriculture?.a.length || 0;
      for (let d = 0; d < 30; d++) for (let i = 0; i < 96; i++) step();
      const sAg = IS.summary(w, 'agriculture'), sMed = IS.summary(w, 'medicine_research');
      const fx = IS.factions(w);
      const protest = w.proposals.items.find(p => p.key === 'protest:textiles');
      // 發明:重試直到有人靈光一閃(機率很低,測試時把冷卻歸零重抽)
      const before = IS.inventions.length; let tries = 0;
      const R = w.research; const cur = Object.values(R.projects).find(p => p.status === 'available'); if (cur) { cur.status = 'researching'; R.current = cur.key; cur.progress = 0; }
      while (IS.inventions.length === before && tries++ < 3000) { IS.lastInventDay = -99; IS._invent(w, IS._npcs(w)); }
      const inv = IS.inventions[IS.inventions.length - 1];
      const invMem = inv ? (w.agents[inv.id]?.memory?.entries || []).slice(-3).map(e => e.content) : [];
      const ideaMem = []; for (const a of Object.values(w.agents)) for (const e of (a.memory?.entries || [])) if (e.category === 'idea') ideaMem.push(e.content);
      const maxIdea = Math.max(...Object.values(w.agents).map(a => (a.memory?.entries || []).filter(e => e.category === 'idea').length));
      const blob = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(blob);
      return { seededBy, sAg, sMed, fx: { p: fx.progressive.length, m: fx.moderate.length, c: fx.conservative.length }, protest: protest ? { title: w.proposals.title(protest), who: protest.proposerName } : null, tailor: tailor?.name,
        inv, invProg: cur ? R.projects[cur.key].progress : null, invMem, ideaMem: ideaMem.slice(0, 4), maxIdea, rt: { ideas: Object.keys(w2.ideaSystem.ideas).length, inv: w2.ideaSystem.inventions.length, n: Object.keys(IS.ideas).length } };
    });
    ok(r.seededBy >= 1, '研究完成時研究員先接受新觀念', r.seededBy);
    ok(r.sAg.adopt + r.sAg.resist <= r.sAg.total && r.sAg.adopt >= r.sAg.total / 2, '30 天後「輪作」傳開(過半接受),人數不超過鎮民', r.sAg);
    ok(r.sMed.resist >= 1, '爭議大的「先看醫生」有人反對', r.sMed);
    ok(r.fx.p >= 1 && r.fx.c >= 1, '鎮上分出革新派與保守派', r.fx);
    ok(!!r.protest, '紡織坊上線,保守的裁縫提案抗議', r.protest);
    ok(!!r.inv && (r.inv.tech ? r.invProg > 0 : true), '發明家靈光一閃,推進研究', r.inv);
    ok(r.invMem.some(x => lang === 'zh' ? /式/.test(x) : /came up with the/.test(x)), '發明者記得自己的發明', r.invMem);
    ok(r.maxIdea <= 8, '觀念閒聊記憶每人最多 8 筆,不擠掉人際記憶', r.maxIdea);
    ok(lang === 'zh' || r.ideaMem.every(x => !/[一-鿿]{2,}/.test(x.replace(/[一-鿿]{2,3}(?=[ :,])/g, ''))), '英文介面的觀念記憶是英文', r.ideaMem);
    ok(r.rt.ideas === r.rt.n && r.rt.inv >= 1, '存檔→讀檔保留觀念與發明', r.rt);
    await page.evaluate(() => { const app = window.rimtownApp; app.state = app.world.getState(); app._goTab?.('economy'); app.activeTab = 'econ-build'; app.renderSidebar?.(); });
    await page.waitForTimeout(600);
    const panel = await page.evaluate(() => ({ ideas: document.querySelectorAll('.tech-idea').length, heads: [...document.querySelectorAll('.tech-era-head')].map(e => e.innerText.replace(/\s+/g, ' ')) }));
    ok(panel.ideas >= 3 && panel.heads.some(h => /發明名人堂|Hall of inventions/.test(h)) && panel.heads.some(h => /支持與反對|For and against/.test(h)), '科技面板顯示觀念傳播條、派系、發明名人堂', panel);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
