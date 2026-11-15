// v10.2.0 一個帳號同一時間只留一台裝置＋載入加速
// A. 伺服器（真的 api/*.js，資料庫換成記憶體版）：後登入的把先登入的換掉；被換掉的那台存檔、讀檔、設定、成就、AI 都拿到 401 session_replaced；
//    還沒重新登入過的舊憑證照常可用；重設密碼會把所有裝置登出；/api/chat 的短快取不會誤判剛登入的新憑證
// B. 遊戲頁：開頭先發的請求被接手、不重發；本機副本是最新的就不下載雲端存檔；雲端被別台動過就以雲端為準；
//    被換掉時顯示說明、停止存檔、只能回首頁（中文、英文、手機、電腦）；開機時就被換掉也一樣
// C. 讀檔快篩：乾淨的存檔不逐字串檢查，有問題的照樣清掉
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const path = require('path'); const Module = require('module');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const fakeJwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- A. 伺服器 ----------
async function serverTest() {
  console.log('伺服器：一個帳號同一時間只留一台裝置');
  process.env.JWT_SECRET = 'test-secret-not-a-real-key'; process.env.DATABASE_URL = 'memory'; process.env.INVITE_REQUIRED = '0';
  process.env.GROQ_API_KEY = 'placeholder-for-test'; // /api/chat 要先有 AI 設定才會走到登入檢查;下面把對外連線整個擋掉,不會真的呼叫
  const realFetch = global.fetch; let outbound = 0; global.fetch = async () => { outbound++; throw new Error('測試不對外連線'); };
  const db = new Map(); let reads = 0;
  // 記憶體版資料庫:只認 _lib.js 用到的五種查詢
  const sql = async (strings, ...v) => { const q = strings.join('?').replace(/\s+/g, ' ');
    if (q.startsWith('CREATE TABLE')) return [];
    if (q.startsWith('SELECT value')) { reads++; return db.has(v[0]) ? [{ value: db.get(v[0]) }] : []; }
    if (q.startsWith('INSERT INTO')) { db.set(v[0], v[1]); return []; }
    if (q.startsWith('DELETE')) { db.delete(v[0]); return []; }
    if (q.startsWith('SELECT path')) { const pre = String(v[0]).replace(/\\([\\%_])/g, '$1').replace(/%$/, ''); return [...db.keys()].filter(k => k.startsWith(pre)).map(p => ({ path: p })); }
    throw new Error('unexpected sql: ' + q); };
  const origLoad = Module._load; Module._load = function (req, ...a) { if (req === '@neondatabase/serverless') return { neon: () => sql }; return origLoad.call(this, req, ...a); };
  const api = (f) => require(path.resolve(__dirname, '../api/' + f)); let ipN = 0;
  const call = async (file, { method = 'GET', body, token, query } = {}) => { let out = null; const res = { status: (c) => ({ json: (j) => { out = { c, j }; return out; } }) };
    const ip = '10.0.' + ((++ipN >> 8) & 255) + '.' + (ipN & 255); // 每次換一個來源,不被登入限流擋到
    await api(file)({ method, body, query: query || {}, headers: token ? { authorization: 'Bearer ' + token, 'x-forwarded-for': ip } : { 'x-forwarded-for': ip } }, res); return out; };
  const reg = await call('register.js', { method: 'POST', body: { username: 'alice', password: 'secret1', email: 'a@example.com' } });
  const t0 = reg.j.nonce; const sidOf = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sid;
  ok(reg.c === 200 && !!sidOf(t0), '註冊拿到的憑證帶著這次登入的編號', reg);
  const save = (token, tick) => call('save.js', { method: 'POST', token, body: { town_id: 't1', town_name: '測試鎮', save_data: JSON.stringify({ tickCount: tick }), tick_count: tick } });
  ok((await save(t0, 10)).c === 200, '註冊的那台可以存檔');
  const A = (await call('login.js', { method: 'POST', body: { username: 'alice', password: 'secret1' } })).j.nonce;
  ok(!!A && sidOf(A) !== sidOf(t0), '重新登入換一個新的編號', [sidOf(t0), sidOf(A)]);
  const r0 = await save(t0, 11);
  ok(r0.c === 401 && r0.j.code === 'session_replaced', '先前那張憑證存檔被拒（401 session_replaced）', r0);
  ok((await save(A, 12)).c === 200 && JSON.parse(db.get('saves/alice/t1.json')).tick_count === 12, '新登入的這台可以存檔，雲端是它寫的進度');
  const B = (await call('login.js', { method: 'POST', body: { username: 'alice', password: 'secret1' } })).j.nonce;
  const each = async (token) => ({ save: (await save(token, 20)).j, saves: await call('saves.js', { token }), load: await call('save/[town_id].js', { token, query: { town_id: 't1' } }), set: await call('settings.js', { token }), setP: await call('settings.js', { method: 'POST', token, body: { dialogue_lang: 'zh' } }), ach: await call('achievements.js', { token }), achP: await call('achievements.js', { method: 'POST', token, body: { key: 'x1' } }), lb: await call('leaderboard.js', { method: 'POST', token, body: { town_name: 'x' } }), del: null, me: await call('me.js', { token }), chat: await call('chat.js', { method: 'POST', token, body: { prompt: 'hi' } }) });
  const ra = await each(A);
  const kicked = ['saves', 'load', 'set', 'setP', 'ach', 'achP', 'lb', 'chat'].filter(k => !(ra[k].c === 401 && ra[k].j.code === 'session_replaced'));
  ok(ra.save.code === 'session_replaced' && kicked.length === 0, '第二台登入後，第一台的存檔、存檔清單、讀檔、設定、成就、排行榜、AI 全部被拒', { save: ra.save, notKicked: kicked.map(k => [k, ra[k].c, ra[k].j.code]) });
  ok(ra.me.c === 200 && ra.me.j.logged_in === false && ra.me.j.replaced === true, '第一台問 /api/me 得到「已被換掉」（跟被停用分得開）', ra.me);
  ok(JSON.parse(db.get('saves/alice/t1.json')).tick_count === 12, '被換掉的那台沒有改到雲端存檔', db.get('saves/alice/t1.json').slice(0, 80));
  const rb = await each(B);
  ok(rb.save.success === true && rb.saves.c === 200 && rb.load.c === 200 && rb.set.c === 200 && rb.ach.c === 200 && rb.me.j.logged_in === true && rb.chat.j.code !== 'session_replaced', '第二台一切正常', { save: rb.save, me: rb.me.j, chat: rb.chat.j.code });
  const delA = await call('save/[town_id].js', { method: 'DELETE', token: A, query: { town_id: 't1' } });
  ok(delA.c === 401 && db.has('saves/alice/t1.json'), '被換掉的那台不能刪雲端存檔', delA);
  // /api/chat 的短快取:剛剛用 B 確認過;這時又登入一台 C,C 的第一個請求不能被舊快取誤判,B 則要被擋
  const C = (await call('login.js', { method: 'POST', body: { username: 'alice', password: 'secret1' } })).j.nonce;
  const cc = await call('chat.js', { method: 'POST', token: C, body: { prompt: 'hi' } }), cb = await call('chat.js', { method: 'POST', token: B, body: { prompt: 'hi' } });
  ok(cc.j.code !== 'session_replaced' && cb.c === 401 && cb.j.code === 'session_replaced', 'AI 端點的短快取不會把剛登入的新裝置誤判成被換掉，舊的那台照樣被擋', { c: cc.j.code, b: [cb.c, cb.j.code] });
  // 還沒重新登入過的舊憑證(帳號紀錄上沒有編號)照常可用;有人重新登入後才失效
  const L = api('_lib.js'); const legacyUser = { id: 7, username: 'bob', email: 'b@example.com', salt: 's', passHash: L.hashPassword('secret2', 's') };
  db.set('users/bob.json', JSON.stringify(legacyUser)); const legacy = L.makeToken(legacyUser);
  ok(sidOf(legacy) === undefined && (await call('saves.js', { token: legacy })).c === 200 && (await call('me.js', { token: legacy })).j.logged_in === true, '這個功能上線前發出的憑證照常可用（還沒有人重新登入）');
  const bob2 = (await call('login.js', { method: 'POST', body: { username: 'bob', password: 'secret2' } })).j.nonce;
  const lg = await call('saves.js', { token: legacy });
  ok(lg.c === 401 && lg.j.code === 'session_replaced' && (await call('saves.js', { token: bob2 })).c === 200, '帳號重新登入後，舊憑證失效、新的可用', lg);
  const rp = await call('reset-password.js', { method: 'POST', body: { username: 'bob', email: 'b@example.com', new_password: 'secret3' } });
  const afterReset = await call('saves.js', { token: bob2 });
  ok(rp.c === 200 && afterReset.c === 401 && afterReset.j.code === 'session_replaced', '重設密碼後，先前登入的裝置全部登出', [rp, afterReset]);
  const bob3 = (await call('login.js', { method: 'POST', body: { username: 'bob', password: 'secret3' } })).j.nonce;
  ok((await call('saves.js', { token: bob3 })).c === 200, '用新密碼登入的裝置可用');
  const wrong = await call('login.js', { method: 'POST', body: { username: 'bob', password: 'wrong' } });
  ok((await call('saves.js', {})).j.code === 'unauthorized' && wrong.c === 401 && (await call('saves.js', { token: bob3 })).c === 200, '沒帶憑證仍是 unauthorized；有人拿錯的密碼試登入，不會把現有的登入換掉', wrong);
  // 資料庫讀不到時不把人踢掉
  const realGet = db.get.bind(db); db.get = (k) => { if (String(k).startsWith('users/')) throw new Error('db down'); return realGet(k); };
  const st = await L.sessionState({ u: 'bob', sid: 'whatever' }); db.get = realGet;
  ok(st === 'ok', '帳號紀錄暫時讀不到（資料庫故障）時不把人登出', st);
  const tokens = [t0, A, B, C, legacy, bob2, bob3]; const leaked = [...db.values()].some(v => tokens.some(tk => v.includes(tk)) || v.includes('test-secret'));
  ok(!leaked && !JSON.stringify(ra).includes('test-secret'), '資料庫與回應裡沒有憑證或密鑰');
  ok(outbound >= 1, '（測試確認：有效的那台有走到呼叫 AI 的那一步，被換掉的那台在那之前就被擋）', outbound);
  Module._load = origLoad; global.fetch = realFetch; delete process.env.GROQ_API_KEY;
}

// ---------- B. 遊戲頁 ----------
async function newCtx(browser, dev, lang, S) {
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  await ctx.route('**/api/**', async r => { const u = new URL(r.request().url()).pathname.replace(/^.*\/api\//, ''); const m = r.request().method(); S.log.push({ k: m + ' ' + u, at: Date.now() });
    const J = (o, c = 200) => r.fulfill({ status: c, contentType: 'application/json', body: JSON.stringify(o) });
    if (S.replaced) { if (u === 'me') return J({ logged_in: false, replaced: true }); return J({ code: 'session_replaced', message: '這個帳號已在另一台裝置登入' }, 401); }
    if (u === 'settings') { await sleep(120); return J(m === 'GET' ? { settings: null } : { success: true }); }
    if (u === 'saves') { await sleep(150); return J({ saves: S.cloud ? [{ town_id: 't1', town_name: '測試鎮', tick_count: S.cloudTick, updated_at: '2026-11-15 00:00:00' }] : [] }); }
    if (u === 'save/t1') { await sleep(200); return S.cloud ? J({ save_data: S.cloud }) : J({ code: 'not_found' }, 404); }
    if (u === 'save') { let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {} S.posts.push({ id: b.town_id, tick: b.tick_count }); if (b.town_id === 't1' && Number.isFinite(b.tick_count) && typeof b.save_data === 'string' && !b.save_data.startsWith('gz:')) { S.cloud = b.save_data; S.cloudTick = b.tick_count; } return J({ success: true }); }
    if (u === 'me') return J({ logged_in: true, user: { id: 1, username: 'tester' } });
    return J({ achievements: {}, entries: [], reply: '' }); });
  await ctx.addInitScript(({ jwt, lang }) => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); if (!localStorage.getItem('__kept')) { localStorage.setItem('__kept', '1'); localStorage.setItem('rimtown_jwt', jwt); } }
    localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1');
    window.__dclAt = 0; document.addEventListener('DOMContentLoaded', () => { window.__dclAt = Date.now(); }); }, { jwt: fakeJwt, lang });
  return ctx;
}
const open = async (ctx, S, wait = true) => { S.log.length = 0; S.posts.length = 0; const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.__errs = errs;
  await page.goto(BASE + 'town.html', { timeout: 90000 }); if (wait) { await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.evaluate(() => { const a = window.rimtownApp; a._setPaused?.(true); clearInterval(a.simInterval); a.simInterval = null; a._showSeasonRecap = () => {}; a._gameAlert = () => {}; }); } return page; };
const count = (S, k) => S.log.filter(x => x.k === k).length;

async function clientTest(browser, dev, lang) {
  console.log(`遊戲頁 ${dev} ${lang}`);
  const S = { log: [], posts: [], cloud: null, cloudTick: 0, replaced: false };
  // 先做一份真的存檔當雲端存檔
  { const c0 = await newCtx(browser, dev, lang, S); const p0 = await open(c0, S); const fx = await p0.evaluate(() => { const w = window.rimtownApp.world; w.tickCount = 500; const d = w.serialize(); return { str: JSON.stringify(d), tick: d.tickCount }; }); S.cloud = fx.str; S.cloudTick = fx.tick; await c0.close(); }
  const T0 = S.cloudTick; const ctx = await newCtx(browser, dev, lang, S);
  // 1) 本機沒有副本:下載雲端;開頭先發的請求被接手,不重發
  let page = await open(ctx, S);
  let st = await page.evaluate(() => ({ town: window.rimtownApp.currentTownId, tick: window.rimtownApp.world.tickCount, synced: localStorage.getItem('rimtown_synced_t1'), dcl: window.__dclAt, boot: !!window.__rtBoot, left: Object.keys(window.__rtBoot?.req || {}) }));
  const early = ['GET settings', 'GET saves', 'GET save/t1'].map(k => S.log.find(x => x.k === k)?.at);
  ok(count(S, 'GET settings') === 1 && count(S, 'GET saves') === 1 && count(S, 'GET save/t1') === 1 && st.left.length === 0, '設定、存檔清單、存檔各只請求一次（開頭先發的被接手，沒有重發）', { n: [count(S, 'GET settings'), count(S, 'GET saves'), count(S, 'GET save/t1')], left: st.left });
  ok(st.boot && early.every(t => t && t < st.dcl), '三個請求都在程式載完之前就發出去了', { early: early.map(t => t - st.dcl) });
  ok(st.town === 't1' && st.tick === T0 && st.synced === String(T0), '本機沒有副本：載入雲端那份，並記下同步點', st);
  await page.evaluate(() => { window.rimtownApp._saveCurrentTown(); }); await page.waitForTimeout(400);
  ok(await page.evaluate(() => localStorage.getItem('rimtown_lt_t1')) === String(T0), '寫本機副本時另外記下它的進度', null); await page.close();
  // 2) 本機副本跟雲端一樣新:不下載雲端存檔
  page = await open(ctx, S); st = await page.evaluate(() => ({ town: window.rimtownApp.currentTownId, tick: window.rimtownApp.world.tickCount }));
  ok(count(S, 'GET save/t1') === 0 && count(S, 'GET saves') === 1 && st.town === 't1' && st.tick === T0 && S.posts.length === 0, '本機副本已經是最新的：不下載雲端存檔，也不必回填', { gets: count(S, 'GET save/t1'), st, posts: S.posts });
  // 3) 本機比雲端新(同一台多玩了一段還沒上雲端):用本機的,並回填雲端
  await page.evaluate(() => { const a = window.rimtownApp; a.world.tickCount += 4; a._saveCurrentTown(); }); await page.waitForTimeout(400); await page.close();
  page = await open(ctx, S); await page.waitForTimeout(1200); st = await page.evaluate(() => ({ tick: window.rimtownApp.world.tickCount, synced: localStorage.getItem('rimtown_synced_t1') }));
  ok(count(S, 'GET save/t1') === 0 && st.tick === T0 + 4 && S.posts.some(p => p.id === 't1' && p.tick === T0 + 4) && st.synced === String(T0 + 4), '同一台多玩的那段還沒上雲端：用本機的，並回填雲端', { gets: count(S, 'GET save/t1'), st, posts: S.posts });
  await page.close();
  // 4) 雲端被別台裝置寫過(進度數字還比本機小):以雲端為準
  { const d = JSON.parse(S.cloud); d.tickCount = T0 + 1; d.townName = '別台存的'; S.cloud = JSON.stringify(d); S.cloudTick = T0 + 1; }
  page = await open(ctx, S); st = await page.evaluate(() => ({ tick: window.rimtownApp.world.tickCount, name: window.rimtownApp.world.townName, synced: localStorage.getItem('rimtown_synced_t1') }));
  ok(count(S, 'GET save/t1') === 1 && st.tick === T0 + 1 && st.name === '別台存的' && st.synced === String(T0 + 1) && !S.posts.some(p => p.tick === T0 + 4), '雲端被別台裝置寫過：以雲端為準，本機那份不會蓋回去', { gets: count(S, 'GET save/t1'), st, posts: S.posts });
  // 5) 玩到一半被後來的登入換掉
  const paused0 = await page.evaluate(() => { window.rimtownApp._setPaused?.(false); return window.rimtownApp.world.paused; });
  S.replaced = true; S.posts.length = 0;
  await page.evaluate(() => window.rimtownApp.auth.checkLogin().catch(() => {})); await page.waitForSelector('#rt-session-replaced', { timeout: 8000 });
  const k = await page.evaluate(async () => { const a = window.rimtownApp; const el = document.getElementById('rt-session-replaced'); const btn = el.querySelector('button'); const r = el.getBoundingClientRect(), b = btn.getBoundingClientRect(); const lt0 = localStorage.getItem('rimtown_lt_t1');
    await a.saveGame().catch(() => {}); a._flushSaveOnExit?.();
    return { title: el.querySelector('h2').textContent, desc: el.querySelector('p').textContent, btn: btn.textContent, jwt: localStorage.getItem('rimtown_jwt'), logged: a.auth.loggedIn, paused: a.world.paused, cover: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, btnH: Math.round(b.height), focus: document.activeElement === btn, role: el.getAttribute('role'), topEl: document.elementFromPoint(innerWidth / 2, 20)?.closest('#rt-session-replaced') ? 1 : 0, lt0, lt1: localStorage.getItem('rimtown_lt_t1'), hs: document.documentElement.scrollWidth > innerWidth + 1 }; });
  ok(lang === 'en' ? /another device/i.test(k.title) && /one device at a time/i.test(k.desc) && /home/i.test(k.btn) : k.title === '這個帳號已在另一台裝置登入' && /同一時間只能在一台裝置上玩/.test(k.desc) && k.btn === '回首頁', '被換掉時顯示說明（' + (lang === 'en' ? '英文' : '中文') + '）', k);
  ok(k.jwt === null && k.logged === false && paused0 === false && k.paused === true, '這台登出：憑證清掉、模擬停下', { jwt: k.jwt, logged: k.logged, paused0, paused: k.paused });
  ok(S.posts.length === 0 && k.lt1 === k.lt0, '之後不再寫任何存檔（雲端不送，本機副本也不動）', { posts: S.posts, lt: [k.lt0, k.lt1] });
  ok(k.cover && k.topEl === 1 && k.role === 'alertdialog' && k.focus && k.btnH >= 44 && !k.hs, '說明蓋住整個畫面、焦點在按鈕上、按鈕夠大、沒有橫向捲動', k);
  await Promise.all([page.waitForURL(u => !/town(\.html)?$/.test(new URL(u).pathname), { timeout: 90000, waitUntil: 'commit' }), page.click('#rt-sr-home')]); // 只等換頁,不等首頁整個載完(同時跑很多測試時首頁載得慢)
  ok(!/town/.test(new URL(page.url()).pathname) && page.__errs.length === 0, '按「回首頁」離開遊戲頁，沒有頁面錯誤', { url: page.url(), errs: page.__errs.slice(0, 2) }); await page.close();
  // 6) 存檔時才發現被換掉(伺服器回 401 session_replaced)
  S.replaced = false; await ctx.addInitScript((jwt) => { if (!localStorage.getItem('rimtown_jwt') && !sessionStorage.getItem('__relog')) { sessionStorage.setItem('__relog', '1'); localStorage.setItem('rimtown_jwt', jwt); } }, fakeJwt);
  page = await open(ctx, S); S.replaced = true; await page.evaluate(() => window.rimtownApp.saveGame().catch(() => {})); const shown = await page.waitForSelector('#rt-session-replaced', { timeout: 8000 }).then(() => true).catch(() => false);
  ok(shown && await page.evaluate(() => localStorage.getItem('rimtown_jwt')) === null, '存檔被伺服器拒絕時也會顯示說明並登出', shown); await page.close();
  // 7) 一開機就已經被換掉:不往下載入,直接顯示說明
  await ctx.addInitScript((jwt) => { if (!sessionStorage.getItem('__relog2')) { sessionStorage.setItem('__relog2', '1'); localStorage.setItem('rimtown_jwt', jwt); } }, fakeJwt);
  page = await open(ctx, S, false); const shown2 = await page.waitForSelector('#rt-session-replaced', { timeout: 30000 }).then(() => true).catch(() => false); await page.waitForTimeout(600);
  const b7 = await page.evaluate(() => ({ ready: !!window.rimtownApp?._initReady, loading: !!document.getElementById('town-loading') && getComputedStyle(document.getElementById('town-loading')).opacity !== '0', jwt: localStorage.getItem('rimtown_jwt') }));
  ok(shown2 && !b7.ready && !b7.loading && b7.jwt === null && count(S, 'GET save/t1') === 0 && page.__errs.length === 0, '一開機就已經被換掉：不載入小鎮，直接顯示說明（載入畫面收起）', { shown2, b7, errs: page.__errs.slice(0, 2) });
  await ctx.close();
}

// ---------- C. 讀檔快篩 ----------
async function scrubTest(browser) {
  console.log('讀檔快篩');
  const S = { log: [], posts: [], cloud: null, cloudTick: 0, replaced: false }; const ctx = await newCtx(browser, 'desktop', 'zh', S); const page = await open(ctx, S);
  const r = await page.evaluate(() => { const w = window.rimtownApp.world; const base = JSON.stringify(w.serialize()); const out = {};
    let calls = 0; const orig = World.scrubAssistantLeaks; World.scrubAssistantLeaks = function (d) { calls++; return orig.call(World, d); };
    const d1 = World.parseSave(base); out.cleanMark = d1.__rtClean === true && !Object.keys(d1).includes('__rtClean') && !JSON.stringify(d1).includes('__rtClean'); w.loadSave(d1); out.cleanCalls = calls;
    calls = 0; w.loadSave(JSON.parse(base)); out.plainCalls = calls; // 沒經過快篩的(舊路徑、匯入的檔)照樣逐字串檢查
    const dirty = JSON.parse(base); dirty.messageLog = (dirty.messageLog || []).concat([{ type: 'chat', content: "I'm Claude, an AI assistant made by Anthropic and I can't roleplay." }]); const firstAgent = Object.values(dirty.agents)[0]; firstAgent.memory = firstAgent.memory || []; const memWasArray = Array.isArray(firstAgent.memory);
    calls = 0; const d3 = World.parseSave(JSON.stringify(dirty)); out.dirtyMark = d3.__rtClean === true; w.loadSave(d3); out.dirtyCalls = calls; out.dirtyRemoved = w._scrubbedLeaks; out.leakLeft = JSON.stringify(w.serialize()).includes('made by Anthropic');
    const cn = JSON.parse(base); cn.townName = '这个小镇'; const d4 = World.parseSave(JSON.stringify(cn)); out.cnMark = d4.__rtClean === true; calls = 0; w.loadSave(d4); out.cnCalls = calls; out.cnName = w.townName;
    World.scrubAssistantLeaks = orig; w.loadSave(World.parseSave(base)); return out; });
  ok(r.cleanMark && r.cleanCalls === 0, '乾淨的存檔：快篩過關、不逐字串檢查，記號不會被存進檔案', r);
  ok(r.plainCalls === 1, '沒經過快篩的存檔照樣逐字串檢查', r.plainCalls);
  ok(!r.dirtyMark && r.dirtyCalls === 1 && r.dirtyRemoved >= 1 && !r.leakLeft, '有 AI 自報身分的句子：快篩不過，照樣清掉', r);
  ok(!r.cnMark && r.cnCalls === 1 && r.cnName === '這個小鎮', '有簡體字：快篩不過，照樣轉成繁體', r);
  ok(page.__errs.length === 0, '沒有頁面錯誤', page.__errs.slice(0, 2));
  await ctx.close();
}

(async () => {
  await serverTest();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await clientTest(browser, 'mobile', 'zh'); await clientTest(browser, 'desktop', 'en');
  await scrubTest(browser);
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
