// v11.6.0 東家每週自己看帳（sim-boss.js；選擇點 bossWeek 登記在 sim-decide-work.js）
//   1) 登記了「東家這週看帳」，另有自己的每日額度（work 一天 6 件），全鎮的 10 件、市場的 20 件、公家的 6 件不變
//   2) 給東家看的事實跟帳目對得上：進帳、工資、賺賠、工資幾成、價錢、夥計、名額、對手的客人與價錢工資、被挖走幾個、欠薪、倉裡的貨、身上的錢
//   3) 選項照處境列：沒對手沒有調價；已經最低工資不列砍薪、最高不列加薪；人沒過剩不列裁員；名下不到三家不列掌櫃；對面那家的東家只有被挖走人才能加薪
//   4) 選了之後數字照原本的規則變（砍一成最低五成、壓 5% 最低六成、加 5% 最高 120%、降 5%／10% 最低七五折、貪心的九折、漲回 5%），日誌有寫，錢沒有憑空多出或消失
//   5) 照個性：貪心的賺錢也壓薪、心腸好的賺很多才加薪、一般的照舊；虧錢時大家都砍薪；客人被搶走時一般的降 5%、心腸好的降 10%
//   6) 問過的那一家，七天內原本的規則跳過；東家不在鎮上、決策核心沒開、舊存檔沒有這一格：照原本的規則
//   7) 公營的產業不問；一週只問一次，各行錯開在不同天；名下好幾家的問最有狀況的那一家
//   8) 裁員由東家決定：被請走的人真的沒了工作，這一行這週原本的裁員規則不再動；不裁也行
//   9) 請掌櫃由東家決定：請了誰就是誰；不請的話這週不會被自動請，那家的客人少一些
//  10) 生產的檔位：只挪「存量夠了就放慢」的門檻一成五，堆到三倍的硬上限不變；換了東家就回到照常
//  11) 存讀檔帶著；開智能體時題目送出、回答被採用、用的是 work 那一組的額度，英文題目沒有中文
//  12) 放著跑 20 天沒有錯誤，東家每週拿主意，帳上沒有對不上的錢
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8176
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8176/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Boss\]|\[Decide\]|\[Market\]|\[Compete\]/.test(x)) console.log('    console:', x.slice(0, 300)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    for (let k = 0; k < 900 && !DECIDE.on(w); k++) { w.paused = false; w.tick(); } w.paused = true; out.on = DECIDE.on(w) && !!w.market;
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000; const pct = (x) => Math.round(x * 100);
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), moved: r3(MONEY.total(w) - T0), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const K = DECIDE.KINDS.bossWeek; const X = DECIDE.S(w); const M = MARKET.S(w); const C = COMPETE.S(w);
    const seen = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && o.K.key === 'bossWeek') seen.push({ who: o.a.agentId, d: o.d, k: o.ctx?.k, rival: !!o.ctx?.rival, second: !!o.ctx?.second, other: !!o.ctx?.other, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); });
    const plain = (a) => { a._p0 = a._p0 || JSON.stringify(a.personality); a.personality.traits = []; a.personality.values = []; }; const restore = (a) => { if (a._p0) { a.personality = JSON.parse(a._p0); delete a._p0; } };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const texts = []; const ids = (a, c) => { const os = K.options(w, a, c); for (const o of os) texts.push(tx(o.text), tx(o.say || ''), tx(o.why || '')); return os.map(o => String(o.id).split(':')[0]); };
    const logs = () => (w.messageLog || []).map(m => String(m.content || '')); const newLogs = (n0) => logs().slice(n0);
    const ask = (a, c) => { const n0 = seen.length; DECIDE.enqueue(w, a, 'bossWeek', c); DECIDE.drain(w, X, day()); return seen.slice(n0).pop() || null; };
    const pick = (a, c, id) => K.options(w, a, c).find(o => String(o.id) === id || String(o.id).split(':')[0] === id);
    // ---- 布置：布莊（裁縫）有一位東家、幾個夥計；其他產業先收成公營，免得別的東家攪局 ----
    const k = 'textile', job = 'tailor'; const own0 = Object.assign({}, M.owners); const rv0 = Object.assign({}, M.rival || {});
    const pool = npcs().filter(a => (a.age ?? 30) >= 18 && a.job && !['mayor', 'tailor'].includes(a.job.key) && !MARKET.ownedBy(w, a.agentId).length && w.union?.leader !== a.agentId);
    const boss = pool.shift(), riv = pool.shift(), third = pool.shift(); for (const id of Object.keys(M.owners)) M.owners[id] = null; M.rival = {}; M.owners[k] = boss.agentId; WALLET.add(w, boss, 300);
    const here = () => npcs().filter(a => !w.isAway?.(a.agentId)); const slots = () => LABOR.slots(w, here())[job]; const tailors = () => npcs().filter(a => a.job?.key === job);
    const setTailors = (n) => { let cur = tailors(); while (cur.length > n) { const a = cur.pop(); a.job = new Job('farmer'); } cur = tailors(); while (cur.length < n) { const a = pool.find(x => x.job?.key !== job && x !== boss && x !== riv && x !== third); if (!a) break; a.job = new Job(job); cur = tailors(); } };
    const hist = (rev, cost, n = 7) => { const h = []; for (let i = 0; i < n; i++) h.push([Math.round(rev / n * 10) / 10, Math.round(cost / n * 10) / 10]); return h; };
    const c0 = () => ({ k, rival: false, d: day(), by: boss.agentId }); const cR = () => ({ k, rival: true, d: day(), by: riv.agentId });
    const reset = () => { M.pay[k] = 1; M.price = M.price || {}; M.price[k] = 1; M.unpaid[boss.agentId] = 0; M.rival = {}; M.boss = null; C.mgr = {}; for (const id of Object.keys(M.owners)) if (id !== k) M.owners[id] = null; M.owners[k] = boss.agentId; };
    const sp = w.stockpile; const setStock = (r, n) => { sp.resources[r] = n; };
    setTailors(slots()); reset();

    // 1) 登記
    out.reg = { title: K && t(K.title), scan: K?.scan, group: K?.aiGroup, kind: K?.aiKind, work: DECIDE.AI_GROUP.work, civic: DECIDE.AI_GROUP.civic, deal: DECIDE.AI_GROUP.deal, max: DECIDE.AI_MAX };

    // 2) 事實跟帳目對得上
    { reset(); M.hist[k] = hist(210, 140); M.unpaid[boss.agentId] = 2; const F = BOSS.firm(w, k, false); const want = Math.round(FLOW.want(w, 'clothing')); setStock('clothing', Math.round(want * 0.4)); const cash = Math.floor(WALLET.get(w, boss));
      const f = K.facts(w, boss, c0()); texts.push(f); const prof = Math.round(210 * 0.95 - 140);
      out.facts = { rev: F.rev, cost: F.cost, prof: F.prof, profOk: F.prof === prof, has: { rev: f.includes('210'), cost: f.includes('140'), prof: f.includes(String(prof)), pay: f.includes('100%'), staff: f.includes(String(F.staff.length)), slots: f.includes(String(F.slots)), unpaid: f.includes('2'), stock: f.includes(String(want)) && f.includes(String(Math.round(want * 0.4))), short: f.includes(t('不太夠')), cash: f.includes(String(cash)) }, noRival: !f.includes('%' + t('的客人')) && !/customers/.test(f) };
      // 有對手：客人各佔幾成、對方的價錢與工資、這週被挖走幾個
      const emp = {}; tailors().slice(0, 2).forEach(a => { emp[a.agentId] = day(); }); M.rival[k] = { fid: 'Ft', owner: riv.agentId, since: day(), price: 0.85, pay: 1.1, emp, rev: 0, cost: 0, hist: hist(120, 70), loss: 0 }; BOSS.noteHop(w, k, false); BOSS.noteHop(w, k, false);
      const s = MARKET.shareOf(w, k); const f2 = K.facts(w, boss, c0()); texts.push(f2); const fr = K.facts(w, riv, cR()); texts.push(fr);
      out.facts.rival = { share: pct(s), mine: pct(1 - s), inc: f2.includes(String(pct(s)) + '%') && f2.includes('85%') && f2.includes('110%'), lost: f2.includes(fill('這週有 {n} 個夥計被對面挖走了。', { n: 2 })), riv: fr.includes(String(pct(s)) + '%') && fr.includes('100%'), rivLost: !fr.includes(fill('這週有 {n} 個夥計被對面挖走了。', { n: 2 })) };
      setStock('clothing', want); }

    // 3) 選項照處境列
    { reset(); M.hist[k] = hist(210, 140); setStock('clothing', Math.round(FLOW.want(w, 'clothing'))); const o = {};
      o.base = ids(boss, c0()); M.pay[k] = 1.2; o.top = ids(boss, c0()); M.pay[k] = 0.6; o.floor = ids(boss, c0()); M.hist[k] = hist(100, 140); M.pay[k] = 0.5; o.losingFloor = ids(boss, c0()); M.pay[k] = 0.55; o.losing = ids(boss, c0()); M.pay[k] = 1;
      M.hist[k] = hist(210, 140, 3); o.young = ids(boss, c0()); M.hist[k] = hist(210, 140);
      const emp = {}; tailors().slice(0, 2).forEach(a => { emp[a.agentId] = day(); }); M.rival[k] = { fid: 'Ft', owner: riv.agentId, since: day(), price: 1, pay: 1, emp, rev: 0, cost: 0, hist: hist(120, 70), loss: 0 };
      o.withRival = ids(boss, c0()); M.price[k] = 0.75; o.atFloor = ids(boss, c0()); M.price[k] = 0.8; o.near = ids(boss, c0()); M.price[k] = 1;
      o.rival = ids(riv, cR()); BOSS.noteHop(w, k, true); o.rivalLost = ids(riv, cR());
      o.stale = K.options(w, boss, { k, rival: false, d: day() - 5, by: boss.agentId }).length; o.notBoss = K.options(w, third, c0()).length;
      M.rival = {}; setStock('clothing', 0); o.lowStock = ids(boss, c0()); setStock('clothing', Math.round(FLOW.want(w, 'clothing') * 2)); o.highStock = ids(boss, c0()); setStock('clothing', Math.round(FLOW.want(w, 'clothing')));
      { const f0 = sp.get('food'); M.owners.farm = boss.agentId; M.owners[k] = null; M.hist.farm = hist(210, 140); setStock('food', Math.round(FLOW.want(w, 'food') * 2)); o.farmHigh = ids(boss, { k: 'farm', rival: false, d: day(), by: boss.agentId }); setStock('food', f0); M.owners.farm = null; M.owners[k] = boss.agentId; }
      out.opts = o; }

    // 4) 選了之後數字照原本的規則變，日誌有寫，錢沒動
    { const o = {}; const runOpt = (a, c, id) => { const op = pick(a, c, id); if (!op) return { none: id }; const n0 = logs().length; const L = leak(() => op.run(w, a, c)); return { res: tx(L.ret), leak: L.leak, moved: L.moved, logs: newLogs(n0) }; };
      reset(); M.hist[k] = hist(100, 140); M.pay[k] = 1; o.cutLosing = runOpt(boss, c0(), 'cutpay'); o.cutLosing.pay = M.pay[k];
      M.pay[k] = 0.55; runOpt(boss, c0(), 'cutpay'); o.cutFloor = M.pay[k];
      M.hist[k] = hist(210, 140); M.pay[k] = 1; o.squeeze = runOpt(boss, c0(), 'cutpay'); o.squeeze.pay = M.pay[k]; M.pay[k] = 0.62; runOpt(boss, c0(), 'cutpay'); o.squeezeFloor = M.pay[k];
      M.pay[k] = 1; o.raise = runOpt(boss, c0(), 'raise'); o.raise.pay = M.pay[k]; M.pay[k] = 1.18; runOpt(boss, c0(), 'raise'); o.raiseTop = M.pay[k]; M.pay[k] = 1;
      const emp = {}; tailors().slice(0, 2).forEach(a => { emp[a.agentId] = day(); }); M.rival[k] = { fid: 'Ft', owner: riv.agentId, since: day(), price: 1, pay: 1, emp, rev: 0, cost: 0, hist: hist(120, 70), loss: 0 };
      o.down = runOpt(boss, c0(), 'down'); o.down.price = M.price[k]; o.down2 = runOpt(boss, c0(), 'down2'); o.down2.price = M.price[k]; M.price[k] = 0.78; runOpt(boss, c0(), 'down'); o.downFloor = M.price[k];
      o.up = runOpt(boss, c0(), 'up'); o.up.price = M.price[k];
      // 兩家這週都降價：價格戰（跟原本的那一句一樣）
      M.price[k] = 1; M.rival[k].price = 1; M.rival[k].warLog = -99; runOpt(boss, c0(), 'down'); const w2 = runOpt(riv, cR(), 'down'); o.war = { rivPrice: M.rival[k].price, war: w2.logs.some(x => x.includes('💥')) };
      plain(riv); riv.personality.traits = ['greedy']; M.rival[k].price = 0.95; runOpt(riv, cR(), 'down'); o.greedyFloor = M.rival[k].price; o.greedyAt = ids(riv, cR()); restore(riv);
      BOSS.noteHop(w, k, true); M.rival[k].pay = 1; o.rivRaise = runOpt(riv, cR(), 'raise'); o.rivRaise.pay = M.rival[k].pay;
      out.settle = o; reset(); }

    // 5) 照個性
    { reset(); setStock('clothing', Math.round(FLOW.want(w, 'clothing'))); const o = {}; const as = (traits, c) => steady(() => { plain(boss); boss.personality.traits = traits; try { return ask(boss, c())?.id; } finally { restore(boss); M.pay[k] = 1; M.price[k] = 1; } });
      M.hist[k] = hist(300, 140); o.plainHi = as([], c0); o.greedyHi = as(['greedy'], c0); o.kindHi = as(['kind'], c0); o.genHi = as(['generous'], c0);
      M.hist[k] = hist(100, 140); o.plainLose = as([], c0); o.kindLose = as(['kind'], c0); o.greedyLose = as(['greedy'], c0);
      M.hist[k] = hist(150, 140); o.plainMid = as([], c0);
      const emp = {}; tailors().slice(0, 2).forEach(a => { emp[a.agentId] = day(); }); M.rival[k] = { fid: 'Ft', owner: riv.agentId, since: day(), price: 0.85, pay: 1, emp, rev: 0, cost: 0, hist: hist(120, 70), loss: 0 }; o.share = MARKET.shareOf(w, k);
      o.plainRival = as([], c0); o.kindRival = as(['kind'], c0); M.price[k] = 0.9; o.greedyRival = steady(() => { plain(boss); boss.personality.traits = ['greedy']; try { return ask(boss, c0())?.id; } finally { restore(boss); } }); M.price[k] = 1;
      // 一大群人（隨機個性、照常的心情起伏）在原本規則「會動」的情況：多半會動
      M.rival = {}; M.hist[k] = hist(100, 140); let moved = 0, n = 0;
      for (const a of npcs().filter(x => (x.age ?? 30) >= 18 && inTownT(x)).slice(0, 40)) { M.owners[k] = a.agentId; M.pay[k] = 1; const e = ask(a, { k, rival: false, d: day(), by: a.agentId }); if (e) { n++; if (e.id === 'cutpay') moved++; } }
      M.owners[k] = boss.agentId; M.pay[k] = 1; o.crowdLose = { n, moved };
      M.hist[k] = hist(150, 140); let stay = 0, n2 = 0; for (const a of npcs().filter(x => (x.age ?? 30) >= 18 && inTownT(x) && !(x.personality?.traits || []).some(tr => ['greedy', 'kind', 'generous'].includes(tr))).slice(0, 40)) { M.owners[k] = a.agentId; M.pay[k] = 1; const e = ask(a, { k, rival: false, d: day(), by: a.agentId }); if (e) { n2++; if (e.id === 'keep') stay++; } }
      M.owners[k] = boss.agentId; M.pay[k] = 1; o.crowdMid = { n: n2, stay }; out.lean = o; reset(); }
    function inTownT(a) { return !!a && !a.isDead && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId); }

    // 6) 問過的跳過；沒問到的照原本的規則
    { const o = {}; const all = () => npcs(); reset(); M.hist[k] = hist(100, 140); M.pay[k] = 1; plain(boss);
      // 問過、選了照舊：原本的每週調薪這週不動這一家
      const e = steady(() => { const op = pick(boss, c0(), 'keep'); BOSS.ask(w, boss); return true; }); void e; const tk = Object.assign({}, BOSS.S(w).took[k] || {}); const pay1 = M.pay[k]; MARKET.adjust(w, all()); o.asked = { took: tk, before: pay1, after: M.pay[k], skip: BOSS.took(w, k, 'pay') };
      // 東家不在鎮上：不問，原本的規則照砍一成
      reset(); M.hist[k] = hist(100, 140); M.pay[k] = 1; const loc0 = boss.currentLocation; boss.currentLocation = 'exploration'; const n0 = seen.length; BOSS.S(w).day = null; BOSS.daily(w); o.away = { asked: seen.length - n0, took: !!BOSS.S(w).took[k] }; MARKET.adjust(w, all()); o.away.pay = M.pay[k]; boss.currentLocation = loc0;
      // 決策核心沒開：一樣照原本的規則
      reset(); M.hist[k] = hist(100, 140); M.pay[k] = 1; const on0 = DECIDE.on; DECIDE.on = () => false; const n1 = seen.length; BOSS.S(w).day = null; BOSS.daily(w); o.off = { asked: seen.length - n1 }; DECIDE.on = on0; MARKET.adjust(w, all()); o.off.pay = M.pay[k];
      // 七天過了：又回到原本的規則（除非又被問了）
      reset(); M.hist[k] = hist(100, 140); M.pay[k] = 1; BOSS.S(w).took[k] = { d: day() - 7, by: boss.agentId, pay: 1 }; o.expired = BOSS.took(w, k, 'pay'); MARKET.adjust(w, all()); o.expiredPay = M.pay[k];
      // 換了東家：前一位拿的主意不算
      reset(); BOSS.S(w).took[k] = { d: day(), by: third.agentId, pay: 1 }; o.otherBoss = BOSS.took(w, k, 'pay');
      // 舊存檔沒有這一格
      reset(); delete M.boss; M.hist[k] = hist(100, 140); M.pay[k] = 1; MARKET.adjust(w, all()); o.oldSave = { pay: M.pay[k], boss: typeof M.boss };
      // 價錢：問過的那一家，兩家搶生意的每週調價跳過；沒問過的對面那家照原本的規則降
      reset(); M.hist[k] = hist(210, 140); const emp = {}; tailors().slice(0, 2).forEach(a => { emp[a.agentId] = day(); }); M.rival[k] = { fid: 'Ft', owner: riv.agentId, since: day(), price: 1, pay: 1, emp, rev: 0, cost: 0, hist: hist(160, 70), loss: 0 }; WALLET.add(w, riv, 200);
      const sh = MARKET.shareOf(w, k); M.price[k] = 1; BOSS.S(w).took[k] = { d: day(), by: boss.agentId, price: 1, pay: 1 }; COMPETE.weekly(w, all(), day()); o.price = { share: Math.round(sh * 100) / 100, inc: M.price[k] };
      BOSS.S(w).took = {}; M.price[k] = 1; if (M.rival[k]) M.rival[k].price = 1; COMPETE.weekly(w, all(), day()); o.price.incRule = M.price[k];
      restore(boss); out.skip = o; reset(); }

    // 7) 公營不問；一週一次、錯開；名下好幾家問最有狀況的那一家
    { const o = {}; reset(); const ab0 = w._absDay; const d0 = day(); const B = BOSS.S(w); B.last = {}; B.took = {};
      // 三位東家：布莊、木作坊（同一個人也有礦場）、對面那家（晚三天）
      M.owners.timber = third.agentId; M.owners.mine = third.agentId; M.hist.timber = hist(200, 100); M.hist.mine = hist(60, 140);
      const emp = {}; tailors().slice(0, 1).forEach(a => { emp[a.agentId] = d0; }); M.rival[k] = { fid: 'Ft', owner: riv.agentId, since: d0, price: 1, pay: 1, emp, rev: 0, cost: 0, hist: hist(120, 70), loss: 0 };
      o.slots = { boss: BOSS.slotOf(w, boss.agentId), third: BOSS.slotOf(w, third.agentId), riv: BOSS.slotOf(w, riv.agentId) }; o.focus = BOSS.focusOf(w, third)?.k;
      const n0 = seen.length; const got = []; try { for (let i = 0; i < 14; i++) { w._absDay = () => d0 + i; B.day = null; BOSS.daily(w); } } finally { w._absDay = ab0; }
      o.all = seen.slice(n0).length; o.seconds = seen.slice(n0).filter(e => e.second).length; for (const e of seen.slice(n0).filter(e => !e.second)) got.push([e.who === boss.agentId ? 'boss' : e.who === third.agentId ? 'third' : e.who === riv.agentId ? 'riv' : 'other', e.d - d0, e.k]);
      o.got = got; o.public = got.filter(x => x[0] === 'other').length; o.per = { boss: got.filter(x => x[0] === 'boss').length, third: got.filter(x => x[0] === 'third').length, riv: got.filter(x => x[0] === 'riv').length };
      o.gaps = ['boss', 'third', 'riv'].map(nm => { const ds = got.filter(x => x[0] === nm).map(x => x[1]); return ds.length === 2 ? ds[1] - ds[0] : -1; }); o.days = [...new Set(got.map(x => (x[1] + d0) % 7))].length;
      o.thirdK = got.filter(x => x[0] === 'third').map(x => x[2]);
      // 公營（沒有東家）的那一行：沒有人被問
      o.publicSectors = Object.keys(MARKET.SECTORS).filter(s => !MARKET.ownerOf(w, s)); out.week = o; reset(); }

    // 8) 裁員由東家決定
    { const o = {}; reset(); M.hist[k] = hist(210, 140); const sl = slots(); setTailors(sl + 4); const L = LABOR.S(w); const B = BOSS.S(w); B.cut = { wk: -1, n: 0 };
      const F = BOSS.firm(w, k, false); o.over = BOSS.overstaffed(F); const cand = BOSS.firable(w, F); o.cand = cand.map(a => a.agentId); o.ids = ids(boss, c0()); const opt = K.options(w, boss, c0()).filter(x => String(x.id).startsWith('fire:'));
      o.optNames = opt.map(x => tx(x.text)).every((s, i) => s.includes(tx(cand[i].name))); const sk = (a) => LABOR.skillOf(a, job) * (typeof HEALTH !== 'undefined' ? HEALTH.jobFit(a, job) : 1); o.least = cand.length && F.staff.every(a => sk(a) >= sk(cand[0]) - 1e-9);
      const x = cand[0]; const laid0 = L.stats.laidOff; const n0 = logs().length; const Lk = leak(() => opt[0].run(w, boss, c0())); o.fired = { job: x.job, jobless: L.jobless[x.agentId] === day(), laid: L.stats.laidOff - laid0, unemployed: LABOR.unemployed(w).includes(x), log: newLogs(n0).some(s => s.includes('📉')), leak: Lk.leak, cut: BOSS.cutsThisWeek(w) };
      // 這一行這週東家拿過主意：原本的每週裁員不再動這一行
      B.took[k] = { d: day(), by: boss.agentId, cut: 1 }; const before = tailors().map(a => a.agentId); L.lastWeek = null; const n1 = logs().length; LABOR.weekly(w); const lg = newLogs(n1); const jt = t(JOB_DEFINITIONS[job].title);
      o.rule = { tookCut: lg.filter(s => s.includes('📉') && s.includes(jt)).length };
      // 對照：沒問過的時候，原本的規則會裁這一行
      setTailors(sl + 4); B.took = {}; B.cut = { wk: -1, n: 0 }; L.lastWeek = null; const n2 = logs().length; LABOR.weekly(w); o.rule.noTook = newLogs(n2).filter(s => s.includes('📉') && s.includes(jt)).length;
      // 不裁也行：選照舊就沒人被裁；一週最多 2 人（東家裁的也算）
      setTailors(sl + 4); B.cut = { wk: Math.floor(day() / 7), n: 2 }; o.capped = ids(boss, c0()).includes('fire'); B.cut = { wk: -1, n: 0 };
      plain(boss); boss.personality.traits = ['kind', 'generous']; const nT = tailors().length; o.kindPick = steady(() => ask(boss, c0())?.id); o.kindKept = tailors().length === nT; plain(boss); o.plainPick = steady(() => ask(boss, c0())?.id); restore(boss);
      setTailors(sl); out.fire = o; reset(); }

    // 9) 請掌櫃由東家決定
    { const o = {}; reset(); M.hist[k] = hist(60, 40); M.owners.timber = boss.agentId; M.owners.mine = boss.agentId; M.hist.timber = hist(300, 100); M.hist.mine = hist(250, 100); C.mgr = {};
      const need = BOSS.needMgr(w, boss.agentId).map(f => f.k); o.need = need; o.focus = BOSS.focusOf(w, boss)?.k; const cc = { k, rival: false, d: day(), by: boss.agentId }; o.ids = ids(boss, cc);
      const hires = K.options(w, boss, cc).filter(x => String(x.id).startsWith('hire:')); const best = hires[0]; const mid = best ? String(best.id).split(':').slice(1).join(':') : null;
      if (best) { const L = leak(() => best.run(w, boss, cc)); o.hired = { mgr: C.mgr[k], want: mid, leak: L.leak }; COMPETE.manage(w, npcs(), day()); o.hired.after = C.mgr[k]; }
      // 自己硬撐：問過之後這週 manage 不替他自動請，那一家的客人少一些（對面有店時看得出來）
      C.mgr = {}; BOSS.S(w).took = {}; const qa = MARKET.quality(w, k, boss.agentId, 3); const selfOp = K.options(w, boss, cc).find(x => x.id === 'self'); BOSS.S(w).took[k] = { d: day(), by: boss.agentId, mgr: 1 }; if (selfOp) selfOp.run(w, boss, cc); C.mgr = {};
      COMPETE.manage(w, npcs(), day()); o.self = { took: BOSS.S(w).took[k]?.mgr, selfRun: BOSS.selfRun(w, k), mgr: C.mgr[k] || null, q0: qa, q1: MARKET.quality(w, k, boss.agentId, 3) };
      // 對照：沒問過就照原本自動請社交最好的夥計
      BOSS.S(w).took = {}; C.mgr = {}; COMPETE.manage(w, npcs(), day()); o.rule = C.mgr[k] || null;
      // 名下不到三家：沒有掌櫃的選項
      M.owners.mine = null; C.mgr = {}; o.two = ids(boss, cc).some(x => x === 'hire' || x === 'self');
      out.mgr = o; reset(); }

    // 10) 生產的檔位
    { const o = {}; reset(); const r = 'clothing'; const T = FLOW.want(w, r); const B = BOSS.S(w);
      const dm = (v) => { if (v === 'usual') delete B.stock[k]; else B.stock[k] = { v, by: boss.agentId, d: day() }; return Math.round(FLOW.demandMult(w, r) * 1000) / 1000; };
      setStock(r, Math.round(T * 0.95)); o.mid = { usual: dm('usual'), more: dm('more'), less: dm('less') };
      setStock(r, Math.round(T * 0.4)); o.low = { usual: dm('usual'), more: dm('more'), less: dm('less') };
      setStock(r, Math.round(T * 3.1)); o.cap = { usual: dm('usual'), more: dm('more'), less: dm('less') };
      setStock(r, Math.round(T * 0.95)); dm('more'); M.owners[k] = third.agentId; o.newOwner = dm('more'); o.newOwnerStance = BOSS.stanceOf(w, k); M.owners[k] = boss.agentId;
      // 選了「多做一點」：日誌有寫，檔位記下來
      delete B.stock[k]; const op = pick(boss, c0(), 'more'); const n0 = logs().length; if (op) op.run(w, boss, c0()); o.chose = { stance: BOSS.stanceOf(w, k), log: newLogs(n0).some(s => s.includes('📦')), job: Math.round(FLOW.jobDemand(w, job) * 1000) / 1000 };
      delete B.stock[k]; setStock(r, Math.round(T)); out.stock = o; reset(); }

    // 11a) 存讀檔
    { const o = {}; reset(); const B = BOSS.S(w); B.stock[k] = { v: 'less', by: boss.agentId, d: day() }; B.took[k] = { d: day(), by: boss.agentId, pay: 1 }; B.last[boss.agentId] = day(); B.next[boss.agentId] = { at: day(), ctx: { k, rival: false, by: boss.agentId, second: 1, skip: [], d0: day() } };
      const sv = JSON.parse(JSON.stringify(w.serialize())); const wB = new World(); wB.loadSave(sv); o.round = { stock: wB.market?.boss?.stock?.[k]?.v, took: wB.market?.boss?.took?.[k]?.pay, last: wB.market?.boss?.last?.[boss.agentId] === day(), next: !!wB.market?.boss?.next?.[boss.agentId] };
      const sv0 = JSON.parse(JSON.stringify(w.serialize())); delete sv0.market.boss; const wA = new World(); wA.loadSave(sv0); let err = null; try { o.old = { boss: typeof wA.market?.boss, view: !!BOSS.view(wA), f: BOSS.stockF(wA, 'clothing') }; } catch (e) { err = String(e.message); } o.oldErr = err;
      wA.reset?.(); wB.reset?.(); out.save = o; reset(); }

    // 11b) 開智能體
    { const o = {}; reset(); M.hist[k] = hist(100, 140); setStock('clothing', Math.round(FLOW.want(w, 'clothing')));
      const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; ce._askJson = async (p) => { prompts.push(String(p)); return [{ n: 1, pick: 'cutpay', why: 'model reason 77', feel: 'careful' }]; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { // 東家看帳在每天掃一輪之前：今天的額度先歸零，而且之後掃一輪時不會再歸零一次
        X.lastDay = day() - 1; X._cDay = day() - 1; X._asked = 7; X._kAsked = {}; X._gAsked = { work: 6 }; M.pay[k] = 1; const n0 = seen.length;
        BOSS.S(w).last = {}; const c = BOSS.ask(w, boss); const pending = seen.length === n0; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).pop(); const lg = (X.log[boss.agentId] || []).filter(x => x.kind === 'bossWeek').pop();
        o.ai = { ctx: !!c, pending, e, pay: M.pay[k], work: X._gAsked.work, town: X._asked, lg: lg ? { id: lg.id, ai: lg.ai, why: lg.why?.raw } : null };
        const p = prompts[0] || ''; const i0 = p.indexOf(t('【遇到的事】')); const part = i0 >= 0 ? p.slice(i0) : p;
        o.prompt = { n: prompts.length, facts: part.includes('140'), codes: /cutpay＝/.test(p) && /keep＝/.test(p), part: part.slice(0, 400), cjkPart: /[一-鿿]/.test(part), cjkAll: /[一-鿿]/.test(p), cjkSample: (p.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        w.fullAgentMode = false; app._fullAgentOn = () => false; DECIDE.daily(w); o.afterDaily = X._gAsked.work; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; reset(); }

    // 13) 一週最多兩件事、掌櫃一家一家算、交情、罷工、舊存檔的 self
    { const o = {}; const B = () => BOSS.S(w);
      // a) 同一家有兩件事（虧錢又被搶走客人）：做完第一件當場追問第二件，兩件都生效；不會再問第三次
      reset(); M.hist[k] = hist(145, 140); setStock('clothing', Math.round(FLOW.want(w, 'clothing'))); const emp = {}; tailors().slice(0, 2).forEach(a => { emp[a.agentId] = day(); }); M.rival[k] = { fid: 'Ft', owner: riv.agentId, since: day(), price: 1, pay: 1, emp, rev: 0, cost: 0, hist: hist(120, 70), loss: 0 };
      { const F = BOSS.firm(w, k, false); o.issues = BOSS.issues(w, F); const n0 = seen.length; steady(() => { plain(boss); try { B().last = {}; BOSS.ask(w, boss); } finally { restore(boss); } }); const got = seen.slice(n0).filter(e => e.who === boss.agentId);
        o.two = { n: got.length, first: got[0]?.id, second: got[1]?.id, sec: got[1]?.second, pay: M.pay[k], price: M.price[k], took: Object.assign({}, B().took[k] || {}), next: !!B().next[boss.agentId] };
        // 追問的題目、事實：拿掉剛剛那一件，開頭講剛剛決定了什麼
        const c2 = { k, rival: false, d: day(), by: boss.agentId, second: 1, skip: ['pay'], first: { k: '工資砍到行情的 {p}%', p: { p: 90 } } }; const f2 = K.facts(w, boss, c2); texts.push(f2); o.two.ids2 = ids(boss, c2); o.two.f2 = f2.startsWith(fill('你剛剛決定了：{x}。還有別的事要一起處理嗎？', { x: { k: '工資砍到行情的 {p}%', p: { p: 90 } } }).trim().slice(0, 6)) && f2.includes('90%'); }
      // b) 第一件選了照舊：不追問；沒有別的狀況：也不追問
      reset(); M.hist[k] = hist(150, 140); setStock('clothing', Math.round(FLOW.want(w, 'clothing'))); { const n0 = seen.length; steady(() => { plain(boss); try { B().last = {}; BOSS.ask(w, boss); } finally { restore(boss); } }); o.keepOnly = seen.slice(n0).filter(e => e.who === boss.agentId).map(e => e.id); }
      reset(); M.hist[k] = hist(100, 140); setStock('clothing', Math.round(FLOW.want(w, 'clothing'))); { const n0 = seen.length; steady(() => { plain(boss); try { B().last = {}; BOSS.ask(w, boss); } finally { restore(boss); } }); o.oneIssue = seen.slice(n0).filter(e => e.who === boss.agentId).map(e => e.id); }
      // c) 同一家沒有別的狀況、名下另一家虧錢（trouble ≥ 3）：第二次改問那一家，那一家也標上 took
      reset(); M.owners.timber = boss.agentId; M.hist[k] = hist(100, 160); M.hist.timber = hist(100, 140); M.pay.timber = 1; setStock('clothing', Math.round(FLOW.want(w, 'clothing'))); setStock('furniture', Math.round(FLOW.want(w, 'furniture')));
      { const n0 = seen.length; steady(() => { plain(boss); try { B().last = {}; BOSS.ask(w, boss); } finally { restore(boss); } }); const got = seen.slice(n0).filter(e => e.who === boss.agentId); o.other = { ks: got.map(e => e.k + ':' + e.id), sec: got[1]?.other, payT: M.pay.timber, payK: M.pay[k], tookT: B().took.timber?.pay }; M.owners.timber = null; }
      // d) 開智能體時的追問留到隔天：daily 一開始先送出（一週最多兩次，過期的丟掉）
      reset(); M.hist[k] = hist(100, 140); { const ab0 = w._absDay; const d0 = day(); B().took[k] = { d: d0, by: boss.agentId, pay: 1 }; B().last[boss.agentId] = d0; B().next[boss.agentId] = { at: d0, ctx: { k, rival: false, by: boss.agentId, second: 1, skip: ['stock'], first: null, d0 } }; const n0 = seen.length;
        try { w._absDay = () => d0 + 1; B().day = null; steady(() => BOSS.daily(w)); } finally { w._absDay = ab0; } const got = seen.slice(n0).filter(e => e.who === boss.agentId); o.nextDay = { n: got.length, sec: got[0]?.second, id: got[0]?.id, left: !!B().next[boss.agentId] };
        B().next[boss.agentId] = { at: d0 - 5, ctx: { k, rival: false, by: boss.agentId, second: 1, skip: [], d0: d0 - 9 } }; const n1 = seen.length; B().day = null; BOSS.daily(w); o.nextDay.stale = seen.slice(n1).filter(e => e.who === boss.agentId).length; }
      // e) 掌櫃一家一家算：名下四家、兩家要掌櫃；只被問到其中一家，另一家照原本自動請、不扣
      reset(); M.owners.timber = boss.agentId; M.owners.mine = boss.agentId; M.owners.forge = boss.agentId; M.hist[k] = hist(40, 60); M.hist.timber = hist(50, 30); M.hist.mine = hist(300, 100); M.hist.forge = hist(280, 100); C.mgr = {}; B().took = {};
      { const need = BOSS.needMgr(w, boss.agentId).map(f => f.k); o.mgr = { need }; const other = need.find(x => x !== k); B().took[k] = { d: day(), by: boss.agentId, mgr: 1 }; COMPETE.manage(w, npcs(), day());
        const hasStaff = other ? BOSS.firm(w, other, false).staff.length > 0 : false; o.mgr.asked = C.mgr[k] || null; o.mgr.other = other ? (C.mgr[other] || null) : null; o.mgr.otherStaff = hasStaff;
        o.mgr.selfK = BOSS.selfRun(w, k); o.mgr.selfOther = other ? BOSS.selfRun(w, other) : false; const q = (kk) => MARKET.quality(w, kk, boss.agentId, 3); o.mgr.qK = q(k); o.mgr.qOther = other ? q(other) : null;
        // 他這週選了別的事（砍薪）：那一家還沒有掌櫃，追問時會再問一次掌櫃
        B().took = {}; C.mgr = {}; const n0 = seen.length; steady(() => { plain(boss); try { B().last = {}; BOSS.ask(w, boss); } finally { restore(boss); } }); o.mgr.seq = seen.slice(n0).filter(e => e.who === boss.agentId).map(e => e.id.split(':')[0]); o.mgr.after = C.mgr[k] || null;
        for (const kk of ['timber', 'mine', 'forge']) M.owners[kk] = null; C.mgr = {}; }
      // f) 交情：有過節的夥計加進裁員名單、比較容易被請走；家人、好朋友比較不會；掌櫃優先找自己人
      reset(); M.hist[k] = hist(210, 140); { const sl = slots(); setTailors(sl + 5); const F = BOSS.firm(w, k, false); const L0 = BOSS.firable(w, F); const pool = F.staff.filter(x => !L0.includes(x));
        const setAff = (x, v) => { const rr = boss.relationships.getOrCreate(x.agentId, x.name); rr.affinity = v; };
        const foe = pool.find(x => BOSS.relOf(w, boss, x) !== 'fam'), kin = L0[0]; if (L0[1] && BOSS.relOf(w, boss, L0[1]) !== 'fam') setAff(L0[1], 0); o.rel = { base: L0.length };
        if (foe && kin) { setAff(foe, -50); kin._parentNames0 = kin._parentNames; kin._parentNames = [boss.name, 'x']; const L1 = BOSS.firable(w, F); o.rel.withFoe = L1.map(x => x.agentId).includes(foe.agentId) && L1.length === 3; o.rel.kin = BOSS.relOf(w, boss, kin); o.rel.foe = BOSS.relOf(w, boss, foe);
          const os = K.options(w, boss, c0()).filter(x => String(x.id).startsWith('fire:')); const tF = os.find(x => x.id === 'fire:' + foe.agentId), tK = os.find(x => x.id === 'fire:' + kin.agentId); o.rel.text = !!tF && tx(tF.text).includes(t('結過怨')) && !!tK && tx(tK.text).includes(t('家人')); texts.push(...os.map(x => tx(x.text)));
          plain(boss); o.rel.pick = steady(() => ask(boss, c0())?.id); restore(boss); o.rel.pickFoe = o.rel.pick === 'fire:' + foe.agentId;
          kin._parentNames = kin._parentNames0; setAff(foe, 0); }
        setTailors(sl); }
      reset(); M.owners.timber = boss.agentId; M.owners.mine = boss.agentId; M.hist[k] = hist(60, 40); M.hist.timber = hist(300, 100); M.hist.mine = hist(250, 100); C.mgr = {}; B().took = {};
      { const sl = slots(); setTailors(sl + 3); const F = BOSS.firm(w, k, false); const soc = (x) => x.skills?.get?.('社交')?.level || 0; const top = F.staff.slice().sort((x, y) => soc(y) - soc(x)); const rest = top.slice(2); const fam = rest.find(x => BOSS.relOf(w, boss, x) === 'fam'); const friend = fam || rest.filter(x => BOSS.relOf(w, boss, x) !== 'fam').pop(); const word = fam ? t('家人') : t('很要好'); const setAff = (x, v) => { const rr = boss.relationships.getOrCreate(x.agentId, x.name); rr.affinity = v; };
        BOSS.S(w).cut = { wk: Math.floor(day() / 7), n: 2 }; // 這一題只看掌櫃：這週已經裁滿兩人，不列裁員
        if (top.length >= 3 && friend && BOSS.relOf(w, boss, top[0]) !== 'fam' && BOSS.relOf(w, boss, top[1]) !== 'fam') { if (!fam) setAff(friend, 70); setAff(top[0], -50); setAff(top[1], 0); for (const x of rest) if (x !== friend && BOSS.relOf(w, boss, x) !== 'fam') setAff(x, 0); const picks = BOSS.mgrPicks(w, F); o.mgrRel = { incl: picks.includes(friend) && picks.length === 3 };
          const os = K.options(w, boss, { k, rival: false, d: day(), by: boss.agentId }).filter(x => String(x.id).startsWith('hire:')); o.mgrRel.text = os.some(x => x.id === 'hire:' + friend.agentId && tx(x.text).includes(word)); texts.push(...os.map(x => tx(x.text)));
          plain(boss); const e = steady(() => ask(boss, { k, rival: false, d: day(), by: boss.agentId })); restore(boss); o.mgrRel.pick = e?.id === 'hire:' + friend.agentId; o.mgrRel.got = e?.id; o.mgrRel.friend = friend.agentId; o.mgrRel.opts = K.options(w, boss, { k, rival: false, d: day(), by: boss.agentId }).map(x => x.id + '=' + (Math.round(x.base * 100) / 100)); setAff(friend, 0); setAff(top[0], 0); } else o.mgrRel = { skip: top.length };
        setTailors(sl); M.owners.timber = null; M.owners.mine = null; C.mgr = {}; }
      // g) 罷工、工會的頭頭：事實裡講一句
      reset(); M.hist[k] = hist(210, 140); { M.strike = M.strike || {}; M.strike[k] = day() + 1; const U = w.union; const u0 = U ? { on: U.on, leader: U.leader } : null; const x = tailors().find(a => a !== boss); if (U && x) { U.on = true; U.leader = x.agentId; }
        const f = K.facts(w, boss, c0()); texts.push(f); o.lab = { strike: f.includes(t('這一行的工人正在罷工。').trim()), union: !U || !x || f.includes(fill('夥計裡的{x}是工會的頭頭。', { x: x.name }).trim()) }; delete M.strike[k]; if (U && u0) { U.on = u0.on; U.leader = u0.leader; } }
      // h) 舊存檔裡以東家 id 記的 self：讀進來不出錯，也不會讓哪一家被扣
      reset(); { M.boss = { took: {}, last: {}, stock: {}, self: { [boss.agentId]: day() } }; const sv = JSON.parse(JSON.stringify(w.serialize())); const wA = new World(); let err = null; try { wA.loadSave(sv); BOSS.S(wA); o.oldSelf = { self: wA.market?.boss?.self, run: BOSS.selfRun(wA, k) }; } catch (e) { err = String(e.message); } o.oldSelfErr = err; wA.reset?.(); }
      out.more = o; reset(); }

    // 12) 放著跑 20 天（東家照原本的樣子恢復）
    { for (const [kk, v] of Object.entries(own0)) M.owners[kk] = v; M.rival = rv0; M.boss = null; const errs0 = []; const n0 = seen.length; const d0 = day();
      MM.lastT = MONEY.total(w) - MM.pend; delete (MM.days[d0] || {}).other; // 前面為了測試直接改過帳：從這裡重新起算
      for (let i = 0; i < 20; i++) { const dd = w._absDay(); try { for (let j = 0; j < 400 && w._absDay() === dd; j++) { w.paused = false; w.tick(); } } catch (e) { errs0.push(String(e.message)); } w.paused = true; await new Promise(r2 => setTimeout(r2, 0)); }
      const got = seen.slice(n0); let other = 0; for (const [kk, D] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(D.other || 0);
      const per = {}; for (const e of got.filter(e => !e.second)) (per[e.who] = per[e.who] || []).push(e.d); const sec = got.filter(e => e.second); const secOk = sec.every(e => (per[e.who] || []).some(d1 => e.d - d1 >= 0 && e.d - d1 <= 2));
      out.run = { errs: errs0.slice(0, 3), n: got.length, bosses: BOSS.bosses(w).length, picks: got.reduce((m, x) => { m[x.id.split(':')[0]] = (m[x.id.split(':')[0]] || 0) + 1; return m; }, {}), maxPer: Math.max(0, ...Object.values(per).map(v => v.length)), minGap: Math.min(99, ...Object.values(per).map(v => v.slice(1).reduce((m, x, i) => Math.min(m, x - v[i]), 99))), other: Math.round(other * 100) / 100, asks: BOSS.view(w).asks, seconds: sec.length, secOk }; }
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(0, 80);
    out.texts = texts.filter(Boolean).map(s => { try { return I18N.localizeNames ? I18N.localizeNames(s, true) : s; } catch (e) { return s; } });
    out.keys = [t('東家這週看帳'), t('照平常的量做'), t('多做一點備貨'), t('少做一點'), t('💰 {o}的{s}把工資調到原本的 {p}%。'), t('🏷️ {o}的{s}降價到原價的 {p}%，想把客人搶回來。'), t('🏷️ {o}的{s}把價錢調回原價的 {p}%。'), t('📦 {o}交代{s}這陣子多做一點，倉裡多備些貨。'), t('📦 {o}交代{s}這陣子少做一點，貨夠用就好。'), t('📦 {o}交代{s}照平常的量做。'), t('👔 {o}名下店太多，還是決定自己顧{s}，不請掌櫃。')];
    return out; });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on, `${tag} 決策核心與產業都開著`, { on: r.on });
  // 1
  ok(r.reg.title && r.reg.scan === false && r.reg.group === 'work' && r.reg.kind === 4, `${tag} 登記了「東家這週看帳」：由輪到的那一天送進來、不是每天掃，歸在 work 那一組，同一類一天最多問 AI 4 件`, r.reg);
  ok(r.reg.work === 6 && r.reg.civic === 6 && r.reg.deal === 20 && r.reg.max === 10, `${tag} work 一天 6 件，全鎮的 10 件、市場的 20 件、公家的 6 件不變`, r.reg);
  // 2
  { const F = r.facts; ok(F.profOk && Object.values(F.has).every(Boolean) && F.noRival, `${tag} 事實跟帳目對得上：進帳、工資、扣稅後賺多少、工資幾成、夥計、名額、欠薪、倉裡的貨（不太夠）、身上的錢；沒有對手時不提客人`, F);
    ok(F.rival.inc && F.rival.lost && F.rival.riv && F.rival.rivLost, `${tag} 有對手：兩邊各自看到搶到幾成客人、對方的價錢與工資；被挖走的人數只算自己這一家的`, F.rival); }
  // 3
  { const O = r.opts; const hasA = (xs, ...ys) => ys.every(y => xs.includes(y)), none = (xs, ...ys) => ys.every(y => !xs.includes(y));
    ok(hasA(O.base, 'cutpay', 'raise', 'keep') && none(O.base, 'down', 'down2', 'up', 'fire', 'hire', 'self') && O.base[O.base.length - 1] === 'keep', `${tag} 平常：砍薪、加薪、照舊；沒有對手不列調價，人沒過剩不列裁員，名下一家不列掌櫃；照舊排最後`, O.base);
    ok(none(O.top, 'raise') && hasA(O.top, 'cutpay') && none(O.floor, 'cutpay') && hasA(O.floor, 'raise'), `${tag} 已經 120% 不列加薪；賺錢時已經壓到六成不列砍薪`, { top: O.top, floor: O.floor });
    ok(none(O.losingFloor, 'cutpay', 'raise') && hasA(O.losing, 'cutpay') && none(O.losing, 'raise'), `${tag} 虧錢：壓到五成就不能再砍；虧錢時不列加薪`, { lf: O.losingFloor, l: O.losing });
    ok(none(O.young, 'cutpay', 'raise'), `${tag} 帳不到五天（剛開張、剛換手）不調薪，跟原本一樣`, O.young);
    ok(hasA(O.withRival, 'down', 'down2') && none(O.withRival, 'up') && none(O.atFloor, 'down', 'down2') && hasA(O.atFloor, 'up') && hasA(O.near, 'down') && none(O.near, 'down2'), `${tag} 有對手才列調價：原價時只能降；降到七五折不能再降、可以漲回；離底線不到一成只列降 5%`, { r: O.withRival, f: O.atFloor, n: O.near });
    ok(none(O.rival, 'cutpay', 'raise') && hasA(O.rival, 'down', 'keep') && hasA(O.rivalLost, 'raise'), `${tag} 對面那家的東家：調價；工資只有被挖走人時才能加（跟原本一樣）`, { r: O.rival, lost: O.rivalLost });
    ok(O.stale === 0 && O.notBoss === 0, `${tag} 過期的問題、不是這家東家的人，沒有選項`, { stale: O.stale, notBoss: O.notBoss });
    ok(hasA(O.lowStock, 'more') && none(O.lowStock, 'less') && hasA(O.highStock, 'less') && none(O.highStock, 'more'), `${tag} 倉裡不太夠才列多做一點，堆太多才列少做一點`, { low: O.lowStock, high: O.highStock });
    ok(O.farmHigh.length > 1 && none(O.farmHigh, 'less'), `${tag} 農莊就算存糧很多也沒有「少做一點」（糧食少種全鎮會餓到）`, O.farmHigh); }
  // 4
  { const S = r.settle; const clean = (x) => x && x.leak === 0 && x.moved === 0;
    ok(S.cutLosing.pay === 0.9 && S.cutFloor === 0.5 && S.cutLosing.logs.some(x => x.includes('✂️') && x.includes('90%')) && clean(S.cutLosing), `${tag} 虧錢時砍薪：砍一成、最低五成，日誌寫「把工資砍到原本的 90%」，錢沒動`, S.cutLosing);
    ok(S.squeeze.pay === 0.95 && S.squeezeFloor === 0.6 && clean(S.squeeze), `${tag} 賺錢時壓薪：壓 5%、最低六成`, { s: S.squeeze, f: S.squeezeFloor });
    ok(S.raise.pay === 1.05 && S.raiseTop === 1.2 && S.raise.logs.some(x => x.includes('💰') && x.includes('105%')) && clean(S.raise), `${tag} 加薪：加 5%、最高 120%，日誌有寫`, { r: S.raise, top: S.raiseTop });
    ok(S.down.price === 0.95 && S.down2.price === 0.85 && S.downFloor === 0.75 && S.down.logs.some(x => x.includes('🏷️') && x.includes('95%')) && clean(S.down), `${tag} 降價：降 5% 或 10%、最低七五折，日誌有寫`, { d: S.down, d2: S.down2, f: S.downFloor });
    ok(S.up.price === 0.8 && S.up.logs.some(x => x.includes('🏷️') && x.includes('80%')), `${tag} 漲回：一次 5%`, S.up);
    ok(S.war.war && S.war.rivPrice === 0.95, `${tag} 兩家這週都降價：日誌寫價格戰（跟原本那一句一樣）`, S.war);
    ok(S.greedyFloor === 0.9 && !S.greedyAt.includes('down'), `${tag} 貪心的東家不降到九折以下`, { f: S.greedyFloor, ids: S.greedyAt });
    ok(S.rivRaise.pay === 1.05 && clean(S.rivRaise), `${tag} 對面那家被挖走人：加薪 5%`, S.rivRaise); }
  // 5
  { const L = r.lean;
    ok(L.plainHi === 'keep' && L.greedyHi === 'cutpay' && L.kindHi === 'raise' && L.genHi === 'raise', `${tag} 照個性（賺很多時）：一般的照舊，貪心的壓薪，心腸好、慷慨的加薪`, L);
    ok(L.plainLose === 'cutpay' && L.kindLose === 'cutpay' && L.greedyLose === 'cutpay' && L.plainMid === 'keep', `${tag} 照個性：虧錢時大家都砍薪；小賺時一般的照舊`, L);
    ok(L.share > 0.55 && L.plainRival === 'down' && L.kindRival === 'down2' && L.greedyRival !== 'down' && L.greedyRival !== 'down2', `${tag} 客人被搶走：一般的降 5%，心腸好的降 10%，貪心的已經九折就不降`, L);
    ok(L.crowdLose.n >= 15 && L.crowdLose.moved / L.crowdLose.n >= 0.75, `${tag} 一群隨機個性的東家（照常的心情起伏）在虧錢時：多半砍薪（${L.crowdLose.moved}/${L.crowdLose.n}）`, L.crowdLose);
    ok(L.crowdMid.n >= 10 && L.crowdMid.stay / L.crowdMid.n >= 0.75, `${tag} 不貪心也不特別心軟的東家在小賺時：多半照舊（${L.crowdMid.stay}/${L.crowdMid.n}）`, L.crowdMid); }
  // 6
  { const K6 = r.skip;
    ok(K6.asked.took.pay === 1 && K6.asked.skip && K6.asked.after === K6.asked.before, `${tag} 問過的那一家：原本的每週調薪這週不動它`, K6.asked);
    ok(K6.away.asked === 0 && !K6.away.took && K6.away.pay === 0.9, `${tag} 東家不在鎮上：不問，照原本的規則砍一成`, K6.away);
    ok(K6.off.asked === 0 && K6.off.pay === 0.9, `${tag} 決策核心沒開：不問，照原本的規則`, K6.off);
    ok(K6.expired === false && K6.expiredPay === 0.9 && K6.otherBoss === false, `${tag} 七天過了、或換了東家：前一次拿的主意不算，照原本的規則`, K6);
    ok(K6.oldSave.pay === 0.9, `${tag} 舊存檔沒有這一格：照原本的規則，不出錯`, K6.oldSave);
    ok(K6.price.share > 0.55 && K6.price.inc === 1 && K6.price.incRule === 0.95, `${tag} 兩家搶生意、客人被搶走：問過的那一家，原本的每週調價不動它；沒問過時照原本降 5%`, K6.price); }
  // 7
  { const Wk = r.week;
    ok(Wk.public === 0 && Wk.publicSectors.length >= 3, `${tag} 公營的產業沒有東家，不問任何人`, { pub: Wk.public, sectors: Wk.publicSectors });
    ok(Wk.per.boss === 2 && Wk.per.third === 2 && Wk.per.riv === 2 && Wk.gaps.every(g => g === 7) && Wk.all - Wk.seconds === 6 && Wk.seconds <= 6, `${tag} 兩週裡每位東家各問兩次、剛好隔七天（名下兩家的也只問一次）`, Wk);
    ok(Wk.slots.boss === 2 && Wk.slots.third === 3 && Wk.slots.riv === 5 && Wk.days === 3, `${tag} 錯開在不同天：照產業順序（布莊第 3 天、木作坊第 4 天），對面那家晚三天`, Wk.slots);
    ok(Wk.focus === 'mine' && Wk.thirdK.every(x => x === 'mine'), `${tag} 名下好幾家的問最有狀況的那一家（賠錢的礦場）`, { focus: Wk.focus, k: Wk.thirdK }); }
  // 8
  { const Fi = r.fire;
    ok(Fi.over && Fi.cand.length === 2 && Fi.ids.includes('fire') && Fi.optNames && Fi.least, `${tag} 人比名額多兩成以上：列出最不擅長的兩個人的名字，讓東家決定請誰走`, Fi);
    ok(Fi.fired.job === null && Fi.fired.jobless && Fi.fired.laid === 1 && Fi.fired.unemployed && Fi.fired.log && Fi.fired.leak === 0 && Fi.fired.cut === 1, `${tag} 東家請人走路：那個人真的沒了工作、記在失業名單裡，日誌有寫，算進這週的裁員`, Fi.fired);
    ok(Fi.rule.tookCut === 0 && Fi.rule.noTook >= 1, `${tag} 這一行這週東家拿過主意：原本的每週裁員不再動這一行（沒問過時會裁）`, Fi.rule);
    ok(!Fi.capped, `${tag} 這週已經裁了 2 人：不再列裁員`, Fi.capped);
    ok(Fi.plainPick.startsWith('fire') && Fi.kindPick === 'keep' && Fi.kindKept, `${tag} 照個性：一般的東家會裁；又心軟又慷慨的不裁`, { plain: Fi.plainPick, kind: Fi.kindPick }); }
  // 9
  { const Mg = r.mgr;
    ok(Mg.need.includes('textile') && Mg.focus === 'textile' && Mg.ids.includes('hire') && Mg.ids.includes('self'), `${tag} 名下三家：最不賺的那家要請掌櫃，東家可以請某某或自己硬撐`, Mg);
    ok(Mg.hired && Mg.hired.mgr === Mg.hired.want && Mg.hired.after === Mg.hired.want && Mg.hired.leak === 0, `${tag} 東家請了誰就是誰，每天的掌櫃檢查不會換人`, Mg.hired);
    ok(Mg.self.took === 1 && Mg.self.selfRun && Mg.self.mgr === null && Mg.self.q1 < Mg.self.q0, `${tag} 自己硬撐：這週不會被自動請掌櫃，那家顧得沒那麼周到（客人少一些）`, Mg.self);
    ok(Mg.rule && !Mg.two, `${tag} 對照：沒問過就照原本自動請；名下只剩兩家就沒有掌櫃的選項`, { rule: Mg.rule, two: Mg.two }); }
  // 10
  { const St = r.stock;
    ok(St.mid.more > St.mid.usual && St.mid.less < St.mid.usual && St.low.usual === 1 && St.low.more === 1 && St.low.less === 1, `${tag} 多做／少做只挪放慢的門檻：存量快到目標時看得出差別，缺很多時一樣全力做`, St);
    ok(St.cap.usual === St.cap.more && St.cap.more === St.cap.less && St.cap.usual <= 0.05, `${tag} 堆到三倍的硬上限不變（不會因為多做一點就爆倉）`, St.cap);
    ok(St.newOwner === St.mid.usual && St.newOwnerStance === 'usual', `${tag} 換了東家：前一位定的檔位不算`, St);
    ok(St.chose.stance === 'more' && St.chose.log, `${tag} 選了「多做一點」：記下來、日誌有寫`, St.chose); }
  // 11
  { const Sv = r.save;
    ok(Sv.round.stock === 'less' && Sv.round.took === 1 && Sv.round.last && Sv.round.next, `${tag} 存讀檔帶著東家定的檔位、這週拿過的主意、上次問的日子`, Sv.round);
    ok(!Sv.oldErr && Sv.old && Sv.old.f === 1, `${tag} 讀沒有這一格的舊存檔：不出錯，檔位照常`, { old: Sv.old, err: Sv.oldErr });
    const Mi = r.mind;
    ok(Mi.aiOn && Mi.ai && Mi.ai.ctx && Mi.ai.pending && Mi.ai.e && Mi.ai.e.id === 'cutpay' && Mi.ai.e.src === 'ai' && Mi.ai.e.reason === 'model reason 77' && Mi.ai.pay === 0.9 && Mi.ai.lg && Mi.ai.lg.ai === 1 && Mi.ai.lg.why === 'model reason 77', `${tag} 開智能體：題目送出、等 AI 回話，採用它選的「砍薪」和理由，工資照規則砍一成`, Mi.ai);
    ok(Mi.ai && Mi.ai.work === 1 && Mi.ai.town === 0 && Mi.afterDaily === 1, `${tag} 用的是 work 那一組的額度：昨天用完的額度先歸零，全鎮的 10 件沒動，之後每天掃一輪時也不會再歸零`, { ai: Mi.ai, after: Mi.afterDaily });
    ok(Mi.prompt && Mi.prompt.n === 1 && Mi.prompt.facts && Mi.prompt.codes, `${tag} 題目裡有帳目和選項代號`, Mi.prompt);
    ok(zh || (Mi.prompt && !Mi.prompt.cjkAll), `${tag} 英文題目裡沒有中文`, zh ? null : Mi.prompt); }
  // 13
  { const O = r.more;
    ok(O.issues.includes('pay') && O.issues.includes('price') && O.two.n === 2 && O.two.sec && O.two.first !== O.two.second && ['cutpay', 'down'].includes(O.two.first) && ['cutpay', 'down'].includes(O.two.second) && O.two.pay === 0.9 && O.two.price === 0.95 && !O.two.next, `${tag} 同一家虧錢又被搶走客人：做完第一件當場追問，砍薪和降價同一週都生效，沒有第三次`, O.two);
    ok(!O.two.ids2.includes('cutpay') && !O.two.ids2.includes('raise') && O.two.ids2.includes('down') && O.two.f2, `${tag} 追問時拿掉剛剛那一件，開頭講剛剛決定了什麼`, { ids: O.two.ids2, f: O.two.f2 });
    ok(O.keepOnly.length === 1 && O.keepOnly[0] === 'keep' && O.oneIssue.length === 1 && O.oneIssue[0] === 'cutpay', `${tag} 選了照舊、或只有一件事：不追問`, { keep: O.keepOnly, one: O.oneIssue });
    ok(O.other.ks.length === 2 && O.other.ks[1].startsWith('timber') && O.other.sec && O.other.payT === 0.9 && O.other.payK === 0.9 && O.other.tookT === 1, `${tag} 同一家沒別的事、名下另一家也在虧：第二次改問那一家，兩家都砍了，那一家也標上這週問過`, O.other);
    ok(O.nextDay.n === 1 && O.nextDay.sec && !O.nextDay.left && O.nextDay.stale === 0, `${tag} 開智能體時回話晚：追問留到隔天一開始送出；過期的追問丟掉`, O.nextDay);
    ok(O.mgr.need.length === 2 && O.mgr.asked === null && O.mgr.selfK && !O.mgr.selfOther && (!O.mgr.otherStaff || O.mgr.other) && O.mgr.qOther !== null && O.mgr.qK < O.mgr.qOther, `${tag} 掌櫃一家一家算：被問過的那一家不自動請、還沒掌櫃就扣；沒被問到的那一家照原本自動請、不扣`, O.mgr);
    ok(O.mgr.seq.length === 2 && O.mgr.seq.slice().sort().join() === 'cutpay,hire' && !!O.mgr.after, `${tag} 虧錢又要請掌櫃：兩件同一週都做了（先做哪一件看他跟夥計的交情），請了人`, O.mgr);
    ok(O.rel.withFoe && O.rel.kin === 'fam' && O.rel.foe === 'feud' && O.rel.text && O.rel.pickFoe, `${tag} 交情：跟東家結過怨的夥計加進裁員名單（最多三位）、被請走；最不擅長的那位是家人就留下；文字註明關係`, O.rel);
    ok(O.mgrRel.skip !== undefined ? true : (O.mgrRel.incl && O.mgrRel.text && O.mgrRel.pick), `${tag} 掌櫃：東家很要好的夥計也在名單上、會被優先請（用人唯親），文字註明關係`, O.mgrRel);
    ok(O.lab.strike && O.lab.union, `${tag} 正在罷工、夥計裡有工會的頭頭：事實裡講一句`, O.lab);
    ok(!O.oldSelfErr && O.oldSelf && O.oldSelf.self === undefined && O.oldSelf.run === false, `${tag} 舊存檔裡以東家記的 self：讀進來丟掉、不出錯、不扣任何一家`, { o: O.oldSelf, e: O.oldSelfErr }); }
  // 12
  { const Ru = r.run;
    ok(Ru.errs.length === 0 && Ru.n >= Math.min(3, Ru.bosses) && Ru.maxPer <= 3 && Ru.minGap >= 7 && Ru.secOk && Ru.other === 0, `${tag} 放著跑 20 天：東家每週拿主意（同一個人兩次之間至少隔七天）、沒有錯誤、帳上沒有對不上的錢`, Ru); }
  ok(zh || (!r.keys.some(cjk) && !r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 新句子、給東家看的事實、選項、理由與結果都有英文`, zh ? null : { keys: r.keys.filter(cjk), texts: r.texts.filter(cjk).slice(0, 4), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  console.log('   ', JSON.stringify(r.run));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
