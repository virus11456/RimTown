// v6.42.1 出門探險的人從地圖消失(沒有模型、沒有名牌),探險回來才重新出現
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', (r) => { const u = r.request().url(); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return j({ logged_in: true, user: { id: 1, username: 'tester' } }); if (u.includes('/api/chat')) return j({ reply: '' }); return j({}); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world?.exploration && window.rimtownApp.tileMap?._agentMeshes, null, { timeout: 40000 });
  await page.waitForTimeout(3000);
  const ids = await page.evaluate(() => {
    const app = window.rimtownApp, w = app.world, ex = w.exploration; app._setPaused?.(true);
    const zoneId = EXPLORATION_ZONES[0].id; ex.discoveredZones[zoneId] = ex.discoveredZones[zoneId] || { discovered: true, timesExplored: 0, lastExploredTick: 0 };
    const team = Object.values(w.agents).filter(a => !a.isPlayer && a.job?.key !== 'mayor').slice(0, 2).map(a => a.agentId);
    const exp = zoneId ? ex.sendExpedition(w, zoneId, team) : null;
    app.state = w.getState(); return { team, zoneId, ok: !!exp, names: team.map(id => w.agents[id].name) };
  });
  ok(ids.ok, '派出探險隊', ids);
  await page.waitForTimeout(2500);
  let r = await page.evaluate((team) => { const tm = window.rimtownApp.tileMap; const labels = [...document.querySelectorAll('.t3d-agent, .t3d-name-tag, [class*="t3d-npc"]')].map(e => e.textContent).join('|'); return { pos: team.map(id => !!tm.agentPositions[id]), mesh: team.map(id => !!tm._agentMeshes[id]), labels }; }, ids.team);
  ok(r.pos.every(x => !x) && r.mesh.every(x => !x), '探險中的人沒有位置、沒有 3D 模型', r);
  ok(!ids.names.some(n => r.labels.includes(n)), '探險中的人沒有名牌', { names: ids.names, labels: r.labels.slice(0, 200) });
  r = await page.evaluate((team) => { const app = window.rimtownApp, w = app.world, ex = w.exploration; const e = ex.activeExpeditions[ex.activeExpeditions.length - 1]; e.returnTick = w.tickCount; ex._checkReturningExpeditions(w); app.state = w.getState(); return team.map(id => w.agents[id].currentLocation); }, ids.team);
  await page.waitForTimeout(2500);
  const back = await page.evaluate((team) => { const tm = window.rimtownApp.tileMap; return { pos: team.map(id => !!tm.agentPositions[id]), mesh: team.map(id => !!tm._agentMeshes[id]) }; }, ids.team);
  ok(r.every(l => l !== 'exploration') && back.pos.every(Boolean) && back.mesh.every(Boolean), '回來後重新出現在地圖上', { locs: r, back });
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
