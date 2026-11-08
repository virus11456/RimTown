// v6.91.0 科技樹分細:四個時代 48 項、前置與效果都有效、成本隨時代提高、研究點每天最多用 40、研究完研究點不再堆、
// 第四時代效果生效、舊檔成本跟新版、科技頁四個時代;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const RESEARCH_COST_AGRI = 150;
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {}; const w = app.world; const R = w.research; const T = RESEARCH_TREE;
      // 1) 樹的結構:四個時代、48 項、前置存在且不跨到後面的時代、效果都是有在用的鍵
      const USED = ['farm_bonus', 'smithing_bonus', 'healing_bonus', 'defense_bonus', 'trade_bonus', 'build_speed', 'beauty_bonus', 'research_bonus', 'recreation_bonus', 'storage_bonus', 'stone_efficiency', 'xp_bonus', 'discover_bonus', 'culture_bonus', 'merchant_frequency'];
      out.n = Object.keys(T).length; out.eras = [...new Set(Object.values(T).map(d => d.era))].sort().join(','); out.badPre = []; out.badFx = [];
      const sum = {}; for (const [k, d] of Object.entries(T)) { sum[d.era] = (sum[d.era] || 0) + d.cost; for (const p of d.prerequisites) if (!T[p] || T[p].era > d.era) out.badPre.push(k + '<' + p); for (const e of Object.keys(d.effects || {})) if (!USED.includes(e)) out.badFx.push(k + ':' + e); }
      out.sum = sum; out.total = Object.values(sum).reduce((a, b) => a + b, 0); out.newNodes = ['animal_husbandry', 'crop_rotation', 'guilds', 'steam_power', 'vaccination', 'railways'].every(k => T[k]);
      out.namesEn = Object.values(R.projects).filter(p => /[一-鿿]/.test(t(p.name)) || /[一-鿿]/.test(t(p.description))).map(p => p.key);
      // 2) 研究點每天最多用 40
      for (const p of Object.values(R.projects)) { p.status = 'available'; p.progress = 0; } R.refreshLocks(); R.current = null;
      const k0 = Object.values(R.projects).find(p => p.status === 'available').key; R.startResearch(k0);
      for (const a of Object.values(w.agents)) if (a.job?.key === 'researcher') a._jobKeySaved = a.job; // 不動職業,只看研究點用量
      const sp = w.stockpile; sp.resources.research_points = 100; R.dailyUpdate(w); out.rpUsed = 100 - sp.get('research_points'); out.progress = R.projects[k0].progress;
      // 3) 全部研究完:研究點最多留 200
      for (const p of Object.values(R.projects)) { p.status = 'complete'; p.progress = p.cost; } R.current = null; sp.resources.research_points = 1000; R.dailyUpdate(w); out.rpCapped = sp.get('research_points');
      out.era4 = R.currentEra();
      // 4) 第四時代的效果真的會生效
      for (const p of Object.values(R.projects)) if (p.era === 4) p.status = 'available'; w.buildings.recomputeEffects(w); const f0 = w.buildings.getEffect('farm_bonus', 0); const h0 = w.buildings.getEffect('healing_bonus', 0);
      R.projects.mechanized_farming.status = 'complete'; R.projects.vaccination.status = 'complete'; w.buildings.recomputeEffects(w); out.fx = [f0, w.buildings.getEffect('farm_bonus', 0), h0, w.buildings.getEffect('healing_bonus', 0)];
      for (const p of Object.values(R.projects)) p.status = 'complete'; w.buildings.recomputeEffects(w);
      // 5) 舊檔:成本跟著新版科技樹,進度保留
      const data = JSON.parse(JSON.stringify(w.serialize())); data.research.projects.agriculture.cost = 50; data.research.projects.agriculture.status = 'researching'; data.research.projects.agriculture.progress = 30; data.research.current = 'agriculture';
      delete data.research.projects.steam_power; const w2 = new World(); w2.loadSave(data);
      out.oldSave = { cost: w2.research.projects.agriculture.cost, prog: w2.research.projects.agriculture.progress, steam: w2.research.projects.steam_power?.status };
      // 6) 科技頁畫出第四時代
      for (const p of Object.values(R.projects)) { p.status = p.era <= 2 ? 'complete' : 'locked'; p.progress = p.status === 'complete' ? p.cost : 0; } R.refreshLocks(); w.buildings.recomputeEffects(w);
      const save = app.world; app.state = w.getState(); const box = document.createElement('div'); box.style.width = (window.innerWidth < 500 ? 340 : 420) + 'px'; document.body.appendChild(box);
      app.activeTab = 'econ-build'; try { app.renderEconomy(box); } catch (e) { out.techErr = e.message; } const eras = [...box.querySelectorAll('.tech-era-head')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(x => /時代|Era /.test(x)); out.techEras = eras; out.techOverflow = box.scrollWidth > box.clientWidth + 2; out.techHasSteam = /蒸汽動力|Steam Power/.test(box.textContent); box.remove(); app.state = save.getState();
      // 7) 跑幾天沒錯
      try { const d0 = w._absDay(); for (let i = 0; i < 96 * 3 && w._absDay() - d0 < 3; i++) { w.paused = false; w.tick(); } w.paused = true; } catch (e) { out.err = e.message; }
      return out;
    });
    const zh = lang === 'zh';
    ok(r.n === 48 && r.eras === '1,2,3,4' && r.newNodes, '科技樹分成四個時代、48 項（多了畜牧、輪作、行會、蒸汽動力、疫苗、鐵道…）', { n: r.n, e: r.eras });
    ok(!r.badPre.length, '每一項的前置都存在，而且不會要求後面時代的科技', r.badPre);
    ok(!r.badFx.length, '每一項效果都是遊戲裡真的有在用的效果', r.badFx);
    ok(r.sum[1] < r.sum[2] && r.sum[2] < r.sum[3] && r.sum[3] < r.sum[4] && r.total > 80000, '越後面的時代越貴，整棵樹成本大幅提高', { s: r.sum, t: r.total });
    ok(!r.namesEn.length || zh, '英文介面每項科技都有英文名稱與說明', r.namesEn);
    ok(r.rpUsed === 40 && r.progress >= 40, '研究點每天最多用 40（以前只用 10，一直堆）', { u: r.rpUsed, p: r.progress });
    ok(r.rpCapped === 200, '全部研究完以後，研究點最多留 200，不再無限堆', r.rpCapped);
    ok(r.era4 === 4, '前三個時代研究過半就進入第四時代「機械」', r.era4);
    ok(r.fx[1] > r.fx[0] && r.fx[3] > r.fx[2], '機械時代的科技完成後效果真的生效（機械農耕、疫苗）', r.fx);
    ok(r.oldSave.cost === RESEARCH_COST_AGRI && r.oldSave.prog === 30 && r.oldSave.steam, '舊檔讀進來：成本用新版、進度保留、新科技補上', r.oldSave);
    ok(!r.techErr && r.techEras.length === 4 && (zh ? /第 四 時代|第四時代/.test(r.techEras[3]) : /Era IV/.test(r.techEras[3])) && r.techHasSteam, '科技頁畫出四個時代', { e: r.techEras, err: r.techErr });
    ok(r.techOverflow === false, '科技頁在這個寬度不會橫向溢出', r.techOverflow);
    ok(!r.err, '跑幾天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
