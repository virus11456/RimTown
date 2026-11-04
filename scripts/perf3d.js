// 3D 效能量測:繪製呼叫、三角形、幾何／貼圖數、JS 記憶體、每幀時間(桌機＋手機各一次)
// 用法:BASE=http://localhost:8126/ node scripts/perf3d.js [shot前綴]
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
const shot = process.argv[2] || '';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  for (const [label, opts, q] of [['desktop', { viewport: { width: 1280, height: 800 } }, 'high'], ['mobile', { ...devices['iPhone 13'] }, 'auto']]) {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', (r) => { const u = r.request().url(); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); if (u.includes('/api/chat')) return j({ reply: '' }); return j({}); });
    await page.addInitScript(({ jwt, q }) => { localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', q); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, q });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.tileMap?.renderer, null, { timeout: 40000 });
    await page.waitForTimeout(6000);
    const r = await page.evaluate(async () => {
      const tm = window.rimtownApp.tileMap, R = tm.renderer; tm.lockQuality = true;
      let calls = 0, tris = 0, n = 0; const t0 = performance.now(); let frames = 0;
      await new Promise(res => { const step = () => { const i = R.info.render; calls = Math.max(calls, i.calls); tris = Math.max(tris, i.triangles); frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      let meshes = 0, agentMeshes = 0; tm.scene.traverse(o => { if (o.isMesh) meshes++; }); for (const m of Object.values(tm._agentMeshes || {})) m.traverse(o => { if (o.isMesh) agentMeshes++; });
      return { calls, tris, geos: R.info.memory.geometries, tex: R.info.memory.textures, frameMs: +(5000 / frames).toFixed(1), meshes, agentMeshes, agents: Object.keys(tm._agentMeshes || {}).length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, low: tm.lowQuality, shadows: R.shadowMap.enabled };
    });
    console.log(label, JSON.stringify(r), errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : '');
    if (shot) { await page.evaluate(() => { const tm = window.rimtownApp.tileMap; tm.dist = 16; }); await page.waitForTimeout(1500); await page.screenshot({ path: `${shot}_${label}.png` }); }
    await ctx.close();
  }
  await browser.close();
})();
