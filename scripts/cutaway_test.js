// v9.1.0 屋頂透視：鏡頭拉遠有屋頂、拉近到一定程度屋頂與外牆換成剖面（地板、矮牆、家具），屋裡的人看得到，並依在做什麼被安排到床／椅子／工作台
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang, vp) {
  console.log(`— ${lang} ${vp.width}px`); const mobile = vp.width <= 768;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (/interior/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(1500);
  // 鏡頭固定住（事件、跟拍都不能把它帶走），每 50ms 重設一次
  const cam = (id, d) => page.evaluate(({ id, d }) => { const tm = window.rimtownApp.tileMap, z = tm.buildingZones[id]; clearInterval(window.__camT); const f = () => { tm._followAgent = null; tm._focusTo = null; tm.idleCam = false; tm.target.x = z.x + z.w / 2; tm.target.z = z.y + z.h / 2; tm.dist = d; }; f(); window.__camT = setInterval(f, 50); }, { id, d });
  // 1) 剖面有蓋好：每棟有門的建築都有床位／座位／工作位，外觀與剖面分開合併
  const s1 = await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); const tm = app.tileMap; const ids = Object.entries(tm.buildingZones).filter(([, z]) => z.doorPixelX !== undefined).map(([k]) => k);
    const missing = ids.filter(k => !tm._inSpots?.[k]); const empty = ids.filter(k => { const S = tm._inSpots?.[k]; return S && !Object.values(S).some(a => a.length); });
    const houses = ids.filter(k => k.startsWith('residential_')); const bedless = houses.filter(k => !(tm._inSpots[k]?.sleep?.length >= 2));
    const merged = (g) => !!g && g.children.some(c => c.name === 'merged');
    return { n: ids.length, missing, empty, bedless, ext: merged(tm._bExt), cut: merged(tm._bCut), tmpl: Object.values(tm._inTmpl || {}).filter((v, i, a) => a.indexOf(v) === i) }; });
  ok(s1.n > 5 && !s1.missing.length && !s1.empty.length, `每棟有門的建築都有屋內位置（${s1.n} 棟）`, s1);
  ok(!s1.bedless.length, '每戶民宅至少兩個床位', s1.bedless);
  ok(s1.ext && s1.cut, '外觀與剖面各自合併成少數幾個網格', s1);
  ok(s1.tmpl.includes('house') && s1.tmpl.length >= 4, '民宅與各種公共建築都有各自的擺設', s1.tmpl);
  // 2) 拉遠：有屋頂、看不到剖面
  const hid = await page.evaluate(() => Object.keys(window.rimtownApp.tileMap.buildingZones).find(k => /^residential_.*_\d+$/.test(k)));
  await cam(hid, 50); await page.waitForFunction(() => !window.rimtownApp.tileMap._cutOn, null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(600);
  const far = await page.evaluate(() => { const tm = window.rimtownApp.tileMap; return { on: !!tm._cutOn, ext: tm._bExt.visible, cut: tm._bCut.visible, calls: tm.renderer.info.render.calls }; });
  ok(!far.on && far.ext && !far.cut, '拉遠時屋頂在、剖面不畫', far);
  // 3) 把兩個人放進屋裡睡覺：拉遠看不到、拉近躺在床上
  const ids = await page.evaluate((hid) => { const app = window.rimtownApp, tm = app.tileMap, z = tm.buildingZones[hid]; const aids = Object.keys(tm.agentPositions).filter(a => app.world.agents[a] && !app.world.agents[a].isPlayer).slice(0, 3);
    window.__pin = () => { const cx = (z.x + z.w / 2) * 16, cy = (z.y + z.h / 2) * 16; aids.forEach((a, i) => { const p = tm.agentPositions[a]; p.x = cx + (i - 1) * 6; p.y = cy; p.targetX = p.x; p.targetY = p.y; p.walking = false; p.doorPhase = null; p.finalTarget = null; p._pathWaypoints = null; p.activity = i < 2 ? 'sleeping' : 'eating'; const ag = app.world.agents[a]; ag.activity = p.activity; ag.current_activity = p.activity; const sa = app.state?.agents?.[a]; if (sa) { sa.activity = p.activity; sa.current_activity = p.activity; } }); };
    tm.__upd = tm.__upd || tm.updateAgents; tm.updateAgents = () => {}; window.__pin(); clearInterval(window.__pinT); window.__pinT = setInterval(window.__pin, 50); return aids; }, hid);
  await page.waitForFunction((ids) => ids.every(a => window.rimtownApp.tileMap._agentMeshes[a]?.visible === false), ids, { timeout: 20000 }).catch(() => {});
  const farA = await page.evaluate((ids) => ids.map(a => window.rimtownApp.tileMap._agentMeshes[a]?.visible), ids);
  ok(farA.every(v => v === false), '拉遠時屋裡的人看不到（被屋頂擋住）', farA);
  await cam(hid, 14);
  // 等到大家走到位子上（畫面很忙時幀率低，不能用固定秒數）
  await page.waitForFunction((ids) => { const tm = window.rimtownApp.tileMap; const ms = ids.map(a => tm._agentMeshes[a]); return tm._cutOn && ms[0]?.rotation.x < -1.2 && ms[1]?.rotation.x < -1.2 && ms[2]?.userData.inIcon === '🍲'; }, ids, { timeout: 30000, polling: 200 }).catch(() => {});
  await page.waitForTimeout(500);
  const near = await page.evaluate(({ ids, hid }) => { const tm = window.rimtownApp.tileMap; const S = tm._inSpots[hid];
    const ms = ids.map(a => tm._agentMeshes[a]); const bed = (m) => S.sleep.some(b => Math.hypot(b.x - m.position.x, b.z - m.position.z) < 0.15);
    const seat = (m) => [...S.eat, ...S.sit].some(b => Math.hypot(b.x - m.position.x, b.z - m.position.z) < 0.15);
    const tags = ids.map(a => tm._ovPool.get('ag:' + a)?.innerHTML || '');
    return { on: !!tm._cutOn, ext: tm._bExt.visible, cut: tm._bCut.visible, vis: ms.map(m => m.visible), lie: ms.slice(0, 2).map(m => +m.rotation.x.toFixed(2)), onBed: ms.slice(0, 2).map(bed), y: ms.map(m => +m.position.y.toFixed(2)), seat: seat(ms[2]), legs: ms[2].children.find(c => c.name === 'legL')?.rotation.x, cutMeshes: tm._bCut.children.length, icon: ms[2].userData.inIcon, tags }; }, { ids, hid });
  ok(near.on && !near.ext && near.cut, '拉近時屋頂與外牆換成剖面', near);
  ok(near.vis.every(Boolean), '拉近時屋裡的人看得到', near.vis);
  ok(near.lie.every(x => x < -1.2) && near.onBed.every(Boolean) && near.y[0] > 0.6, '睡覺的人躺在床上（不是躺在地上）', near);
  ok(near.seat && near.legs < -1.2 && near.y[2] < 0.28, '吃飯的人坐到餐桌旁的椅子上', near);
  ok(near.icon === '🍲', '名牌旁顯示在做什麼（🍲；有表情時表情優先）', [near.icon, near.tags[2]]);
  ok(near.cutMeshes <= 6, `剖面合併後只多幾次繪製（${near.cutMeshes} 個網格）`, near.cutMeshes);
  ok(near.tags[0].includes('z z z'), '睡覺的人名牌有 z z z', near.tags[0]);
  // 4) 再拉遠：屋頂回來、人又被擋住
  await cam(hid, 50); await page.waitForFunction((ids) => !window.rimtownApp.tileMap._cutOn && ids.every(a => window.rimtownApp.tileMap._agentMeshes[a]?.visible === false), ids, { timeout: 20000 }).catch(() => {});
  const back = await page.evaluate((ids) => { const tm = window.rimtownApp.tileMap; return { on: !!tm._cutOn, ext: tm._bExt.visible, vis: ids.map(a => tm._agentMeshes[a]?.visible), inP: ids.map(a => !!tm._agentMeshes[a]?.userData.inP) }; }, ids);
  ok(!back.on && back.ext && back.vis.every(v => v === false) && back.inP.every(v => !v), '拉遠後屋頂回來、屋裡的人又被擋住', back);
  // 5) 門檻附近不會一直閃（有緩衝）
  const flick = await page.evaluate(async () => { const tm = window.rimtownApp.tileMap; let n = 0, last = tm._cutOn; clearInterval(window.__camT); for (const d of [23.5, 25, 26, 25, 24.5, 26.5, 25]) { tm.dist = d; const f0 = tm.animFrame; await new Promise(r => { const t0 = Date.now(); const w = () => (tm.animFrame > f0 + 1 || Date.now() - t0 > 3000) ? r() : setTimeout(w, 30); w(); }); if (tm._cutOn !== last) { n++; last = tm._cutOn; } } return n; });
  ok(flick <= 1, '在切換門檻附近來回縮放不會一直閃', flick);
  await page.evaluate(() => { clearInterval(window.__pinT); clearInterval(window.__camT); const tm = window.rimtownApp.tileMap; if (tm.__upd) tm.updateAgents = tm.__upd; });
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(b, 'zh', { width: 1280, height: 800 }); await run(b, 'en', { width: 390, height: 844 }); } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
