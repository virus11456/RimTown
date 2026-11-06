// v6.76.1 本機存檔與效能:其他鎮的本機副本搬去 IndexedDB(localStorage 只留目前這座)、切鎮從 IndexedDB 讀、
// 每次存檔只序列化一次且不重複存 rimtown_save、八卦清單有上限、遠方城鎮每天只讀寫登記簿一次、壓縮走背景執行緒、
// 刪鎮連 IndexedDB 一起刪、跨鎮專欄用列表上的頭條摘要
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
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', ok: true }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const out = {};
      const lsTowns = () => { const a = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const m = /^rimtown_town_(.+)$/.exec(k || ''); if (m && m[1] !== 'list' && !m[1].endsWith('_archives')) a.push(m[1]); } return a; };
      app._cloudSaves = [];
      // 目前的鎮先存一份
      app._saveCurrentTown(); const cur = app.currentTownId; localStorage.setItem('rimtown_last_town', cur);
      // 舊版留下的三座別鎮副本(帶頭條)
      const base = w.serialize(); const mk = (name, head) => { const b = JSON.parse(JSON.stringify(base)); b.townName = name; b.worldId = 'w0'; b.dailyNews = Object.assign({}, b.dailyNews || {}, { newspapers: [{ reporter: '記者甲', year: 1, season: '夏季', day: 3, events: [{ content: head, importance: 9 }] }] }); return JSON.stringify(b); };
      const L = app._getTownList();
      for (const [id, n, h] of [['town_a', '海風鎮', '海風鎮豐收'], ['town_b', '礦山鎮', '礦坑塌方'], ['town_c', '林間村', '林間村辦祭典']]) { L.push({ id, name: n, season: '夏季', year: 1, day: 3, theme: '', origin: 'neighbor' }); localStorage.setItem('rimtown_town_' + id, mk(n, h)); }
      app._saveTownList(L);
      await app._initLocalStore();
      out.migrated = JSON.stringify(lsTowns()) === JSON.stringify([cur]) && ['town_a', 'town_b', 'town_c'].every(id => app._idbTowns.has(id));
      out.readIdb = (await app._readLocalTown('town_b'))?.townName === '礦山鎮' && app._hasLocalTown('town_b');
      const meta = app._getTownList().find(x => x.id === 'town_a'); out.summary = meta?.blobName === '海風鎮' && /豐收/.test(meta?.news?.items?.[0] || '');
      // 跨鎮專欄用摘要
      const news = app._collectCrossTownNews([{ id: 'town_a', name: '海風鎮' }, { id: 'town_c', name: '林間村' }]); out.crossNews = news.length === 2 && news.some(n => /祭典/.test(n.items[0]));
      // 切到海風鎮(從 IndexedDB 讀):原本的鎮搬去 IndexedDB,localStorage 只剩海風鎮
      await app.switchTown('town_a'); await new Promise(r => setTimeout(r, 300));
      out.switched = app.currentTownId === 'town_a' && w.townName === '海風鎮';
      out.prevStashed = app._idbTowns.has(cur) && !lsTowns().includes(cur);
      app._saveCurrentTown(); out.onlyCurrent = JSON.stringify(lsTowns()) === JSON.stringify(['town_a']);
      // 存檔只序列化一次;有城鎮 id 時不再另存 rimtown_save
      let n = 0; const _s = w.serialize; w.serialize = function () { n++; return _s.call(this); };
      await app.saveGame(); w.serialize = _s; out.serializeOnce = n === 1;
      const _li = app.auth.loggedIn; app.auth.loggedIn = false; localStorage.setItem('rimtown_save', 'x'); await app.saveGame(); app.auth.loggedIn = _li; out.noDupSlot = localStorage.getItem('rimtown_save') === null;
      // 八卦上限
      const G = w.gossipNetwork; for (let i = 0; i < 1200; i++) G.activeGossip.push({ about: 'x', content: 'g' + i }); const a0 = Object.values(w.agents).find(a => !a.isPlayer), b0 = Object.values(w.agents).filter(a => !a.isPlayer)[1];
      w.serialize(); out.gossipMem = G.activeGossip.length <= 400; // 存檔時也把記憶體裡的清單裁短
      const ser = w.serialize(); out.gossipSaved = (ser.gossip || []).length <= 300;
      const w2 = new World(); const big = JSON.parse(JSON.stringify(ser)); big.gossip = Array.from({ length: 5000 }, (_, i) => ({ about: 'a', content: 'c' + i })); w2.loadSave(big); out.gossipLoaded = w2.gossipNetwork.activeGossip.length === 300;
      // 遠方城鎮:一天只寫一次登記簿
      const seeds = Array.from({ length: 30 }, (_, i) => 500 + i * 37); localStorage.setItem(rimtownWorldKey('rimtown_gen_towns'), JSON.stringify({ v: 1, base: 'u:tester', n: 30, since: 0, seenExp: 0, days: 0, list: seeds.map(s => ({ seed: s, found: 1, via: 'rumor', by: '', r: 1, id: null, st: null })) }));
      let writes = 0; const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/rimtown_gen_towns/.test(k)) writes++; return _set.call(this, k, v); };
      app._genDayKey = 'a'; w.clock.day = (w.clock.day % 14) + 1; app._genTownTick(); Storage.prototype.setItem = _set;
      out.genWrites = writes; out.genBatched = writes <= 3 && TownGen.cards().every(c => c.state);
      // 壓縮走背景執行緒,解得回來
      const str = JSON.stringify(w.serialize()) + ' '.repeat(310000); const gz = await RTZip.pack(str); out.zip = gz.startsWith('gz:') && (await RTZip.unpack(gz)) === str && !!RTZip._wk;
      // 刪鎮:IndexedDB 一起刪
      await app._deleteLocalTown('town_b'); out.deleted = !app._idbTowns.has('town_b') && !(await app._readLocalTown('town_b')) && (await RTStore.get('town_b')) === undefined;
      return out;
    });
    ok(r.migrated, '舊版留在 localStorage 的別鎮副本搬去 IndexedDB，只留目前這座', r);
    ok(r.readIdb && r.summary, '從 IndexedDB 讀得回來；城鎮列表記下鎮名與頭條摘要', r);
    ok(r.crossNews, '跨鎮專欄用摘要，不必讀整份存檔', r);
    ok(r.switched && r.prevStashed && r.onlyCurrent, '切鎮從 IndexedDB 讀；離開的鎮搬去 IndexedDB，localStorage 只留目前這座', r);
    ok(r.serializeOnce && r.noDupSlot, '每次存檔只序列化一次；不再重複存一份 rimtown_save', r);
    ok(r.gossipMem && r.gossipSaved && r.gossipLoaded, '八卦清單有上限（存檔最多 300 則，舊存檔讀進來就裁）', r);
    ok(r.genBatched, '遠方城鎮每天只讀寫登記簿一次', r);
    ok(r.zip, '雲端壓縮走背景執行緒，解得回原文', r);
    ok(r.deleted, '刪鎮時 IndexedDB 的副本一起刪', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
