// v6.56.0 城鎮四級:等級判定與升降級、稱號換字、議會席次、從政資歷與參選資格、官職標籤、存讀檔、暫停城鎮回來補變化
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

    const v = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true);
      TIERS.daily(w); app.state = w.getState(); app.render();
      const pop = document.getElementById('population-count')?.textContent || '';
      const mayor = w.election.currentMayor(w);
      let chip = ''; if (mayor) { app._showNpcCard(mayor.agentId); chip = document.getElementById('npc-quick-card')?.innerText || ''; app._hideNpcCard(); }
      // 3D 名牌
      for (let i = 0; i < 12; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); }
      const mm = mayor && app.tileMap._agentMeshes[mayor.agentId]; const tagOffice = !(mm && mm.visible) ? 'hidden' : !!document.querySelector('.t3d-tag.has-office .t3d-office-leader'); const head = mayor ? (document.querySelector('.nqc-job')?.textContent || mayor.job.title) : '';
      return { head: mayor?.job?.title, lv: TIERS.level(w), pop, title: t('鎮長'), en: t('Mayor'), hasMayor: !!mayor, chip, tagOffice, mayorBadge: mayor ? TIERS.badge(w, mayor) : null };
    });
    ok(v.lv === 0 && /🏡/.test(v.pop), '開局 25 人是村莊，上方顯示 🏡', v);
    if (lang === 'zh') ok(v.title === '村長', '中文介面：鎮長顯示成村長', v.title); else ok(/Village Chief/.test(v.en), '英文介面：Mayor 顯示成 Village Chief', v.en);
    ok(!v.hasMayor || (v.mayorBadge?.cls === 'leader' && /🎖️/.test(v.chip)), '現任首長的角色卡有官職標籤', { badge: v.mayorBadge, chip: v.chip.slice(0, 160) });
    ok(!v.hasMayor || v.tagOffice === true || v.tagOffice === 'hidden', '地圖名牌上也有官職標籤（首長在室內時略過）', v);
    ok(!v.hasMayor || v.head === (lang === 'zh' ? '村長' : 'Village Chief'), '角色卡職業欄也顯示村長', v.head);

    // 升格:人口 32、繁榮 60
    const up = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      while (npcs().length < 32) { const all = npcs(); w.tickCount++; w.lifecycle._birthChild(w, all[0], all[1]); }
      for (const [k, v] of Object.entries({ wood: 400, stone: 400, furniture: 40, tools: 40 })) w.stockpile.resources[k] = Math.max(w.stockpile.get(k), v); // v6.79.0 升格要家具
      w.prosperity.prosperity = 60; w.council._formCouncil(w); const seats0 = w.council.members.length;
      const mayor = w.election.currentMayor(w); TIERS.daily(w); const after1 = TIERS.level(w); TIERS.daily(w); TIERS.daily(w); if (TIERS.needsVote?.(w) && TIERS.ready?.(w)) TIERS.promote(w); /* v6.81.0 升格要提案通過:這裡當作提案已通過 */ w.prosperity.prosperity = 60;
      const lv = TIERS.level(w); const seats1 = w.council.members.length;
      const log = (w.messageLog || []).slice(-30).some(m => /升格|grown from/i.test(m.content || m.text || ''));
      const c = TIERS.S(w).career[mayor?.agentId] || [];
      const nobody = npcs().find(a => a !== mayor && !(w.council.members || []).includes(a.agentId) && !(TIERS.S(w).career[a.agentId] || []).length);
      return { seats0, after1, lv, seats1, log, title: t('鎮長'), mayorCareer: c.map(x => [x.role, x.lv, x.to === null]), mayorOk: TIERS.qualified(w, mayor), nobodyOk: TIERS.qualified(w, nobody) };
    });
    ok(up.seats0 === 3, '村莊的長老會 3 席', up);
    ok(up.after1 === 0 && up.lv === 1, '連續 3 天達標才升格為城鎮', up);
    ok(up.log, '升格有公告', up);
    ok(up.seats1 === 5, '城鎮議會擴成 5 席', up);
    ok(lang !== 'zh' || up.title === '鎮長', '升格後稱號變鎮長', up.title);
    ok(up.mayorCareer.some(x => x[0] === 'leader' && x[1] === 0 && !x[2]) && up.mayorCareer.some(x => x[0] === 'leader' && x[1] === 1 && x[2]), '現任村長直接接任鎮長，從政經歷記下來', up.mayorCareer);
    ok(up.mayorOk && !up.nobodyOk, '城鎮以上沒資歷不能參選首長；前村長可以', up);

    // 選舉:只有一個人有資格 → 續任;議員滿一季後有資格 → 開選
    const el = await page.evaluate(() => {
      const w = window.rimtownApp.world, E = w.election; E.active = false; E.phase = 'none';
      E._startElection(w); const auto = !E.active && (w.messageLog || []).slice(-5).some(m => /續任|stay in office/i.test(m.content || m.text || ''));
      const T = TIERS.S(w); const d = w._absDay(); for (const id of w.council.members) for (const c of (T.career[id] || [])) if (c.role === 'council' && c.to === null) c.from = d - 20;
      E.active = false; E.phase = 'none'; E._startElection(w);
      const cands = (E.candidates || []).map(c => c.agentId); const allOk = cands.every(id => TIERS.qualified(w, w.agents[id]));
      E.active = false; E.phase = 'none'; E.candidates = [];
      return { auto, started: cands.length >= 2, allOk };
    });
    ok(el.auto, '只有現任有資歷時不辦選舉，直接續任', el);
    ok(el.started && el.allOk, '議員做滿一季就有資格參選；候選人全都有資歷', el);

    // 卡片顯示從政經歷、鎮況頁有等級進度
    const ui = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world; app.state = w.getState(); const m = w.election.currentMayor(w);
      app._showNpcCard(m.agentId); const card = document.getElementById('npc-quick-card')?.innerHTML || ''; app._hideNpcCard();
      const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); const tier = box.querySelector('.pp-tier')?.innerText || ''; box.remove();
      return { career: /🗂️/.test(card), tier };
    });
    ok(ui.career, '首長的角色卡有從政經歷', ui);
    ok(/🏘️/.test(ui.tier) && /🏙️/.test(ui.tier) && /60/.test(ui.tier), '鎮況頁顯示目前等級與升格為城市還差什麼', ui.tier.slice(0, 200));

    // 降級:繁榮掉到 10,連續 10 天
    const down = await page.evaluate(() => { const w = window.rimtownApp.world; w.prosperity.prosperity = 10; const lv = []; for (let i = 0; i < 10; i++) { TIERS.daily(w); w.prosperity.prosperity = 10; lv.push(TIERS.level(w)); } return lv; });
    ok(down.slice(0, 9).every(x => x === 1) && down[9] === 0, '連續 10 天跌破才降級', down);

    // 存讀檔、補變化、新城鎮清空
    const sv = await page.evaluate(() => {
      const w = window.rimtownApp.world; const d = w.serialize(); const career = Object.keys(d.tierState?.career || {}).length;
      const w2 = new World(); d.savedGlobalDay = (TownGen.registry().days || 0) - 12; const ok2 = w2.loadSave(JSON.parse(JSON.stringify(d)));
      const w3 = new World(); const d3 = JSON.parse(JSON.stringify(d)); d3.savedGlobalDay = TownGen.registry().days || 0; w3.loadSave(d3);
      w2.reset(); return { ok2: !!ok2, career, lv: d.tierState.lv, catchUp: w2._catchUp || null, noCatch: w3._catchUp, resetClears: !w2.tierState };
    });
    ok(sv.career >= 1, '從政經歷存進存檔', sv);
    ok(sv.catchUp && sv.catchUp.days === 12, '離開 12 天的城鎮回來時補上變化', sv);
    ok(!sv.noCatch, '沒離開就不補', sv);
    ok(sv.resetClears, '新城鎮不帶入舊鎮的等級與經歷', sv);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
