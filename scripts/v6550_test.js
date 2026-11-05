// v6.55.0 大人口:人多時關係／記憶精簡(存讀檔一致)、重要人物才用 AI、遠處村民簡化繪製與名牌、雲端存檔壓縮上傳與解壓讀回
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  let uploaded = null;
  await page.route('**/api/**', r => {
    const u = r.request().url(), m = r.request().method();
    if (/\/api\/save$/.test(u) && m === 'POST') { try { uploaded = JSON.parse(r.request().postData()); } catch (e) {} return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }); }
    if (/\/api\/save\/zz_town$/.test(u) && uploaded) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save_data: uploaded.save_data }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) });
  });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);

  const small = await page.evaluate(() => { const w = window.rimtownApp.world; const N = CROWD.notable(w); const mayor = w.election?.currentMayor?.(w); return { pop: CROWD.pop(w), crowded: CROWD.aiCrowded(w), notable: N.size, mayorIn: !mayor || N.has(mayor.agentId), relsBefore: Object.values(w.agents).filter(a => !a.isPlayer).reduce((s, a) => s + Object.keys(a.relationships.relationships).length, 0) }; });
  ok(small.pop < 40 && !small.crowded && small.mayorIn && small.notable >= 1, '小鎮：重要人物名單有鎮長，不啟用人多模式', small);
  const smallTrim = await page.evaluate(() => { const w = window.rimtownApp.world; CROWD.daily(w); return Object.values(w.agents).filter(a => !a.isPlayer).reduce((s, a) => s + Object.keys(a.relationships.relationships).length, 0); });
  ok(smallTrim === small.relsBefore, '小鎮不刪任何關係（行為跟以前一樣）', { before: small.relsBefore, after: smallTrim });

  // 長到 110 人
  const big = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true);
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    while (npcs().length < 113) { /* 多長幾個:兩天模擬裡可能有人離鎮 */ const all = npcs(); w.tickCount++; w.lifecycle._birthChild(w, all[Math.floor(Math.random() * all.length)], all[Math.floor(Math.random() * all.length)]); }
    w.paused = false; for (let k = 0; k < 96 * 2; k++) w.tick(); w.paused = true;
    // 塞一堆空白關係與記憶,看會不會被清掉
    const N0 = CROWD.notable(w); const a0 = npcs().find(a => !N0.has(a.agentId)) || npcs()[5]; for (const b of npcs().slice(0, 100)) if (b !== a0) a0.relationships.getOrCreate(b.agentId, b.name);
    for (let i = 0; i < 150; i++) a0.memory.add(w.tickCount, '', 'daily', 'm' + i, i % 10 === 0 ? 8 : 3, []);
    const N = CROWD.notable(w); const nonNot = npcs().find(a => !N.has(a.agentId) && a !== a0);
    const before = JSON.stringify(w.serialize()).length;
    CROWD.daily(w);
    const relMax = Math.max(...npcs().map(a => Object.keys(a.relationships.relationships).length));
    const trivialLeft = npcs().some(a => Object.values(a.relationships.relationships).some(r => CROWD.trivial(r)));
    const a0Mem = a0.memory.entries.length, a0Imp = a0.memory.entries.filter(e => e.importance >= 8).length;
    // 存讀檔一致
    const s1 = w.serialize(); const j1 = JSON.stringify(s1); const w2 = new World(); w2.loadSave(JSON.parse(j1)); const j2 = JSON.stringify(w2.serialize());
    const relEq = JSON.stringify(Object.values(s1.agents).map(a => Object.keys(a.relationships || {}).length)) === JSON.stringify(Object.values(JSON.parse(j2).agents).map(a => Object.keys(a.relationships || {}).length));
    // AI 只給重要人物
    const ce = w.conversationEngine; const x = npcs().filter(a => !N.has(a.agentId)); const y = npcs().find(a => N.has(a.agentId));
    const _near = ce.isNearPlayer; ce.isNearPlayer = () => true;
    const twoNobodies = ce._npcLlmAllowed(w, x[0], x[1]), withNotable = ce._npcLlmAllowed(w, x[0], y); ce.isNearPlayer = _near;
    ce.queueDailyPlans(w); const planOnlyNotable = (ce._planQueue || []).every(id => N.has(id)) && (ce._planQueue || []).length <= N.size;
    return { pop: npcs().length, crowded: CROWD.aiCrowded(w), relMax, trivialLeft, a0Mem, a0Imp, before: Math.round(before / 1024), after: Math.round(j1.length / 1024), relEq, twoNobodies, withNotable, planOnlyNotable, notable: N.size };
  });
  ok(big.pop >= 110 && big.crowded, '長到 110 人，啟用人多模式', big);
  ok(big.relMax <= 40 && !big.trivialLeft, '每人最多 40 段關係，沒有空白的點頭之交', big);
  ok(big.a0Mem <= 60 && big.a0Imp >= 10, '非重要人物記憶留 60 筆，重要的記憶優先保留', big);
  ok(big.after < big.before, '存檔變小', big);
  ok(big.relEq, '精簡後存讀檔前後一致', big);
  ok(!big.twoNobodies && big.withNotable, '兩個路人閒聊用規則版；有重要人物在才用 AI', big);
  ok(big.planOnlyNotable, 'AI 行程只排重要人物', big);

  // 3D:遠處簡化、名牌只掛附近
  const r3 = await page.evaluate(async () => {
    const app = window.rimtownApp, tm = app.tileMap; app.state = app.world.getState();
    for (let i = 0; i < 8; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); }
    const meshes = Object.values(tm._agentMeshes); const vis = meshes.filter(m => m.visible);
    const far = vis.filter(m => m.userData.far).length; const lodOk = vis.filter(m => m.userData.far).every(m => m.userData.lod?.visible && m.children.filter(c => c !== m.userData.lod).every(c => !c.visible));
    const tags = tm.overlay ? tm.overlay.querySelectorAll('.t3d-tag').length : -1;
    // 拉近:附近的人恢復完整模型
    const any = vis.find(m => m.userData.far); let restored = null;
    if (any) { tm.target.x = any.position.x; tm.target.z = any.position.z; for (let i = 0; i < 4; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); } restored = !any.userData.far && !any.userData.lod.visible; }
    return { visible: vis.length, far, lodOk, tags, restored, calls: tm.renderer.info.render.calls };
  });
  ok(r3.far > r3.visible * 0.5 && r3.lodOk, '遠處的村民用簡化模型（一人一次繪製）', r3);
  ok(r3.tags < r3.visible, '遠處的人不掛名牌', r3);
  ok(r3.restored === true, '鏡頭靠近後恢復完整模型', r3);
  ok(r3.calls < 260, '110 人時繪製次數維持在合理範圍', r3);

  // 雲端存檔:壓縮上傳＋tick_count;讀回解壓
  const cz = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world; const raw = JSON.stringify(w.serialize());
    await app.auth.cloudSave('zz_town', 'ZZ', w.serialize(), { season: '春季', year: 1, day: 1, population: 110 });
    return { rawKB: Math.round(raw.length / 1024), tick: w.tickCount };
  });
  ok(uploaded && uploaded.save_data.startsWith('gz:') && uploaded.tick_count === cz.tick && uploaded.save_data.length < cz.rawKB * 1024 / 3, '大存檔壓縮上傳（附 tick_count）', { len: uploaded && uploaded.save_data.length, tick: uploaded && uploaded.tick_count, cz });
  const back = await page.evaluate(async () => { const d = await window.rimtownApp.auth.cloudLoad('zz_town'); return { tick: d.tickCount, agents: Object.keys(d.agents || {}).length }; });
  ok(back.tick === cz.tick && back.agents >= 110, '壓縮存檔讀回來解得開、內容正確', back);
  const smallUp = await page.evaluate(async () => { await window.rimtownApp.auth.cloudSave('zz_small', 'S', { tickCount: 5, agents: {} }, {}); return true; });
  ok(smallUp && uploaded && !uploaded.save_data.startsWith('gz:') && uploaded.tick_count === 5, '小存檔照舊不壓縮', { start: uploaded && uploaded.save_data.slice(0, 20) });
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
