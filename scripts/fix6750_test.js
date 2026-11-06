// v6.75.0 開新遊戲＝新世界:馬車不列重複的鄰鎮(海風鎮只留進度最多的一座)、新遊戲看不到舊世界的鄰鎮與道路、
// 鄰鎮在新世界重新生成、切回舊世界一切照舊、去重不會刪掉新世界的第 1 天城鎮、雲端存檔帶世界 id、城鎮列表分組
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
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
    const bodies = [];
    await page.route('**/api/**', r => { const u = r.request().url(); if (u.includes('/api/save') && r.request().method() === 'POST') { try { bodies.push(JSON.parse(r.request().postData() || '{}')); } catch (e) {} } r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', ok: true }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); const out = {};
      const coachNames = () => { app._showCoachDialog(); const d = document.getElementById('coach-dialog'); const names = [...(d?.querySelectorAll('.coach-go') || [])].map(b => b.textContent.trim()); d?.remove(); return names; };
      const rebuild = () => { app._otherTownsAt = 0; app._visitorMailboxTick(); return (w.otherTowns || []).map(x => x.id); };
      // 舊世界(w0):兩座海風鎮(一座英文舊名、還在第 1 天;一座有進度)＋礦山鎮
      app._cloudSaves = [];
      const blob = (name) => JSON.stringify({ version: 1, townName: name });
      const L = app._getTownList();
      L.push({ id: 'town_h1', name: 'Seabreeze Harbor', season: '春季', year: 1, day: 1, theme: 'harbor', origin: 'neighbor' });
      L.push({ id: 'town_h2', name: '海風鎮', season: '秋季', year: 2, day: 5, theme: 'harbor', origin: 'neighbor' });
      L.push({ id: 'town_m', name: '礦山鎮', season: '夏季', year: 1, day: 9, theme: 'mountain', origin: 'neighbor' });
      app._saveTownList(L); for (const [id, n] of [['town_h1', 'Seabreeze Harbor'], ['town_h2', '海風鎮'], ['town_m', '礦山鎮']]) localStorage.setItem('rimtown_town_' + id, blob(n));
      localStorage.setItem('rimtown_harbor_unlocked', '1');
      out.w0 = rimtownWorldId();
      const ids0 = rebuild(); out.oneHarbor = ids0.includes('town_h2') && !ids0.includes('town_h1') && ids0.includes('town_m');
      const cn = coachNames(); out.coach = cn; out.coachOne = cn.filter(x => /海風鎮|Seabreeze/.test(x)).length === 1;
      // 舊世界的存檔先記下來,等一下切回來
      const oldId = app.currentTownId; const oldBlob = JSON.stringify(w.serialize()); const oldName = w.townName;
      // 開新遊戲
      const _c = window.confirm, _p = window.prompt; window.confirm = () => true; window.prompt = () => '邊境鎮';
      const n0 = app._getTownList().length;
      await app.createNewTown(); window.confirm = _c; window.prompt = _p;
      const nw = w.worldId; out.newWorld = /^w_/.test(nw || '') && app.currentTownId !== oldId;
      out.listKept = app._getTownList().length >= n0 + 1 && ['town_h1', 'town_h2', 'town_m'].every(id => localStorage.getItem('rimtown_town_' + id));
      out.newEntryWorld = app._getTownList().find(tw => tw.id === app.currentTownId)?.world === nw;
      out.noNeighbors = rebuild().length === 0 && coachNames().length === 0;
      out.roadSeparate = rimtownWorldKey('rimtown_harbor_unlocked') !== 'rimtown_harbor_unlocked' && localStorage.getItem('rimtown_harbor_unlocked') === '1' && app._nextLockedNeighbor()?.theme === 'harbor';
      out.genSeparate = rimtownWorldKey('rimtown_gen_towns') !== 'rimtown_gen_towns';
      // 新世界道路開通 → 生成自己的海風鎮
      localStorage.setItem(rimtownWorldKey('rimtown_harbor_unlocked'), '1'); app._neighborEnsured = {};
      await app._ensureNeighborTown('harbor');
      const nh = app._getTownList().find(tw => tw.world === nw && /海風鎮/.test(tw.name)); out.newHarbor = !!nh && ((await app._readLocalTown(nh.id)) || {}).worldId === nw; // v6.76.1 別鎮副本在 IndexedDB
      const idsN = rebuild(); out.onlyOwnHarbor = idsN.length === 1 && idsN[0] === nh?.id;
      // 雲端存檔帶世界 id
      const _fx = app.auth._fetch; let sent = null; app.auth._fetch = async (ep, m, body) => { sent = body; return { ok: true }; }; await app.auth.cloudSave(app.currentTownId, '邊境鎮', w.serialize(), {}); app.auth._fetch = _fx; out.cloudWorld = sent?.world_id === nw;
      // 城鎮列表:其他遊戲另外分組
      const box = document.createElement('div'); app._renderTownSections(box, app._townEntries(null)); out.listUi = box.innerText; out.otherGroup = box.querySelectorAll('.town-world').length >= 1;
      // 去重:舊世界的林間村有進度,新世界的林間村還在第 1 天,不能被當成孤兒刪掉
      const L2 = app._getTownList(); L2.push({ id: 'town_f0', name: '林間村', season: '秋季', year: 3, day: 2, theme: 'forest' }); L2.push({ id: 'town_f1', name: '林間村', season: '春季', year: 1, day: 1, theme: 'forest', world: nw });
      app._saveTownList(L2); localStorage.setItem('rimtown_town_town_f0', JSON.stringify({ version: 1, townName: '林間村', clock: { year: 3, season: '秋季', day: 2 } })); localStorage.setItem('rimtown_town_town_f1', JSON.stringify({ version: 1, townName: '林間村', clock: { year: 1, season: '春季', day: 1 } }));
      app._dedupeTownList(); out.dedupeSafe = !!localStorage.getItem('rimtown_town_town_f1') && app._getTownList().some(tw => tw.id === 'town_f1');
      // 存讀檔保留世界 id
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.rt = w2.worldId === nw;
      // 切回舊世界:鄰鎮又是原本的海風鎮與礦山鎮,新世界的海風鎮不會出現
      w.loadSave(JSON.parse(oldBlob)); app.currentTownId = oldId; out.backW0 = rimtownWorldId() === 'w0';
      const idsB = rebuild(); out.backNeighbors = idsB.includes('town_h2') && idsB.includes('town_m') && !idsB.includes(nh?.id);
      return out;
    });
    ok(r.oneHarbor && r.coachOne, '同一個世界裡有兩座海風鎮：馬車只列進度最多的那座', r.coach);
    ok(r.newWorld && r.newEntryWorld, '開新遊戲＝新的世界', r);
    ok(r.listKept, '原本的存檔都還在', r);
    ok(r.noNeighbors, '新遊戲看不到舊世界的鄰鎮（馬車站沒有目的地）', r);
    ok(r.roadSeparate && r.genSeparate, '道路開通與遠方城鎮登記簿依世界分開', r);
    ok(r.newHarbor && r.onlyOwnHarbor, '新世界道路開通後生成自己的海風鎮', r);
    ok(r.cloudWorld, '雲端存檔帶上世界 id', r);
    ok(r.otherGroup && (lang === 'zh' ? /其他遊戲/.test(r.listUi) && /開新遊戲/.test(r.listUi) : /Other games/.test(r.listUi) && /New game/.test(r.listUi)), '城鎮列表把其他遊戲（世界）分開列（' + lang + '）', r.listUi.slice(0, 200));
    ok(r.dedupeSafe, '去重不會刪掉新世界第 1 天的同名城鎮', r);
    ok(r.rt, '世界 id 跟著存讀檔', r);
    ok(r.backW0 && r.backNeighbors, '切回舊世界：鄰鎮照舊，看不到新世界的鎮', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
