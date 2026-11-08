// v7.7.1 商行東家／掌櫃／夥計(稱呼、掌櫃薪水多三成、掌櫃不天天換、公營商行、存讀檔、中英)、
// 本機存檔空間不足時整份放 IndexedDB(不瘦身)、100 人的鎮存得進本機與雲端、關頁時只序列化一次、
// 訪客模式全部拿掉(沒有訪客按鈕／橫幅／guestMode)、刪除城鎮連本機副本一起刪、首頁新段落(身體與醫療、神話基因)與數字、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const fake = (page) => page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', ok: true }) }));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await fake(page);
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const heavy = lang === 'zh' && !mob; // 100 人存檔只在一種組合跑(很慢)
    const r = await page.evaluate(async ({ heavy }) => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
      const w = app.world; w.observerMode = true; const out = {}; WALLET.S(w); MARKET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const adults = npcs().filter(a => (a.age ?? 30) >= 18);
      // 1) 商行:東家／掌櫃／夥計
      for (const a of npcs()) if (a.job?.key === 'trader') a.job = new Job('farmer');
      const [O, A, B, C] = adults; for (const x of [O, A, B, C]) x.job = new Job('trader');
      const lv = (x, n) => { x.skills.get('社交').xp = xpForLevel(n); }; lv(A, 9); lv(B, 2); lv(C, 1); // 等級由經驗值換算
      MARKET.S(w).owners.trade = O.agentId; MONEY.S(w).mgr = null; MONEY.tradeRoles(w);
      out.roles = { o: O.job.title, a: A.job.title, b: B.job.title, c: C.job.title, mult: A._wageMult, clerkMult: B._wageMult || 1, expect: [t('東家'), t('掌櫃'), t('夥計')] };
      lv(B, 15); MONEY.tradeRoles(w); out.roles.stable = A.job.title === t('掌櫃') && B.job.title === t('夥計'); // 掌櫃不會因為別人變強就換人
      // 2) 薪水:私人商行由東家發,掌櫃多三成;公營時公庫發,掌櫃一樣多三成
      WALLET.S(w).bal[O.agentId] = 5000; const a0 = WALLET.get(w, A), b0 = WALLET.get(w, B); MARKET.payroll(w, WALLET.S(w), npcs());
      out.pay = { a: Math.round((WALLET.get(w, A) - a0) * 100) / 100, b: Math.round((WALLET.get(w, B) - b0) * 100) / 100 };
      MARKET.S(w).owners.trade = null; MONEY.S(w).mgr = null; MONEY.tradeRoles(w);
      const pubMgr = [O, A, B, C].find(x => x.job.title === t('掌櫃')); const pubClerk = [O, A, B, C].find(x => x !== pubMgr);
      out.pub = { mgrs: [O, A, B, C].filter(x => x.job.title === t('掌櫃')).length, owners: [O, A, B, C].filter(x => x.job.title === t('東家')).length, net: Math.round(WALLET.netOf(WALLET.S(w), pubMgr) / Math.max(0.01, WALLET.netOf(WALLET.S(w), pubClerk)) * 100) / 100 };
      // 3) 存讀檔:讀回來稱呼、掌櫃都還在
      MARKET.S(w).owners.trade = O.agentId; MONEY.tradeRoles(w);
      const mgrId = MONEY.S(w).mgr; const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); const A2 = w2.agents[mgrId], O2 = w2.agents[O.agentId];
      out.save = { a: A2?.job?.title, o: O2?.job?.title, mult: A2?._wageMult, mgr: !!mgrId && w2.money?.mgr === mgrId };
      // 4) 本機空間不足:整份放 IndexedDB(不瘦身),localStorage 那份移掉,讀得回來
      for (const a of npcs().slice(0, 3)) while ((a.memory?.memories || a.memory || []).length < 130 && a.memory?.add) a.memory.add(w.tickCount, '08:00', 'daily', 'x' + Math.random(), 3, []);
      const key = 'rimtown_town_' + app.currentTownId; app._saveCurrentTown(); const inLs = !!localStorage.getItem(key);
      const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('rimtown_town_') && !String(k).endsWith('_list') && String(v).length > 2000) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return orig.apply(this, arguments); };
      const memBefore = Math.max(...Object.values(JSON.parse(JSON.stringify(w.serialize())).agents).map(a => (a.memory || []).length));
      app._saveCurrentTown(); await new Promise(r => setTimeout(r, 900)); Storage.prototype.setItem = orig;
      const idb = await RTStore.get(app.currentTownId); const back = await app._readLocalTown(app.currentTownId);
      out.idb = { inLs, idb: !!idb, lsGone: !localStorage.getItem(key), memKept: idb ? Math.max(...Object.values(JSON.parse(idb).agents).map(a => (a.memory || []).length)) === memBefore : false, back: back?.tickCount === w.tickCount };
      // 5) 關頁沖存檔:只序列化一次;存檔太大不送 keepalive(瀏覽器上限 64KB)
      let ser = 0; const _s = w.serialize; w.serialize = function () { ser++; return _s.apply(this, arguments); }; let posted = 0; const _f = window.fetch; window.fetch = (...a) => { posted++; return Promise.resolve(new Response('{}')); };
      app._lastExitFlushTick = -1; app._flushSaveOnExit(); w.serialize = _s; window.fetch = _f; out.flush = { ser, posted };
      // 6) 訪客模式拿掉了
      out.guest = { btn: !!document.getElementById('auth-guest-btn'), banner: !!document.getElementById('guest-banner'), mode: 'guestMode' in app, fn: typeof app._enterGuestMode, account: document.getElementById('btn-account')?.textContent || '' };
      // 7) 刪除城鎮:雲端與本機副本一起刪
      const tid = 'town_testdel'; const list = app._getTownList(); list.push({ id: tid, name: '測試鎮', savedAt: new Date().toISOString() }); app._saveTownList(list); localStorage.setItem('rimtown_town_' + tid, '{}');
      app._gameConfirm = async () => true; let cloudDel = 0; const _cd = app.auth.cloudDelete; app.auth.cloudDelete = async () => { cloudDel++; }; await app.deleteTownConfirm(tid); app.auth.cloudDelete = _cd;
      out.del = { cloudDel, ls: !!localStorage.getItem('rimtown_town_' + tid), list: app._getTownList().some(x => x.id === tid) };
      // 8) 100 人的鎮:存檔放得進 localStorage(約 5M 字),壓縮後也在雲端單次上傳上限(約 4.5MB)內
      if (heavy) {
        let g = 0; while (npcs().length < 100 && g++ < 300) w.events._spawnImmigrant(w);
        w.stockpile.resources.food = 5000; for (let i = 0; i < 96 * 5; i++) { w.paused = false; w.tick(); }
        const s = JSON.stringify(w.serialize()); let lsOk = true; try { localStorage.setItem('zz_big', s); } catch (e) { lsOk = false; } localStorage.removeItem('zz_big');
        const gz = await RTZip.pack(s); out.big = { pop: npcs().length, chars: s.length, perKB: Math.round(s.length / npcs().length / 102.4) / 10, gzChars: gz.length, lsOk };
      }
      app.state = w.getState(); return out;
    }, { heavy });
    ok(r.roles.o === r.roles.expect[0] && r.roles.a === r.roles.expect[1] && r.roles.b === r.roles.expect[2] && r.roles.c === r.roles.expect[2] && r.roles.mult === 1.3 && r.roles.clerkMult === 1, '商行：老闆是東家、手腕最好的受雇商人是掌櫃（薪水多三成）、其他是夥計', r.roles);
    ok(r.roles.stable, '掌櫃不會天天換人', r.roles);
    ok(r.pay.b > 0 && Math.abs(r.pay.a / r.pay.b - 1.3) < 0.01, '東家發薪水：掌櫃領夥計的 1.3 倍', r.pay);
    ok(r.pub.mgrs === 1 && r.pub.owners === 0 && Math.abs(r.pub.net - 1.3) < 0.02, '公營商行沒有東家：一位掌櫃，公庫發薪一樣多三成', r.pub);
    ok(r.save.o === r.roles.expect[0] && r.save.a === r.roles.expect[1] && r.save.mult === 1.3 && r.save.mgr, '存讀檔後稱呼與掌櫃都還在', r.save);
    if (lang === 'en') ok(r.roles.expect.join() === 'Owner,Manager,Clerk', '英文：Owner／Manager／Clerk', r.roles.expect);
    ok(r.idb.inLs && r.idb.idb && r.idb.lsGone && r.idb.memKept && r.idb.back, '本機空間不足：整份放進 IndexedDB（不刪記憶），讀得回來', r.idb);
    ok(r.flush.ser === 1 && r.flush.posted === 0, '關頁沖存檔只序列化一次；存檔超過 64KB 不送 keepalive', r.flush);
    ok(!r.guest.btn && !r.guest.banner && !r.guest.mode && r.guest.fn === 'undefined', '訪客模式拿掉了（沒有訪客按鈕、橫幅與 guestMode）', r.guest);
    ok(r.del.cloudDel === 1 && !r.del.ls && !r.del.list, '刪除城鎮：雲端與本機副本一起刪（不會被同步傳回去）', r.del);
    if (r.big) ok(r.big.pop >= 95 && r.big.lsOk && r.big.chars < 3500000 && r.big.gzChars < 4500000 && r.big.perKB < 50, '100 人的鎮：存檔放得進本機，壓縮後在雲端上傳上限內', r.big);
    // 10) 村民快速卡(手機):頂端不被控制列蓋住、按鈕不折行、內容多時卡片內捲動且按鈕列在底部
    if (mob) {
      const q = await page.evaluate(async () => { const app = window.rimtownApp; const w = app.world; app.state = w.getState(); const a = Object.values(w.agents).find(x => !x.isPlayer && !x.isDead); app._showNpcCard(a.agentId); await new Promise(r => setTimeout(r, 400));
        const c = document.getElementById('npc-quick-card'); const cr = c.getBoundingClientRect(); const hb = Math.max(...[...document.querySelectorAll('.mobile-header, .header')].map(e => e.getBoundingClientRect().bottom).filter(v => v > 0), 0);
        const bs = [...c.querySelectorAll('.nqc-btns button')].map(b => b.getBoundingClientRect().height); const br = c.querySelector('.nqc-btns').getBoundingClientRect(); const nm = c.querySelector('.nqc-name').getBoundingClientRect();
        return { top: Math.round(cr.top), hdr: Math.round(hb), nameTop: Math.round(nm.top), maxBtn: Math.round(Math.max(...bs)), btnsIn: br.bottom <= cr.bottom + 1, scrolls: getComputedStyle(c).overflowY }; });
      ok(q.top >= q.hdr && q.nameTop >= q.hdr && q.maxBtn <= 56 && q.btnsIn && q.scrolls === 'auto', '手機村民卡：頂端不被控制列蓋住、按鈕不折行、按鈕列固定在底部', q);
    }
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
    // 9) 首頁:新段落、數字、沒有訪客按鈕、手機不橫向捲動、英文沒有中文
    const lctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const lp = await lctx.newPage(); const lerrs = []; lp.on('pageerror', e => lerrs.push(e.message));
    await lp.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: false } : {}) }));
    await lp.addInitScript((lang) => { localStorage.setItem('rimtown-lang', lang); }, lang);
    await lp.goto(BASE, { waitUntil: 'load' }); await lp.waitForSelector('.lp-band', { timeout: 30000 });
    const L = await lp.evaluate(() => { const txt = document.querySelector('.lp')?.innerText || ''; return { bands: [...document.querySelectorAll('.lp-band')].map(e => e.id), toc: document.querySelectorAll('.lp-toc a').length, stats: txt.includes('57') && /\b6\b/.test(txt), guest: !!document.getElementById('auth-guest-btn'), hscroll: document.documentElement.scrollWidth > innerWidth + 1, cjk: (txt.replace(/中文/g, '').match(/[一-鿿]{2,}/g) || []).slice(0, 5), myth: document.querySelector('#lp-myth')?.innerText.length || 0 }; });
    ok(L.bands.includes('lp-health') && L.bands.includes('lp-myth') && L.toc === L.bands.length && L.myth > 200, '首頁新增「身體與醫療」「神話基因」兩段，目錄也有', L);
    ok(L.stats && !L.guest && !L.hscroll, '首頁數字更新（57 項科技、6 個時代）、沒有訪客按鈕、不會橫向捲動', L);
    if (lang === 'en') ok(!L.cjk.length, '英文首頁沒有中文', L.cjk);
    ok(!lerrs.length, '首頁沒有錯誤', lerrs.slice(0, 3));
    await lctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
