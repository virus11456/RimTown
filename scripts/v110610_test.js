// v11.6.0 小店有自己的店面，撐不撐、接不接由當事人決定（sim-biz.js；選擇點 shopFail／shopJoin／shopHeir 登記在 sim-decide-work.js）
//   1) 登記了三個選擇點（由那一刻送進來、不是每天掃），用 work 那一組的 AI 額度
//   2) 開店拿到一格店面：在廣場十格內的草地上，不壓路、水、建築、地點範圍、工廠地基，每格只有一家
//   3) 存讀檔後每家店還在同一格；舊存檔（沒有店面）讀進來補得到；十格內都沒空地時店照開、沒有攤位
//   4) 3D：攤位有畫出來（整組併成一個網格），營業中有招牌、空店面樣子不一樣；點攤位打開資訊卡（店名、老闆、合夥人、開了多久、這週賺賠／空了幾天、上一家）
//   5) 連虧 10 天或欠到 25 問店主一次、七天內不再問；每個選項的結果：貼錢、降價、找朋友合夥（對方答應才算）、收掉、頂讓；照個性；底線（15 天、欠 40）照樣倒
//   6) 空店面頂下來只要 35：上一任還在鎮上付給他，不在了付給木匠（或公庫）；沒有空店面才蓋新的 60
//   7) 老闆過世：先問合夥人、再配偶、再成年子女；接了店還在；沒人接攤位掛空；出遠門不算；決策核心沒開照舊收掉
//   8) 空滿 30 天的店面可以提案拆掉，通過後攤位從地圖上消失、那一格還給空地
//   9) 錢只在人、店、公庫之間移動；開 AI 時題目送出、回答被採用、英文題目沒有中文；放著跑 30 天沒有錯誤
// 用法：BASE=http://localhost:8178/ node scripts/v110610_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8178/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); if (/\[Biz\]|\[Decide\]|\[Town3D\] biz|\[Demolish\]/.test(x)) console.log('    console:', x.slice(0, 300)); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.fullAgentMode = false; const out = {}; const R0 = Math.random; const tm = app.tileMap;
    for (let k = 0; k < 900 && !DECIDE.on(w); k++) { w.paused = false; w.tick(); } w.paused = true; out.on = DECIDE.on(w) && !!tm?.grid;
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const X = DECIDE.S(w); const B = BIZ.S(w); const KF = DECIDE.KINDS.shopFail, KJ = DECIDE.KINDS.shopJoin, KH = DECIDE.KINDS.shopHeir;
    const seen = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && /^shop/.test(o.K.key)) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); });
    // 只換個性與在乎的事（personality 是物件，不能整個換掉）
    const plain = (a) => { a._p0 = a._p0 || { t: (a.personality.traits || []).slice(), v: (a.personality.values || []).slice() }; a.personality.traits = []; a.personality.values = []; }; const restore = (a) => { if (a._p0) { a.personality.traits = a._p0.t; a.personality.values = a._p0.v; delete a._p0; } };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const texts = []; const logs = () => (w.messageLog || []).map(m => String(m.content || ''));
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const c = cash(a); if (c > n) WALLET.take(w, a, c - n); else if (n > c) WALLET.add(w, a, n - c); };
    const tres = () => w.stockpile.get('silver');
    // 開一家店（直接走 BIZ.open：錢先備好；不檢查鎮上店數上限，測試要開很多家）
    const openFor = (a, kind) => { setCash(a, Math.max(cash(a), 120)); const n0 = B.shops.length; BIZ.open(w, B, a, day(), {}, kind); return B.shops.length > n0 ? B.shops[B.shops.length - 1] : null; };
    // 人口長到 50 人左右（測試要開很多家店、死掉幾個老闆），新生的直接當成年人
    { const all = npcs(); let k = 0; while (npcs().length < 50 && k++ < 80) { w.tickCount++; w.lifecycle._birthChild(w, all[k % all.length], all[(k * 7 + 3) % all.length]); } for (const a of npcs()) if ((a.age ?? 30) < 20) a.age = 22 + (String(a.agentId).length % 9); }
    const pool = npcs().filter(a => (a.age ?? 30) >= 20 && a.job?.key !== 'mayor' && !BIZ.shopOf(w, a));
    // 列選項時把旁人的錢先收起來（不然誰都可能剛好是「交情好又有錢的朋友」或「想接的人」），列完原樣放回去；只用在不動錢的地方
    const isolate = (keep, fn) => { const bal = w.wallet.bal; const snap = Object.assign({}, bal); const ids = new Set(keep.filter(Boolean).map(a => a.agentId)); for (const k of Object.keys(bal)) if (!ids.has(k)) bal[k] = 0; try { return fn(); } finally { for (const k of Object.keys(snap)) bal[k] = snap[k]; } };
    for (const a of pool) { a.currentLocation = a.currentLocation === 'exploration' ? 'town_square' : a.currentLocation; if (w.civic?.jail) delete w.civic.jail[a.agentId]; }
    const TT = T; // tilemap.js 的地圖格子代號
    const sq = tm.buildingZones.town_square || tm.natureZones.town_square;

    // 1) 登記
    out.pop = { all: npcs().length, pool: pool.length };
    out.reg = [KF, KJ, KH].map(K => K ? { key: K.key, scan: K.scan, group: K.aiGroup, title: t(K.title) } : null);

    // 2) 開店拿到店面
    { for (const s of B.shops.slice()) BIZ.close(w, s, 'quit'); B.fronts.length = 0; B.closed.length = 0;
      const owners = pool.slice(0, 12); const shops = owners.map((a, i) => openFor(a, ['inn', 'teahouse', 'curio', 'studio'][i % 4])).filter(Boolean);
      const G = tm.grid; const OKT = new Set([TT.GRASS, TT.GRASS2, TT.GRASS3]);
      const zones = [...Object.values(tm.buildingZones), ...Object.values(tm.natureZones)]; const plots = tm._getFactoryPlots();
      const inZ = (f) => zones.some(z => f.x >= z.x && f.x < z.x + (z.w || 1) && f.y >= z.y && f.y < z.y + (z.h || 1)) || plots.some(z => f.x >= z.x && f.x < z.x + z.w && f.y >= z.y && f.y < z.y + z.h);
      const fr = shops.map(s => BIZ.frontOf(w, s)); const keys = fr.filter(Boolean).map(f => f.x + ',' + f.y);
      const ring = (f) => Math.max(sq.x - f.x, f.x - (sq.x + sq.w - 1), sq.y - f.y, f.y - (sq.y + sq.h - 1));
      out.fronts = { shops: shops.length, withFront: fr.filter(Boolean).length, grass: fr.every(f => f && OKT.has(G[f.y][f.x])), road: fr.some(f => f && [TT.DIRT, TT.STONE_PATH, TT.WATER, TT.WATER2, TT.BRIDGE].includes(G[f.y][f.x])), inZone: fr.filter(f => f && inZ(f)).length, unique: new Set(keys).size === keys.length, rings: fr.map(f => f && ring(f)), maxRing: Math.max(...fr.map(f => f ? ring(f) : 99)), mapped: shops.every(s => BIZ.frontOf(w, s)?.shop === s.id) };
      // 蓋房子、蓋新東西時避開店面
      const site = tm.findFreeSite(2, 2); out.fronts.siteAvoid = !site || !B.fronts.some(f => f.x >= site.x && f.x < site.x + 2 && f.y >= site.y && f.y < site.y + 3); // 新東西佔的格子（寬 2、高 2 加門口一列）不壓店面
      out.firstShops = shops.map(s => s.id); }

    // 3a) 存讀檔
    { const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv); const pos = (W) => (W.biz?.shops || []).map(s => { const f = (W.biz.fronts || []).find(x => x.id === s.front); return s.id + '@' + (f ? f.x + ',' + f.y : '-'); }).join('|');
      const before = pos(w); BIZ.syncMap(w2, tm); const after = pos(w2); BIZ.syncMap(w, tm); out.save = { same: before === after && before.length > 0, before: before.slice(0, 80), after: after.slice(0, 80) }; w2.reset?.(); }
    // 3b) 舊存檔：沒有店面
    { const sv0 = JSON.parse(JSON.stringify(w.serialize())); delete sv0.biz.fronts; delete sv0.biz.fn; for (const s of sv0.biz.shops) { delete s.front; delete s.h; } const w3 = new World(); let err = null; try { w3.loadSave(sv0); } catch (e) { err = String(e.message); }
      const n0 = (w3.biz?.fronts || []).length; let filled = 0; try { BIZ.syncMap(w3, tm); filled = (w3.biz.shops || []).filter(s => (w3.biz.fronts || []).some(f => f.id === s.front && f.shop === s.id)).length; } catch (e) { err = String(e.message); }
      out.old = { err, n0, shops: (w3.biz?.shops || []).length, filled }; w3.reset?.(); BIZ.syncMap(w, tm); }
    // 3c) 十格內都沒空地：店照開、沒有攤位
    { tm.buildingZones.__t_block = { x: 0, y: 0, w: tm.cols, h: tm.rows }; const a = pool[13]; const s = openFor(a, 'inn'); out.nospace = { shop: !!s, front: s ? s.front : 'x', inList: s ? B.shops.includes(s) : false }; delete tm.buildingZones.__t_block;
      // 之後有空地了（隔天）會補上
      if (s) { s.nf = day() - 1; tm._bizDay = null; BIZ.syncMap(w, tm); out.nospace.later = !!BIZ.frontOf(w, s); } }

    // 4) 3D
    { app.state = w.getState(); const tgt = B.fronts[0]; tm.target.set(tgt.x + 0.5, 0, tgt.y + 0.5); tm.dist = 16;
      const frame = async (n = 3) => { for (let i = 0; i < n; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); } };
      await frame(4); const verts = () => { let v = 0, m = 0; tm._bizGroup?.traverse(o => { if (o.isMesh) { m++; v += o.geometry.attributes.position.count; } }); return { v, m }; };
      const V1 = verts(); const L1 = (tm._bizLabels || []).length; const openN = B.fronts.filter(f => f.shop).length;
      const s0 = B.shops.find(s => s.front === tgt.id); BIZ.close(w, s0, 'quit'); await frame(3); const V2 = verts(); const L2 = (tm._bizLabels || []).length;
      const shown = tm.overlay ? tm.overlay.querySelectorAll('.t3d-biz').length : -1;
      // 點攤位：營業中的與空的
      const tap = async (f) => { const r0 = tm.glCanvas.getBoundingClientRect(); const p = tm._project(f.x + 0.5, tm.groundY(f.x + 0.5, f.y + 0.5) + 0.7, f.y + 0.5); const ap = tm.agentPositions; tm.agentPositions = {}; try { tm._handleTap(r0.left + p.x, r0.top + p.y); } finally { tm.agentPositions = ap; } await new Promise(r => setTimeout(r, 50)); const c = document.getElementById('loc-quick-card'); return { open: !!c && !c.classList.contains('hidden'), biz: c?.dataset?.biz || '', text: c ? c.innerText : '' }; };
      const fOpen = B.fronts.find(f => f.shop); tm.target.set(fOpen.x + 0.5, 0, fOpen.y + 0.5); await frame(3); const so = B.shops.find(s => s.id === fOpen.shop);
      const cOpen = await tap(fOpen); app._hideNpcCard?.();
      tm.target.set(tgt.x + 0.5, 0, tgt.y + 0.5); await frame(3); const cIdle = await tap(tgt); app._hideNpcCard?.();
      const ow = w.agents[so.owner];
      out.three = { group: !!tm._bizGroup, meshes: V1.m, v1: V1.v, v2: V2.v, labels1: L1, labels2: L2, openN, shown, diff: V1.v !== V2.v,
        cOpen: { open: cOpen.open, biz: cOpen.biz === fOpen.id, name: cOpen.text.includes(I18N.getLang?.() === 'en' ? so.name[1] : so.name[0]), owner: cOpen.text.includes(t(ow.name)), week: cOpen.text.includes(t('這週賺賠')), days: cOpen.text.includes(t('開了多久')) },
        cIdle: { open: cIdle.open, biz: cIdle.biz === tgt.id, idle: cIdle.text.includes(t('空店面')) && cIdle.text.includes(t('空了多久')), prev: cIdle.text.includes(t('上一家')) && cIdle.text.includes(I18N.getLang?.() === 'en' ? s0.name[1] : s0.name[0]) }, cardTexts: [cOpen.text, cIdle.text] };
      texts.push(cOpen.text, cIdle.text); }

    // 5) 一直虧：問店主
    const S5 = {};
    { const owner = pool[14]; const s = openFor(owner, 'curio'); plain(owner); setCash(owner, 100);
      const friend = pool[15], tk = pool[16]; for (const o of [friend, tk]) { plain(o); setCash(o, 0); }
      const fc = (sh, id) => isolate([owner, friend, tk], () => KF.options(w, owner, { s: sh.id, d: day() }).find(o => String(o.id) === id || String(o.id) === id + ':' + (id === 'partner' ? friend.agentId : tk.agentId) || (id !== 'partner' && id !== 'sell' && String(o.id).split(':')[0] === id)));
      const ids = (sh) => isolate([owner, friend, tk], () => KF.options(w, owner, { s: sh.id, d: day() }).map(o => String(o.id).split(':')[0]));
      s.lossDays = 10; s.till = -12; s.price = 4; s.h = [-2, -2, -1, -2, -3, -2, -2];
      S5.facts = KF.facts(w, owner, { s: s.id, d: day() }); texts.push(S5.facts);
      S5.factsHas = { name: S5.facts.includes(t(s.name[0])), ld: S5.facts.includes('10'), debt: S5.facts.includes('12'), week: S5.facts.includes('14'), cash: S5.facts.includes('100'), partner: S5.facts.includes(t('你沒有合夥人。')) };
      S5.base = ids(s);
      friend.relationships.getOrCreate(owner.agentId, owner.name).affinity = 60; owner.relationships.getOrCreate(friend.agentId, friend.name).affinity = 60; setCash(friend, 80);
      tk.personality.traits = ['hardworking']; setCash(tk, 80); S5.full = ids(s);
      setCash(owner, 5); S5.poor = ids(s); setCash(owner, 100); s.price = 1; S5.cheap = ids(s); s.price = 4;
      for (const o of isolate([owner, friend, tk], () => KF.options(w, owner, { s: s.id, d: day() }))) texts.push(tx(o.text), tx(o.say || ''), tx(o.why || ''));
      S5.stale = KF.options(w, owner, { s: s.id, d: day() - 5 }).length; S5.notOwner = KF.options(w, friend, { s: s.id, d: day() }).length;
      // 貼錢
      { const c0 = cash(owner), t0 = tres(); const L = leak(() => fc(s, 'prop').run(w, owner, { s: s.id, d: day() })); S5.prop = { res: tx(L.ret), leak: L.leak, paid: r3(c0 - cash(owner)), tres: r3(tres() - t0), till: s.till, ld: s.lossDays }; }
      // 降價
      { s.lossDays = 10; s.till = -12; const L = leak(() => fc(s, 'cut').run(w, owner, { s: s.id, d: day() })); S5.cut = { price: s.price, leak: L.leak, res: tx(L.ret) }; }
      // 合夥：對方不答應
      { s.till = -12; const op = fc(s, 'partner'); setCash(friend, 80); friend.personality.traits = ['thrifty', 'greedy']; const n0 = seen.length; const L = steady(() => leak(() => { const res = op.run(w, owner, { s: s.id, d: day() }); DECIDE.drain(w, X, day()); return res; }));
        const ans = seen.slice(n0).find(e => e.kind === 'shopJoin'); S5.joinNo = { asked: !!ans, who: ans?.who === friend.agentId, pick: ans?.id, partner: s.partner, leak: L.leak, friendCash: cash(friend) }; }
      // 合夥：對方答應
      { s.till = -12; s.lossDays = 11; plain(friend); friend.personality.traits = ['generous', 'kind']; setCash(friend, 80); const op = fc(s, 'partner'); const c0 = cash(owner), t0 = tres(); const n0 = seen.length;
        const L = steady(() => leak(() => { op.run(w, owner, { s: s.id, d: day() }); DECIDE.drain(w, X, day()); }));
        const ans = seen.slice(n0).find(e => e.kind === 'shopJoin'); S5.joinYes = { pick: ans?.id, partner: s.partner === friend.agentId, friendPaid: r3(80 - cash(friend)), ownerGot: r3(cash(owner) - c0), tres: r3(tres() - t0), till: s.till, leak: L.leak };
        const jf = KJ.facts(w, friend, { s: s.id, from: owner.agentId, d: day() }); texts.push(jf); S5.joinStale = KJ.options(w, friend, { s: s.id, from: owner.agentId, d: day() }).length;
        S5.noPartnerOpt = !ids(s).includes('partner'); }
      // 頂讓
      { s.till = -10; setCash(tk, 80); const op = fc(s, 'sell'); const c0 = cash(owner); const f = BIZ.frontOf(w, s); const L = leak(() => op ? op.run(w, owner, { s: s.id, d: day() }) : null);
        const ns = BIZ.shopOf(w, tk); S5.sell = { has: !!op, closed: s.closed, tkPaid: r3(80 - cash(tk)), ownerGot: r3(cash(owner) - c0), newShop: !!ns && ns.owner === tk.agentId, kind: ns?.type, want: BIZ.typeFor(tk), sameFront: !!ns && ns.front === f?.id, frontShop: f?.shop === ns?.id, leak: L.leak, res: tx(L.ret) }; }
      // 收掉
      { const o2 = pool[17]; const s2 = openFor(o2, 'inn'); plain(o2); s2.lossDays = 10; s2.till = -15; const f2 = BIZ.frontOf(w, s2); const L = leak(() => KF.options(w, o2, { s: s2.id, d: day() }).find(o => o.id === 'close').run(w, o2, { s: s2.id, d: day() }));
        S5.close = { closed: s2.closed, inList: B.shops.includes(s2), front: !!f2 && B.fronts.includes(f2), idle: f2?.shop === null && f2?.idle === day(), last: f2?.last?.owner === o2.agentId, leak: L.leak }; restore(o2); }
      // 照個性（固定心情）
      { const o3 = pool[18]; const s3 = openFor(o3, 'teahouse'); const as = (traits, withTaker) => steady(() => { plain(o3); o3.personality.traits = traits; setCash(o3, 100); s3.lossDays = 10; s3.till = -12; s3.price = 3; const tk2 = pool[19]; plain(tk2); tk2.personality.traits = withTaker ? ['hardworking'] : []; setCash(tk2, withTaker ? 80 : 0); const ops = isolate([o3, tk2], () => KF.options(w, o3, { s: s3.id, d: day() })); const Ln = DECIDE.lean(w, o3); let b = null, bs = -1e9; for (const op of ops) { const sc = DECIDE.score(Ln, op); if (sc > bs) { bs = sc; b = op; } } restore(tk2); return String(b?.id || '').split(':')[0]; });
        S5.lean = { plain: as([]), ambitious: as(['ambitious']), jealous: as(['jealous']), thrifty: as(['thrifty', 'neurotic']), thriftyTaker: as(['thrifty', 'neurotic'], true) }; restore(o3);
        // 從每天的帳觸發：連虧到 10 天就問一次，七天內不再問
        s3.lossDays = 9; s3.till = -20; s3.failAsk = null; s3.price = 9; o3.personality.traits = ['ambitious']; setCash(o3, 0); // 錢不夠貼、沒人要接：多半先撐著
        const n0 = seen.length; const RR = Math.random; Math.random = () => 0.99; try { isolate([o3], () => BIZ.trade(w, B, day())); } finally { Math.random = RR; } const first = seen.slice(n0).filter(e => e.kind === 'shopFail' && e.who === o3.agentId);
        const n1 = seen.length; Math.random = () => 0.99; try { if (!s3.closed) { s3.lossDays = Math.min(s3.lossDays, 12); isolate([o3], () => BIZ.trade(w, B, day())); } } finally { Math.random = RR; } const again = seen.slice(n1).filter(e => e.kind === 'shopFail' && e.who === o3.agentId);
        S5.trigger = { first: first.length, again: again.length, failAsk: s3.failAsk === day(), pick: first[0]?.id };
        // 底線：問過了、還是連虧到 15 天 → 倒閉
        if (!s3.closed) { s3.failAsk = day(); s3.lossDays = 14; s3.till = -20; Math.random = () => 0.99; try { BIZ.trade(w, B, day()); } finally { Math.random = RR; } } S5.floor = { closed: s3.closed };
        // 決策核心沒開：不問，照原本的規則倒
        const o4 = pool[20]; const s4 = openFor(o4, 'inn'); s4.lossDays = 14; s4.till = -20; const on0 = DECIDE.on; DECIDE.on = () => false; const n2 = seen.length; Math.random = () => 0.99; try { BIZ.trade(w, B, day()); } finally { Math.random = RR; DECIDE.on = on0; }
        S5.off = { asked: seen.slice(n2).filter(e => e.kind === 'shopFail').length, closed: s4.closed }; }
      restore(owner); restore(friend); restore(tk); }
    out.fail = S5;

    // 6) 空店面頂下來只要 35
    const S6 = {};
    { const vf = BIZ.vacant(w)[0]; const prevId = vf?.last?.owner; const prev = w.agents[prevId]; const a = pool.find(x => !BIZ.shopOf(w, x) && x.agentId !== prevId && (x.age ?? 30) >= 20 && x.job?.key !== 'mayor');
      setCash(a, 100); const c0 = cash(a), p0 = prev ? cash(prev) : 0; const si = (() => { const o = a.personality.traits.slice(); a.personality.traits = ['hardworking']; const keep = B.shops.splice(0); try { return BIZ.startInfo(w, a); } finally { a.personality.traits = o; B.shops.push(...keep); } })(); // 鎮上店數上限先拿開（測試開的店比上限多）
      const L = leak(() => BIZ.open(w, B, a, day(), {})); const s = B.shops[B.shops.length - 1];
      S6.reuse = { vf: !!vf, prevHere: !!prev, cost: si?.cost, paid: r3(c0 - cash(a)), prevGot: prev ? r3(cash(prev) - p0) : null, sameFront: s?.front === vf?.id && s?.owner === a.agentId, leak: L.leak };
      // 上一任已經不在鎮上：付給木匠（沒有木匠就進公庫）
      const vf2 = BIZ.vacant(w)[0] || (() => { const s9 = B.shops.find(x => x.owner !== a.agentId); BIZ.close(w, s9, 'quit'); return BIZ.vacant(w)[0]; })(); vf2.last = Object.assign({}, vf2.last || { name: ['某記', 'Someone'], type: 'inn' }, { owner: 'gone_123' });
      const b = pool.find(x => !BIZ.shopOf(w, x) && x !== a && (x.age ?? 30) >= 20 && x.job?.key !== 'mayor'); setCash(b, 100); const hands = npcs().filter(o => o !== b && ['builder', 'carpenter'].includes(o.job?.key)); const h0 = hands.reduce((m, o) => m + cash(o), 0), t0 = tres(), b0 = cash(b);
      const L2 = leak(() => BIZ.open(w, B, b, day(), {})); const s2 = B.shops[B.shops.length - 1];
      S6.gone = { paid: r3(b0 - cash(b)), toHands: r3(hands.reduce((m, o) => m + cash(o), 0) - h0 + tres() - t0), sameFront: s2?.front === vf2.id, leak: L2.leak };
      // 沒有空店面：蓋新的 60
      while (BIZ.vacant(w).length) { const f = BIZ.vacant(w)[0]; B.fronts.splice(B.fronts.indexOf(f), 1); }
      const c = pool.find(x => !BIZ.shopOf(w, x) && x !== a && x !== b && (x.age ?? 30) >= 20 && x.job?.key !== 'mayor'); setCash(c, 100); const n0 = B.fronts.length; const c0b = cash(c); BIZ.open(w, B, c, day(), {}); S6.fresh = { paid: r3(c0b - cash(c)), newFront: B.fronts.length === n0 + 1 };
      // 開店的題目寫得出空店面
      const sx = B.shops[B.shops.length - 1]; BIZ.close(w, sx, 'quit'); const d0 = pool.find(x => !BIZ.shopOf(w, x) && (x.age ?? 30) >= 20 && x.job?.key !== 'mayor'); const tr0 = d0.personality.traits.slice(); d0.personality.traits = ['hardworking']; setCash(d0, 100);
      const keep = B.shops.splice(0); let room0 = null, sf = ''; try { room0 = BIZ.startInfo(w, d0); const ks = DECIDE.KINDS.startup; sf = room0 ? ks.facts(w, d0, {}) : ''; } finally { B.shops.push(...keep); } texts.push(sf); S6.startup = { info: !!room0, cost: room0?.cost, mention: sf.includes('35') && sf.includes('60') }; d0.personality.traits = tr0; }
    out.take = S6;

    // 7) 老闆不在了
    const S7 = {};
    { const fresh = () => npcs().filter(x => !BIZ.shopOf(w, x) && w.agents[x.agentId] === x && (x.age ?? 30) >= 20 && x.job?.key !== 'mayor');
      const wedTo = (x) => Object.values(x.relationships?.relationships || {}).some(r => r.status === 'married');
      // 找一個沒有配偶、沒有孩子在鎮上的人（新生的孩子都掛在某兩個人名下：測試先把他名下的孩子、婚姻拿掉，才排得出「配偶 → 孩子」的順序）
      const loner = () => { const o = fresh().find(x => !wedTo(x)) || fresh()[0]; for (const y of npcs()) if ((y._parentNames || []).includes(o.name)) y._parentNames = y._parentNames.filter(n => n !== o.name); for (const [id, rr] of Object.entries(o.relationships?.relationships || {})) if (rr.status === 'married') { rr.status = 'ex'; const b = w.agents[id]?.relationships?.relationships?.[o.agentId]; if (b) b.status = 'ex'; } return [o]; };
      const heirSeen = (n0) => seen.slice(n0).filter(e => e.kind === 'shopHeir').map(e => ({ who: e.who, id: e.id }));
      const RR = Math.random; const quiet = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = RR; } };
      // 合夥人接
      { const [o, p] = fresh(); const s = openFor(o, 'inn'); s.partner = p.agentId; plain(p); s.h = [3, 3, 3, 3, 3, 3, 3]; const n0 = seen.length; w.lifecycle._killNpc(w, o); quiet(() => BIZ.trade(w, B, day()));
        S7.partner = { asked: heirSeen(n0), took: s.owner === p.agentId && !s.closed, partnerNull: s.partner === null, front: BIZ.frontOf(w, s)?.shop === s.id }; restore(p); }
      // 配偶不接、成年子女接（照順序問）
      { const o = loner()[0]; const [sp, kid] = fresh().filter(x => x !== o && !wedTo(x)); const s = openFor(o, 'teahouse'); s.h = [2, 2, 2, 2, 2, 2, 2];
        sp.relationships.getOrCreate(o.agentId, o.name).status = 'married'; o.relationships.getOrCreate(sp.agentId, sp.name).status = 'married';
        plain(sp); sp.personality.traits = ['lazy']; sp.age = 70; plain(kid); kid.personality.traits = ['hardworking', 'ambitious']; kid._parentNames = [o.name]; kid.age = Math.max(20, kid.age || 20);
        const q = BIZ.heirsFor(w, s).map(x => x.r); const n0 = seen.length; w.lifecycle._killNpc(w, o); quiet(() => BIZ.trade(w, B, day()));
        const asked = heirSeen(n0); S7.family = { order: q, asked, spouseFirst: asked[0]?.who === sp.agentId && asked[0]?.id === 'no', kidTook: asked[1]?.who === kid.agentId && s.owner === kid.agentId && !s.closed };
        restore(sp); restore(kid); }
      // 沒人接：攤位掛空
      { const o = loner()[0]; const sp = fresh().filter(x => x !== o && !wedTo(x))[0]; const s = openFor(o, 'curio'); const f = BIZ.frontOf(w, s); sp.relationships.getOrCreate(o.agentId, o.name).status = 'married'; o.relationships.getOrCreate(sp.agentId, sp.name).status = 'married'; plain(sp); sp.personality.traits = ['lazy']; sp.age = 70; s.h = [-3, -3, -3, -3, -3, -3, -3];
        const n0 = seen.length; w.lifecycle._killNpc(w, o); quiet(() => BIZ.trade(w, B, day()));
        S7.none = { asked: heirSeen(n0).length, closed: s.closed, idle: !!f && f.shop === null && B.fronts.includes(f), last: f?.last?.owner === o.agentId, log: logs().slice(-20).some(x => x.includes('🔒')) }; restore(sp); }
      // 事實（另外找一家，直接看）
      { const [o, p] = fresh(); const s = openFor(o, 'inn'); s.partner = p.agentId; BIZ.noteGone(w, o, true); s.heir = { q: [p.agentId], r: ['partner'], i: 0, at: null, from: o.agentId, name: o.name, dead: true }; const ff = KH.facts(w, p, { s: s.id, d: day() }); texts.push(ff); for (const op of KH.options(w, p, { s: s.id, d: day() })) texts.push(tx(op.text), tx(op.say), tx(op.why));
        S7.facts = { has: ff.includes(t(s.name[0])) && ff.includes(t(o.name)) && ff.includes(t('你是這家店的合夥人。')), n: KH.options(w, p, { s: s.id, d: day() }).length }; s.heir = null; s.gone = null; s.partner = null; }
      // 活著搬走：照原本 sim-exile.js 的順序，家人先問（接手不用錢）；沒有家人才問合夥人，要照八折付錢（錢讓老闆帶走），錢不夠沒有「接下來」
      { const o = loner()[0]; const [sp, p] = fresh().filter(x => x !== o && !wedTo(x)); const s = openFor(o, 'inn'); s.partner = p.agentId; s.h = [3, 3, 3, 3, 3, 3, 3];
        sp.relationships.getOrCreate(o.agentId, o.name).status = 'married'; o.relationships.getOrCreate(sp.agentId, sp.name).status = 'married'; plain(sp); plain(p); setCash(p, 200);
        const sc0 = cash(sp), pc0 = cash(p); const n0 = seen.length; w.leaveTown(o.agentId, 'test'); const L = leak(() => quiet(() => BIZ.trade(w, B, day()))); const asked = heirSeen(n0);
        S7.leaveFam = { order: (s.heir ? s.heir.r : null), asked, famFirst: asked[0]?.who === sp.agentId, took: s.owner === sp.agentId && !s.closed, spPaid: r3(sc0 - cash(sp)), pPaid: r3(pc0 - cash(p)), pAsked: asked.some(e => e.who === p.agentId), leak: L.leak }; restore(sp); restore(p); }
      { const o = loner()[0]; const p = fresh().filter(x => x !== o)[0]; const s = openFor(o, 'teahouse'); s.partner = p.agentId; s.h = [3, 3, 3, 3, 3, 3, 3]; s.profit = 30; plain(p); setCash(p, 200);
        const price = EXILE.partnerPrice(w, { t: 'shop', s, boss: true }); const pc0 = cash(p); const n0 = seen.length; let facts = '', ids = [];
        const _o = KH.options; KH.options = function (w2, a2, c2) { const r = _o.call(this, w2, a2, c2); if (a2 === p && !facts) { facts = KH.facts(w2, a2, c2); ids = r.map(x => String(x.id)); for (const op of r) texts.push(tx(op.text), tx(op.say)); } return r; };
        w.leaveTown(o.agentId, 'test'); let L; try { L = leak(() => quiet(() => BIZ.trade(w, B, day()))); } finally { KH.options = _o; } texts.push(facts);
        const bal = +(w.wallet.bal[o.agentId] || 0);
        S7.leaveBuy = { price, ids, asked: heirSeen(n0).map(e => e.who === p.agentId ? e.id : '?'), took: s.owner === p.agentId && !s.closed, paid: r3(pc0 - cash(p)), toOwner: bal >= price, factsPrice: facts.includes(String(price)), leak: L.leak };
        // 錢包每天結算時，不在鎮上的人帳上的錢記成「搬走的人帶走」（扣離境稅），全鎮的錢對得上
        const MM0 = MONEY.S(w); const T0 = MONEY.total(w), P0 = MM0.pend; const Wd = w.wallet; const lastDay = Wd.lastDay; Wd.lastDay = -1; try { WALLET.daily(w); } catch (e) {} const emi = MONEY.S(w).pend - P0; S7.leaveBuy.settle = { gone: !(o.agentId in w.wallet.bal), leak: r3((MONEY.total(w) - T0) - emi) }; void lastDay; restore(p); }
      { const o = loner()[0]; const p = fresh().filter(x => x !== o)[0]; const s = openFor(o, 'curio'); s.partner = p.agentId; s.profit = 30; plain(p); setCash(p, 3); let ids = null;
        const _o = KH.options; KH.options = function (w2, a2, c2) { const r = _o.call(this, w2, a2, c2); if (a2 === p && !ids) ids = r.map(x => String(x.id)); return r; };
        w.leaveTown(o.agentId, 'test'); try { quiet(() => BIZ.trade(w, B, day())); } finally { KH.options = _o; } S7.leavePoor = { ids, closed: s.closed }; restore(p); }
      // 出遠門：不算不在了
      { const [o] = fresh(); const s = openFor(o, 'inn'); const tr = w.events._travellingAgents = w.events._travellingAgents || []; delete w.agents[o.agentId]; tr.push({ agentData: { agentId: o.agentId, name: o.name } }); const n0 = seen.length;
        quiet(() => BIZ.trade(w, B, day())); S7.away = { open: !s.closed && B.shops.includes(s), asked: heirSeen(n0).length, heir: s.heir || null }; tr.splice(tr.findIndex(x => x.agentData?.agentId === o.agentId), 1); w.agents[o.agentId] = o; }
      // 決策核心沒開：照原本的規則（v9.9.4 sim-exile.js：直接交給合夥人；沒有合夥人、家人就收掉）
      { const [o, p] = fresh(); const s = openFor(o, 'inn'); s.partner = p.agentId; const on0 = DECIDE.on; DECIDE.on = () => false; const n0 = seen.length; try { w.lifecycle._killNpc(w, o); quiet(() => BIZ.trade(w, B, day())); } finally { DECIDE.on = on0; } S7.off = { closed: s.closed, auto: s.owner === p.agentId, asked: heirSeen(n0).length };
        const o2 = loner()[0]; const s2 = openFor(o2, 'inn'); const f2 = BIZ.frontOf(w, s2); const n1 = seen.length; DECIDE.on = () => false; try { w.lifecycle._killNpc(w, o2); quiet(() => BIZ.trade(w, B, day())); } finally { DECIDE.on = on0; } S7.off2 = { closed: s2.closed, idle: !!f2 && f2.shop === null, asked: heirSeen(n1).length }; } }
    out.heir = S7;

    // 8) 空滿 30 天提案拆掉
    const S8 = {};
    { const busyEnd = () => { for (const p of (w.proposals?.items || [])) if (p.kind === 'demolish' && ['open', 'shelved', 'approved'].includes(p.status)) p.status = 'rejected'; };
      busyEnd(); let vf = BIZ.vacant(w)[0]; if (!vf) { const s = B.shops[0]; BIZ.close(w, s, 'quit'); vf = BIZ.vacant(w)[0]; }
      vf.idle = day() - 10; const L10 = DEMOLISH.list(w).find(x => x.id === 'p:' + vf.id); S8.young = { listed: !!L10, ok: L10 ? DEMOLISH.okNow(w, L10, false) : null };
      vf.idle = day() - 31; const L31 = DEMOLISH.list(w).find(x => x.id === 'p:' + vf.id); S8.old = { ok: L31 ? DEMOLISH.okNow(w, L31, false) : null, okAi: L31 ? DEMOLISH.okNow(w, L31, true) : null, age: L31?.age };
      // 在意的人來提：住附近或愛整潔、看重傳統的
      const fan = pool.find(x => w.agents[x.agentId] === x && !BIZ.shopOf(w, x) && x.job?.key !== 'trader' && w.mind?.amb?.[x.agentId]?.key !== 'rich'); plain(fan); fan.personality.traits = ['perfectionist']; fan.personality.values = ['傳統', '自然'];
      for (const a of npcs()) if (a !== fan) { a._p1 = { t: (a.personality.traits || []).slice(), v: (a.personality.values || []).slice() }; a.personality.traits = (a.personality.traits || []).filter(x => x !== 'perfectionist'); a.personality.values = (a.personality.values || []).filter(x => x !== '傳統' && x !== t('傳統')); }
      DEMOLISH.S(w).last = {}; B.demoAt = null; const p = BIZ.demoDaily(w);
      S8.prop = { made: !!p, by: p?.proposerId === fan.agentId, ref: p?.refKey === 'p:' + vf.id, kind: p?.kind, title: p ? w.proposals.title(p) : '' }; texts.push(S8.prop.title, p ? String(p.description || p.desc || '') : '');
      const v = p ? DEMOLISH.vote(w, p, npcs().find(a => a !== fan)) : null; S8.vote = v ? ['for', 'against'].includes(v.v) && !!VOTE_WHY[v.why] : false; if (v) texts.push(t(VOTE_WHY[v.why]));
      // 通過：攤位消失，那一格還給空地
      const res = p ? DEMOLISH.enact(w, p) : ''; app.state = w.getState(); for (let i = 0; i < 3; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); }
      const free = BIZ.freeOf(w, tm, null); S8.enact = { res: !!res, gone: !B.fronts.includes(vf), tileFree: free ? free(vf.x, vf.y) : null, sig: !String(tm._bizSig || '').includes(vf.id + ':') };
      restore(fan); for (const a of npcs()) if (a._p1) { a.personality.traits = a._p1.t; a.personality.values = a._p1.v; delete a._p1; } busyEnd(); }
    out.demo = S8;

    // 9a) 開智能體：題目送出、回答被採用
    { const o = {}; const ow = pool.find(x => w.agents[x.agentId] === x && !BIZ.shopOf(w, x) && (x.age ?? 30) >= 20); const s = openFor(ow, 'inn'); setCash(ow, 100); s.lossDays = 10; s.till = -12; s.failAsk = null;
      const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; ce._askJson = async (p) => { prompts.push(String(p)); return [{ n: 1, pick: 'prop', why: 'model reason 61', feel: 'stubborn' }]; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { X._gAsked = { work: 0 }; X._kAsked = {}; X._cDay = day(); const n0 = seen.length; const c0 = cash(ow); BIZ.askFail(w, s, day()); const pending = seen.length === n0; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).pop(); o.ai = { pending, e, paid: r3(c0 - cash(ow)), till: s.till, work: X._gAsked.work };
        const p = prompts[0] || ''; const i0 = p.indexOf(t('【遇到的事】')); const part = i0 >= 0 ? p.slice(i0) : p;
        o.prompt = { n: prompts.length, facts: part.includes('12'), codes: /prop＝/.test(p) && /close＝/.test(p), cjkAll: /[一-鿿]/.test(p), cjkSample: (p.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] }; }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }

    // 9b) 放著跑 30 天
    { const errs0 = []; const d0 = day(); MM.lastT = MONEY.total(w) - MM.pend; delete (MM.days[d0] || {}).other; const n0 = seen.length; const f0 = B.fronts.length;
      for (let i = 0; i < 30; i++) { const dd = w._absDay(); try { for (let j = 0; j < 400 && w._absDay() === dd; j++) { w.paused = false; w.tick(); } BIZ.syncMap(w, tm); } catch (e) { errs0.push(String(e.message)); } w.paused = true; if (i % 10 === 9) { app.state = w.getState(); app.render(); } await new Promise(r2 => setTimeout(r2, 0)); }
      let other = 0; for (const [kk, D] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(D.other || 0);
      const live = B.shops.filter(s => !s.closed); const bad = live.filter(s => s.front && !B.fronts.some(f => f.id === s.front && f.shop === s.id)).length; const dupe = B.fronts.length - new Set(B.fronts.map(f => f.x + ',' + f.y)).size;
      out.run = { errs: errs0.slice(0, 3), other: Math.round(other * 100) / 100, decided: seen.slice(n0).length, kinds: seen.slice(n0).reduce((m, e) => { m[e.kind + '.' + e.id.split(':')[0]] = (m[e.kind + '.' + e.id.split(':')[0]] || 0) + 1; return m; }, {}), shops: live.length, fronts: B.fronts.length, f0, bad, dupe, st: B.st }; }
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(0, 80);
    out.texts = texts.filter(Boolean).map(s => { try { return I18N.localizeNames ? I18N.localizeNames(s, true) : s; } catch (e) { return s; } });
    out.keys = [t('店一直在虧錢'), t('朋友的店找你合夥'), t('要不要接下留下來的店'), t('空店面'), t('🔒 {o}留下的「{n}」沒有人接，收掉了。'), t('💪 {a}自己掏了 {n} 銀幣貼進「{s}」，咬牙撐下去。'), t('🔑 {a}把「{n}」的店面頂讓給{b}，收了 {m} 銀幣頂讓金。'), t('🏪 {a}接下了{o}留下的「{n}」，店名照舊。'), t(VOTE_WHY.demolish_eyesore), t(VOTE_WHY.demolish_spare)];
    out.lastLogs = logs().slice(-40);
    return out; });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on, `${tag} 決策核心與地圖都開著`, { on: r.on, pop: r.pop });
  // 1
  ok(r.reg.every(x => x && x.scan === false && x.group === 'work' && x.title), `${tag} 登記了「店一直在虧錢」「朋友的店找你合夥」「要不要接下留下來的店」：由那一刻送進來，用 work 那一組的額度`, r.reg);
  // 2
  { const F = r.fronts;
    ok(F.shops >= 10 && F.withFront === F.shops && F.mapped, `${tag} 開店的每一家都拿到一格店面（${F.withFront}/${F.shops}）`, F);
    ok(F.grass && !F.road && F.inZone === 0 && F.unique, `${tag} 店面都在草地上：不壓路、水、建築、地點範圍、工廠地基，每格只有一家`, F);
    ok(F.maxRing <= 10 && F.rings.filter(x => x <= 2).length >= Math.min(6, F.shops), `${tag} 店面在廣場十格內，離廣場近的先用`, F.rings);
    ok(F.siteAvoid, `${tag} 之後找地方蓋新東西時會避開店面`, F); }
  // 3
  ok(r.save.same, `${tag} 存讀檔後每家店還在同一格`, r.save);
  ok(!r.old.err && r.old.n0 === 0 && r.old.shops > 0 && r.old.filled === r.old.shops, `${tag} 舊存檔（沒有店面）讀進來，每家店都補到一格`, r.old);
  ok(r.nospace.shop && r.nospace.front === null && r.nospace.inList && r.nospace.later, `${tag} 十格內都沒空地：店照開、沒有攤位（之後有空地再補）`, r.nospace);
  // 4
  { const Th = r.three;
    ok(Th.group && Th.meshes >= 1 && Th.meshes <= 3 && Th.v1 > 0, `${tag} 3D 有畫出攤位，整組併成 ${Th.meshes} 個網格（不是一個攤位一份）`, Th);
    ok(Th.labels1 === Th.openN && Th.labels2 === Th.openN - 1 && Th.diff, `${tag} 營業中的有招牌、收掉的沒有；收掉以後攤位的樣子變了`, Th);
    ok(Th.cOpen.open && Th.cOpen.biz && Th.cOpen.name && Th.cOpen.owner && Th.cOpen.week && Th.cOpen.days, `${tag} 點營業中的攤位：資訊卡有店名、老闆、開了多久、這週賺賠`, Th.cOpen);
    ok(Th.cIdle.open && Th.cIdle.biz && Th.cIdle.idle && Th.cIdle.prev, `${tag} 點空店面：資訊卡寫空了多久、上一家是誰`, Th.cIdle); }
  // 5
  { const F = r.fail; const hasA = (xs, ...ys) => ys.every(y => xs.includes(y)), none = (xs, ...ys) => ys.every(y => !xs.includes(y));
    ok(Object.values(F.factsHas).every(Boolean), `${tag} 給店主看的事實：店名、連虧幾天、店裡欠多少、最近一週賺賠、身上的錢、有沒有合夥人`, F.factsHas);
    ok(hasA(F.base, 'prop', 'cut', 'close', 'wait') && none(F.base, 'partner', 'sell'), `${tag} 平常：貼錢、降價、收掉、先撐著；沒有交情好又有錢的朋友不列合夥，沒人想接不列頂讓`, F.base);
    ok(hasA(F.full, 'partner', 'sell') && none(F.poor, 'prop') && none(F.cheap, 'cut'), `${tag} 只列做得到的：有朋友才列合夥、有人想接才列頂讓；錢不夠不列貼錢、價錢到底不列降價`, { full: F.full, poor: F.poor, cheap: F.cheap });
    ok(F.stale === 0 && F.notOwner === 0, `${tag} 過期的問題、不是店主的人沒有選項`, F);
    ok(F.prop.paid === 12 && F.prop.tres === 12 && F.prop.till === 0 && F.prop.ld === 0 && F.prop.leak === 0, `${tag} 貼錢：店主掏 12 銀幣補上欠的（付給公庫），店裡不欠了、連虧歸零`, F.prop);
    ok(F.cut.price === 3 && F.cut.leak === 0, `${tag} 降價：一份少 1 銀幣`, F.cut);
    ok(F.joinNo.asked && F.joinNo.who && F.joinNo.pick === 'no' && F.joinNo.partner === null && F.joinNo.leak === 0, `${tag} 找朋友合夥：對方被問了，不答應就不算`, F.joinNo);
    ok(F.joinYes.pick === 'join' && F.joinYes.partner && F.joinYes.friendPaid === 30 && F.joinYes.tres === 12 && F.joinYes.ownerGot === 18 && F.joinYes.till === 0 && F.joinYes.leak === 0 && F.noPartnerOpt, `${tag} 對方答應：出 30 銀幣，12 補店裡欠的、18 給店主，從此是合夥人（之後不再列合夥）`, F.joinYes);
    ok(F.sell.has && F.sell.closed && F.sell.tkPaid === 35 && F.sell.ownerGot === 35 && F.sell.newShop && F.sell.kind === F.sell.want && F.sell.sameFront && F.sell.frontShop && F.sell.leak === 0, `${tag} 頂讓：接手的人付 35 給店主，舊店收掉，他在同一個店面開自己那一行的店`, F.sell);
    ok(F.close.closed && !F.close.inList && F.close.front && F.close.idle && F.close.last && F.close.leak === 0, `${tag} 收掉：店沒了，店面留著掛空、記得上一家`, F.close);
    ok(F.lean.plain === 'prop' && F.lean.ambitious === 'prop' && F.lean.jealous === 'prop' && F.lean.thrifty === 'close' && F.lean.thriftyTaker === 'sell', `${tag} 照個性：不服輸、愛面子的貼錢撐；節儉又謹慎的收掉，有人要接就頂讓`, F.lean);
    ok(F.trigger.first === 1 && F.trigger.again === 0 && F.trigger.failAsk, `${tag} 每天的帳連虧到 10 天就問店主一次，七天內不再問`, F.trigger);
    ok(F.floor.closed, `${tag} 問過了還是連虧到 15 天：照原本的底線倒閉`, F.floor);
    ok(F.off.asked === 0 && F.off.closed, `${tag} 決策核心沒開：不問，照原本的規則倒閉`, F.off); }
  // 6
  { const T6 = r.take;
    ok(T6.reuse.vf && T6.reuse.cost === 35 && T6.reuse.paid === 35 && T6.reuse.sameFront && T6.reuse.leak === 0 && (T6.reuse.prevHere ? T6.reuse.prevGot === 35 : true), `${tag} 有空店面：頂下來只要 35，上一任還在鎮上就付給他`, T6.reuse);
    ok(T6.gone.paid === 35 && T6.gone.toHands === 35 && T6.gone.sameFront && T6.gone.leak === 0, `${tag} 上一任已經不在：35 付給木匠（沒有木匠進公庫）`, T6.gone);
    ok(T6.fresh.paid === 60 && T6.fresh.newFront, `${tag} 沒有空店面：照舊蓋新的，60 銀幣`, T6.fresh);
    ok(T6.startup.info && T6.startup.cost === 35 && T6.startup.mention, `${tag} 想不想開店的題目裡寫著有空店面、頂下來 35（蓋新的 60）`, T6.startup); }
  // 7
  { const H = r.heir;
    ok(H.partner.asked.length === 1 && H.partner.took && H.partner.partnerNull && H.partner.front, `${tag} 老闆過世：先問合夥人，接了店還在、攤位照開`, H.partner);
    ok(H.family.order.join(',') === 'spouse,child' && H.family.spouseFirst && H.family.kidTook, `${tag} 沒有合夥人：先問配偶、再問成年子女；配偶不接、孩子接了`, H.family);
    ok(H.none.asked >= 1 && H.none.closed && H.none.idle && H.none.last && H.none.log, `${tag} 沒人接：店收掉，攤位掛空，日誌有寫`, H.none);
    ok(H.facts.has && H.facts.n === 2, `${tag} 給接手的人看的事實有店名、誰留下的、自己是什麼身分`, H.facts);
    ok(H.away.open && H.away.asked === 0 && !H.away.heir, `${tag} 老闆出遠門：不算不在了，店先歇業、不問人`, H.away);
    ok(H.leaveFam.famFirst && H.leaveFam.took && H.leaveFam.spPaid === 0 && H.leaveFam.pPaid === 0 && !H.leaveFam.pAsked && H.leaveFam.leak === 0, `${tag} 老闆活著搬走：家人先問，家人接不用錢（合夥人沒被問、沒付錢）`, H.leaveFam);
    ok(H.leaveBuy.price > 0 && H.leaveBuy.ids.includes('take') && H.leaveBuy.took && H.leaveBuy.paid === H.leaveBuy.price && H.leaveBuy.toOwner && H.leaveBuy.factsPrice && H.leaveBuy.leak === 0, `${tag} 沒有家人：合夥人要照 sim-exile.js 的八折價（${H.leaveBuy.price} 銀幣）付錢才接得下，錢到搬走的老闆帳上，全鎮的錢沒變`, H.leaveBuy);
    ok(H.leaveBuy.settle && H.leaveBuy.settle.gone && H.leaveBuy.settle.leak === 0, `${tag} 錢包結算時，這筆錢記成「搬走的人帶走」，帳對得上`, H.leaveBuy.settle);
    ok(H.leavePoor.ids && H.leavePoor.ids.length === 1 && H.leavePoor.ids[0] === 'no' && H.leavePoor.closed, `${tag} 合夥人錢不夠：沒有「接下來」，只能不接，店收掉`, H.leavePoor);
    ok(!H.off.closed && H.off.auto && H.off.asked === 0 && H.off2.closed && H.off2.idle && H.off2.asked === 0, `${tag} 決策核心沒開：照原本的規則，合夥人直接接手；沒有合夥人、家人就收掉、攤位掛空`, { off: H.off, off2: H.off2 }); }
  // 8
  { const D = r.demo;
    ok(D.young.listed && D.young.ok === false && D.old.ok === true && D.old.age >= 30, `${tag} 空店面空不到 30 天不能提拆，空滿 30 天可以`, D);
    ok(D.prop.made && D.prop.by && D.prop.ref && D.prop.kind === 'demolish' && D.prop.title, `${tag} 在意的人（愛整潔、看重傳統）提案拆掉空店面，走一般的拆除提案`, D.prop);
    ok(D.vote, `${tag} 村民照自己的處境投票`, D.vote);
    ok(D.enact.res && D.enact.gone && D.enact.tileFree && D.enact.sig, `${tag} 通過後攤位從地圖上（含 3D）消失，那一格還給空地`, D.enact); }
  // 9
  { const Mi = r.mind;
    ok(Mi.aiOn && Mi.ai && Mi.ai.pending && Mi.ai.e && Mi.ai.e.id === 'prop' && Mi.ai.e.src === 'ai' && Mi.ai.e.reason === 'model reason 61' && Mi.ai.paid === 12 && Mi.ai.till === 0 && Mi.ai.work === 1, `${tag} 開智能體：題目送出、等回話，採用它選的「貼錢」與理由，用 work 那一組的額度`, Mi.ai);
    ok(Mi.prompt && Mi.prompt.n === 1 && Mi.prompt.facts && Mi.prompt.codes, `${tag} 題目裡有帳目與選項代號`, Mi.prompt);
    ok(zh || (Mi.prompt && !Mi.prompt.cjkAll), `${tag} 英文題目裡沒有中文`, zh ? null : Mi.prompt);
    const Ru = r.run; ok(Ru.errs.length === 0 && Ru.other === 0 && Ru.bad === 0 && Ru.dupe === 0, `${tag} 放著跑 30 天：沒有錯誤、帳上沒有對不上的錢、每家店的店面對得上、沒有兩家擠一格`, Ru); console.log('   ', JSON.stringify(Ru)); }
  ok(zh || (!r.keys.some(cjk) && !r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 新句子、事實、選項、理由、結果、資訊卡與提案都有英文`, zh ? null : { keys: r.keys.filter(cjk), texts: r.texts.filter(cjk).slice(0, 4), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
