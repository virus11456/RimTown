// v6.94.0 村民 Q 版大頭:比例、圓滑表面、眨眼與睡覺閉眼、四肢與工具、遠處簡化網格、年齡貧富外觀;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
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
      const out = {}; const w = app.world; const T = app.tileMap;
      const verts = (m) => { let n = 0; m.traverse(o => { if (o.isMesh && !o.userData.isLod) n += o.geometry.attributes.position.count; }); return n; };
      const m = T._agentMesh('q_test', { name: 'q_test', job: { key: 'farmer' }, appear: { b: 'a', cls: 1, king: false, hl: false }, look: { hair: 1, acc: 2 } }, { job: 'farmer', gender: 'female' });
      // 1) Q 版:頭比身體大、有眼睛與閉眼兩個網格、四肢能擺動
      const b0 = m.children[0].geometry; b0.computeBoundingBox(); out.height = b0.boundingBox.max.y; out.width = b0.boundingBox.max.x - b0.boundingBox.min.x;
      out.eyes = !!m.userData.eyes && !!m.userData.lids && m.userData.lids.visible === false; out.limbs = ['legL', 'legR', 'armL', 'armR'].every(n => m.children.some(c => c.name === n)); out.tool = !!m.userData.tool;
      // 2) 圓形零件:法線是圓滑的(不是只有六個方向的方塊)
      const nor = b0.attributes.normal; const dirs = new Set(); for (let i = 0; i < nor.count; i += 3) dirs.add([nor.getX(i), nor.getY(i), nor.getZ(i)].map(v => Math.round(v * 4)).join(',')); out.smoothDirs = dirs.size;
      // 3) 眨眼與睡覺閉眼:更新迴圈依狀態切換
      const ag = Object.values(w.agents).find(a => !a.isPlayer && !a.isDead); const aid = ag.agentId; app.state = w.getState(); const st = app.state.agents;
      const z = T.buildingZones?.town_square || Object.values(T.buildingZones || {})[0]; T.agentPositions[aid] = Object.assign(T.agentPositions[aid] || {}, { x: z ? (z.x + z.w / 2) * 16 : 300, y: z ? (z.y + z.h + 2) * 16 : 300, walking: false }); T.target.x = T.agentPositions[aid].x / 16; T.target.z = T.agentPositions[aid].y / 16; // 站在廣場外的空地(不在屋裡)
      st[aid].activity = 'sleeping'; T._updateAgents3D(st, null); const mm = T._agentMeshes[aid]; out.sleepShut = mm && mm.userData.eyes && !mm.userData.eyes.visible && mm.userData.lids.visible;
      st[aid].activity = 'idle'; let opened = false, blinked = false; for (let f = 0; f < 240; f++) { T.animFrame = f; T._updateAgents3D(st, null); if (mm.userData.eyes.visible) opened = true; else blinked = true; } out.blink = opened && blinked;
      // 4) 人多時遠處的簡化網格頂點比較少
      const full = verts(m); const lod = T._agentLod(m); out.lodRatio = lod.geometry.attributes.position.count / full; out.full = full;
      T._agentGroup.remove(m); T._disposeAgent(m); delete T._agentMeshes['q_test'];
      // 5) 依年齡、貧富換外觀照樣有效(小孩較矮、國王王冠)
      const kid = T._agentMesh('q_kid', { name: 'q_kid', job: { key: 'farmer' }, appear: { b: 'c', cls: 1, king: false, hl: false } }, { job: 'farmer', gender: 'male' });
      const kng = T._agentMesh('q_king', { name: 'q_king', job: { key: 'mayor' }, appear: { b: 'e', cls: 5, king: true, hl: false } }, { job: 'mayor', gender: 'male' });
      const kb = kng.children[0].geometry; kb.computeBoundingBox(); out.kidScale = kid.scale.x; out.kingTop = kb.boundingBox.max.y;
      for (const id of ['q_kid', 'q_king']) { const x = T._agentMeshes[id]; T._agentGroup.remove(x); T._disposeAgent(x); delete T._agentMeshes[id]; }
      try { const d0 = w._absDay(); for (let i = 0; i < 96 * 2 && w._absDay() - d0 < 2; i++) { w.paused = false; w.tick(); } w.paused = true; } catch (e) { out.err = e.message; }
      return out;
    });
    await page.waitForTimeout(500);
    ok(r.height > 1.3 && r.height < 1.8 && r.width > 0.7, 'Q 版比例：大圓頭、矮小的身體', { h: r.height, w: r.width });
    ok(r.eyes && r.limbs && r.tool, '有會眨眼的眼睛、閉眼線，手腳能擺動、手上能拿工具', { e: r.eyes, l: r.limbs, t: r.tool });
    ok(r.smoothDirs > 40, '圓頭、圓身體的表面是圓滑的（不是方塊）', r.smoothDirs);
    ok(r.sleepShut, '睡覺時閉上眼睛', r.sleepShut);
    ok(r.blink, '醒著的時候會眨眼', r.blink);
    ok(r.lodRatio < 0.6 && r.full < 6000, '人多時遠處改用頂點少一半以上的簡化網格；近看每人頂點也控制在 6000 以內', { ratio: r.lodRatio, full: r.full });
    ok(r.kidScale < 1.0 && r.kingTop > 1.5, '小孩較矮、國王頭上有王冠（年齡貧富外觀照樣有效）', { k: r.kidScale, t: r.kingTop });
    ok(!r.err, '跑幾天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
