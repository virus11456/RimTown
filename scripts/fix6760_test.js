// v6.76.0 探索過的城鎮都能搭馬車(以前超過 10 座就只剩傳聞)、封路(下雪封山、坍方、淹水、盜匪)時馬車站反灰並寫原因與天數、
// 路通了會恢復、村民出遠門避開封路的鎮、路況跟著存檔、同一個世界的重複鄰鎮在城鎮列表標出來
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
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', ok: true }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); const out = {};
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const coach = () => { app._showCoachDialog(); const d = document.getElementById('coach-dialog'); const go = [...(d?.querySelectorAll('.coach-go') || [])].map(b => b.textContent.trim()); const closed = [...(d?.querySelectorAll('.coach-closed') || [])].map(b => b.textContent.trim()); d?.remove(); return { go, closed }; };
      const logHas = (re) => (w.messageLog || []).slice(-20).some(m => re.test(m.content || ''));
      app._cloudSaves = [];
      // 鄰鎮:海風鎮(有進度)、Seabreeze Harbor(舊的重複)、礦山鎮
      const L = app._getTownList();
      L.push({ id: 'town_h1', name: 'Seabreeze Harbor', season: '春季', year: 1, day: 1, theme: 'harbor', origin: 'neighbor' });
      L.push({ id: 'town_h2', name: '海風鎮', season: '秋季', year: 2, day: 5, theme: 'harbor', origin: 'neighbor' });
      L.push({ id: 'town_m', name: '礦山鎮', season: '夏季', year: 1, day: 9, theme: 'mountain', origin: 'neighbor' });
      app._saveTownList(L); for (const [id, n] of [['town_h1', 'Seabreeze Harbor'], ['town_h2', '海風鎮'], ['town_m', '礦山鎮']]) localStorage.setItem('rimtown_town_' + id, JSON.stringify({ version: 1, townName: n }));
      // 遠方城鎮:登記簿裡以前被降成「只有傳聞」的(r:0)也要能去
      const seeds = [11, 22, 33]; localStorage.setItem(rimtownWorldKey('rimtown_gen_towns'), JSON.stringify({ v: 1, base: 'u:tester', n: 3, since: 0, seenExp: 0, list: seeds.map(s => ({ seed: s, found: 1, via: 'rumor', by: '', r: 0, id: null, st: null })) }));
      out.allReachable = TownGen.cards().length === 3 && TownGen.cards().every(c => c.reachable) && app._genReachableCards().length === 3;
      app._otherTownsAt = 0; app._visitorMailboxTick();
      const c0 = coach(); out.coach0 = c0; out.genInCoach = c0.go.length === 5; // 海風鎮、礦山鎮＋三座遠方城鎮
      // 下雪:礦山鎮(山路)封了,其他照常(亂數固定在 0.99,非山路不會因為下雪封)
      let D = 900; const _ad = w._absDay; w._absDay = () => D; app._roadDay = null; w.roadClosures = {};
      w.weather.current = 'snow'; fix(0.99, () => app._roadsTick());
      const mk = rimtownCanonTown('礦山鎮'); out.snowMountain = w.roadClosures[mk]?.why === 'snow' && !w.roadClosures['海風鎮'];
      const c1 = coach(); out.coach1 = c1; out.mountainGrey = c1.closed.length === 1 && /🚧/.test(c1.closed[0]) && c1.go.length === 4;
      out.closeLog = logHas(/封了|temporarily closed/);
      out.flags = (w.otherTowns || []).find(tw => /礦山鎮|Mine Ridge/.test(tw.name))?.closed === true && (w.otherTowns || []).find(tw => /海風鎮|Seabreeze/.test(tw.name))?.closed === false;
      // 還在下雪就繼續封
      D++; const u0 = w.roadClosures[mk].until; fix(0.99, () => app._roadsTick()); out.extend = w.roadClosures[mk].until >= D + 1 && w.roadClosures[mk].until >= u0;
      // 存讀檔保留路況
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.rt = w2.roadClosures?.[mk]?.why === 'snow';
      // 天晴後路通了
      w.weather.current = 'clear'; D += 5; fix(0.99, () => app._roadsTick()); out.reopen = !w.roadClosures[mk] && logHas(/路通了|open again/);
      // 下雨坍方
      w.weather.current = 'rain'; D++; fix(0.01, () => app._roadsTick()); out.landslide = Object.values(w.roadClosures).some(x => x.why === 'landslide');
      // 遠方城鎮封路時,城鎮列表那張卡顯示封路而不是「搭馬車前往」
      const gname = TownGen.cards()[0].name; w.roadClosures[rimtownCanonTown(gname)] = { why: 'bandits', until: D + 2, since: D };
      const box = document.createElement('div'); app._renderTownSections(box, app._townEntries(null)); out.listUi = box.innerText;
      out.genClosedUi = /盜匪攔路|bandits on the road/.test(out.listUi);
      out.dupTag = /重複的鄰鎮|Duplicate neighbor town/.test(out.listUi);
      // 村民出遠門:全部封路就不出門
      w.roadClosures = {}; for (const tw of w.otherTowns) tw.closed = true; const away0 = (w.events._travellingAgents || []).length;
      const src = String(w._visitorDaily); out.noTripCode = /otherTowns\.filter\(tw => !tw\.closed\)/.test(src);
      fix(0.01, () => w._visitorDaily()); out.noTrip = out.noTripCode && (w.events._travellingAgents || []).length === away0;
      w._absDay = _ad;
      return out;
    });
    ok(r.allReachable && r.genInCoach, '探索過的城鎮（卡片上有的）全部可以搭馬車去', r.coach0);
    ok(r.snowMountain && r.mountainGrey && r.closeLog, '下雪封山：馬車站把礦山鎮反灰並寫原因與天數，其他照常', r.coach1);
    ok(r.flags, '封路的鎮標記起來，村民出遠門會避開', r);
    ok(r.extend && r.rt, '還在下雪就繼續封；路況跟著存檔', r);
    ok(r.reopen, '天晴後路通了，有通車消息', r);
    ok(r.landslide, '下雨可能坍方封路', r);
    ok(r.genClosedUi, '遠方城鎮封路時，城鎮列表顯示封路原因', r.listUi.slice(0, 200));
    ok(r.dupTag, '同一個世界的重複鄰鎮在城鎮列表標出來', r.listUi.slice(0, 300));
    ok(r.noTrip, '全部封路時村民不出遠門', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
