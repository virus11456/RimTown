// v11.14.0 房子：買賣房子、蓋出租屋、公有房舍、請人幫傭由本人決定（盤點第 4 節 W1～W5）
//   A) 公有房舍標售：首長定這陣子賣不賣(townSale)；出得起的前三位各自決定買不買(houseBuy t:'pub')，先說要的買到
//   B) 撐不下去的屋主：撐著／拿出來賣／拿去抵押(homeSell t:'ask')；買的人照開價買／只出八折／不買(houseBuy t:'home')；有人只出八折時屋主答不答應(homeSell t:'bid')
//   C) 鎮上缺房子：夠格的人蓋不蓋、要不要借錢蓋(buildRent)
//   D) 有人睡在廣場、一間空屋都沒有：公庫蓋不蓋由首長決定(townBuild)；首長不在就照原本的規則直接蓋
//   E) 幫傭：主人請不請、請誰(hireHelp t:'hire')；被請的人去不去(helpOffer)；主人錢少了辭不辭退(hireHelp t:'keep')
//   共同：登記與額度、事實與選項、每個選項的後果、錢守恆、住處一致（每一戶最多住一處、屋主都還在）、回話晚到作廢、決策核心沒開時跟以前一樣、
//         照個性的比例、存讀檔、開 AI、英文沒有殘留中文、放著跑 30 天
// 用法：BASE=http://localhost:8199/ node scripts/v111400_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8199/'; const LONG = +(process.env.LONG || 30);
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const KEYS = ['houseBuy', 'homeSell', 'buildRent', 'townSale', 'townBuild', 'hireHelp', 'helpOffer'];
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`);
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { const x = m.text(); if (/\[(Estate|Bank|Biz|Money|Procure|Housing)\]/.test(x) || /\[Decide\] (run|options|ai|past) /.test(x)) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 300)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async ({ KEYS, LONG }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 114 }); w.observerMode = true; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    try { // 中途出錯時把已經做完的部分帶回去（out.fatal），方便看是哪一段
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tick1(); tick1(); out.on = DECIDE.on(w) && ESTATE.hsOn(w);
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const X0 = DECIDE.S(w); const KK = DECIDE.KINDS; const texts = []; const E = ESTATE.S(w); const H = E.hs; const logs = () => (w.messageLog || []).map(m => String(m.content || ''));
    const seen = [], asked = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && KEYS.concat('bankDesk').includes(o.K.key)) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, t: o.ctx?.t || '', reason: tx(o.why), res: tx(o.res) }); if (ev === 'asked' && KEYS.includes(o.kind)) asked.push({ kind: o.kind, who: o.a.agentId, ctx: o.ctx }); });
    const plain = (a) => { a.personality.traits = []; a.personality.values = []; a.moodModifier = 0; };
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const c = cash(a); if (c > n) WALLET.take(w, a, c - n); else if (n > c) WALLET.add(w, a, n - c); };
    const setAff = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const zeroAff = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) r.affinity = 0; for (const o of npcs()) { const r = o.relationships?.relationships?.[a.agentId]; if (r) r.affinity = 0; } };
    const ids = (K, a, c) => K.options(w, a, c).map(o => String(o.id).split(':')[0]);
    const opOf = (K, a, c, id) => K.options(w, a, c).find(o => String(o.id) === id || String(o.id).split(':')[0] === id);
    // 不經過決策核心，直接執行某一項（問人的那一步先攔下來，回傳被問到的人）
    const capture = (fn) => { const got = []; const an = DECIDE.askNow; DECIDE.askNow = (w2, list) => { for (const x of list || []) if (x && x.a) got.push({ kind: x.kind, who: x.a.agentId, ctx: x.ctx }); }; let ret; try { ret = fn(); } finally { DECIDE.askNow = an; } return { got, ret }; };
    const runOp = (K, a, c, id) => { const op = opOf(K, a, c, id); if (!op) return { miss: 1, got: [] }; const C = capture(() => op.run(w, a, c)); DECIDE.record(w, X0, a, K, op, op.why || null, C.ret, 'rule', day(), c); return { res: C.ret, got: C.got, txt: tx(C.ret) }; };
    const collect = (K, a, c) => { try { texts.push(t(K.title), K.facts(w, a, c)); for (const o of K.options(w, a, c)) texts.push(tx(o.text), tx(o.say), tx(o.why)); } catch (e) { texts.push('ERR ' + e.message); } };
    const prompts = {}; const mkPrompt = (k, a, c, kind) => { try { const K = KK[kind || k]; const opts = K.options(w, a, c); if (!opts.length) { prompts[k] = 'ERR no options'; return; } prompts[k] = DECIDE.prompt(w, K, [{ a, ctx: c, opts }]); } catch (e) { prompts[k] = 'ERR ' + e.message; } };
    const offDecide = (fn) => { const on0 = DECIDE.on; DECIDE.on = () => false; try { return fn(); } finally { DECIDE.on = on0; } };
    const memHas = (a, k) => (a.memory?.entries || []).some(e => e.k === k);
    const has = (s, a) => s.includes(a.name) || s.includes(t(a.name)) || (typeof I18N !== 'undefined' && I18N.localizeNames ? s.includes(I18N.localizeNames(a.name, true)) : false);
    const pick = (K, a, c) => { const ops = K.options(w, a, c); const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op); if (s > bs) { bs = s; best = op; } } return best ? String(best.id).split(':')[0] : null; };
    // 照個性那條路的比例：把鎮上每個人的個性輪流套在同一個情境上，加上當天心情起伏（固定種子），看選到某幾項的比例
    let seedS = 12345; const rng = () => { seedS = (seedS * 1103515245 + 12345) & 0x7fffffff; return seedS / 0x7fffffff; };
    const rate = (K, a, c, okIds, N = 800) => { const pool = npcs().filter(x => (x.age ?? 30) >= 16); const keep = JSON.parse(JSON.stringify(a.personality)); let hit = 0, n = 0;
      try { for (let i = 0; i < N; i++) { const src = pool[i % pool.length]; a.personality.traits = (src.personality.traits || []).slice(); a.personality.values = (src.personality.values || []).slice(); const ops = K.options(w, a, c); if (ops.length < 2) continue; const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s2 = DECIDE.score(Ln, op) + (rng() - 0.5) * 1.8; if (s2 > bs) { bs = s2; best = op; } } n++; if (okIds.includes(String(best.id).split(':')[0])) hit++; } } finally { a.personality = Object.assign(a.personality, keep); }
      return n ? Math.round(hit / n * 1000) / 1000 : null; };
    const rates = {};
    // 住處一致：每一戶最多住一處、登記的住處跟房子上寫的對得上、沒有同時「有住處又無家可歸」、屋主都是還在的人
    const houseBad = () => { const bad = []; const cnt = {}; for (const u of Object.values(E.units)) { for (const hid of [u.occ, ...(u.lodgers || [])].filter(Boolean)) { if (String(hid).startsWith('ghost_')) continue; cnt[hid] = (cnt[hid] || 0) + 1; if (E.home[hid] !== u.id) bad.push('mismatch ' + hid); } if (u.owner && (!w.agents[u.owner] || w.agents[u.owner].isDead) && !w.isAway?.(u.owner)) bad.push('owner gone ' + u.id); }
      for (const [hid, n] of Object.entries(cnt)) if (n > 1) bad.push('twice ' + hid); for (const hid of Object.keys(E.home)) { if (E.homeless[hid] !== undefined) bad.push('home+homeless ' + hid); if (!E.units[E.home[hid]]) bad.push('no unit ' + hid); } return bad; };
    for (const a of npcs()) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; }
    const hh0 = ESTATE.households(w); const alone = (a) => (a.age ?? 30) >= 22 && (a.age ?? 30) <= 60 && ESTATE.headOf(w, a) === a && (hh0.get(a.agentId) || []).length === 1 && !w.isAway?.(a.agentId) && E.home[a.agentId] && !E.lodge[a.agentId];
    const L = ESTATE.hsLeader(w); const used = new Set(); if (L) used.add(L.agentId); if (w.bank?.banker) used.add(w.bank.banker);
    const take = (f) => { const a = npcs().find(x => !used.has(x.agentId) && alone(x) && x.job?.key !== 'mayor' && (!f || f(x))); if (a) { used.add(a.agentId); plain(a); zeroAff(a); } return a; };
    const unitOf = (a) => E.units[E.home[ESTATE.headOf(w, a).agentId]]; const inPub = (x) => { const u = unitOf(x); return u && !u.owner && u.occ === x.agentId; };
    // 全鎮先壓到每人最多 50 銀幣、最少 15 銀幣（多的放進公庫、少的由公庫補），情境裡的有錢人與窮人各自再設
    for (const o of npcs()) { const c = cash(o); if (c > 50) { WALLET.take(w, o, c - 50); w.stockpile.add('silver', c - 50, w.tickCount, 'test park'); } else if (c < 15) WALLET.add(w, o, 15 - c); }
    w.stockpile.add('silver', 6000, w.tickCount, 'test'); w.stockpile.add('wood', 200, w.tickCount, 'test'); w.stockpile.add('stone', 200, w.tickCount, 'test'); if (w.bank) { w.bank.open = true; w.bank.reserve = (w.bank.reserve || 0) + 2000; w.bank.status = w.bank.status === 'run' ? 'ok' : w.bank.status; }
    for (const u of Object.values(E.units)) if (u.owner && cash(w.agents[u.owner] || {}) < 3) { /* 沒事：只是確認不丟錯 */ }
    out.pop = npcs().length; out.leader = !!L; out.bad0 = houseBad();
    const b1 = take(inPub), b2 = take(inPub), b3 = take(inPub); const price0 = ESTATE.valueOf(w, Object.values(E.units).find(u => !u.owner));
    const rich = (n1, n2, n3) => { setCash(b1, n1); setCash(b2, n2); setCash(b3, n3); };

    // 0) 登記
    out.reg = KEYS.map(k => KK[k] ? { k, scan: KK[k].scan, g: KK[k].aiGroup || null, kind: KK[k].aiKind || null, title: t(KK[k].title) } : { k, missing: 1 });
    out.total = Object.keys(KK).length; out.group = DECIDE.AI_GROUP.house;

    // ============ A 公有房舍標售 ============
    const A = {}; out.A = A; { rich(900, 700, 500); const hh = ESTATE.households(w); const pubs = () => Object.values(E.units).filter(u => !u.owner);
      const C1 = capture(() => ESTATE.marketBy(w, hh)); const sale = C1.got.filter(x => x.kind === 'townSale'); const hb = C1.got.filter(x => x.kind === 'houseBuy' && x.ctx.t === 'pub');
      A.ask = { leader: sale.length === 1 && sale[0].who === L?.agentId, buyers: hb.length, units: new Set(hb.map(x => x.ctx.uid)).size, who: [...new Set(hb.map(x => x.who))].sort().join() === [b1, b2, b3].map(x => x.agentId).sort().join(), q: hb.every(x => (x.ctx.q || []).length === 3), price: hb.every(x => x.ctx.price === ESTATE.valueOf(w, E.units[x.ctx.uid])), once: capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'townSale').length };
      // 首長：這陣子賣不賣
      const KS = KK.townSale; const cs = { t: 'sale', d: day() }; const fs = KS.facts(w, L, cs); collect(KS, L, cs); mkPrompt('townSale', L, cs);
      const occ = pubs().filter(u => u.occ); A.saleFacts = { n: fs.includes(String(pubs().length)), k: fs.includes(String(occ.length)), tr: fs.includes(String(Math.floor(w.stockpile.get('silver')))), cur: fs.includes(t('照常標售，誰出得起就賣')), buyers: /3 個人出得起|3 people in town can afford/.test(fs) };
      A.saleIds = ids(KS, L, cs).join(); A.saleNotLeader = KS.options(w, b1, cs).length; rates.townSale_hold = rate(KS, L, cs, ['hold']); rates.townSale_vacant = rate(KS, L, cs, ['vacant']);
      const rH = runOp(KS, L, cs, 'hold'); A.hold = { mode: H.pub?.mode, by: H.pub?.by === L.agentId, log: logs().slice(-15).some(x => x.includes('🏘️')), mem: memHas(L, '我決定公有房舍{x}。'), asked: capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'houseBuy').length, voidBuy: KK.houseBuy.options(w, b1, hb[0].ctx).length, cur: KS.facts(w, L, cs).includes(t('這陣子都不標售')) };
      runOp(KS, L, cs, 'vacant'); const Cv = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'houseBuy'); A.vacant = { mode: H.pub?.mode, asked: Cv.length, allVacant: Cv.every(x => !E.units[x.ctx.uid].occ), occVoid: KK.houseBuy.options(w, b1, { t: 'pub', uid: occ[0].id, price: ESTATE.valueOf(w, occ[0]), d: day(), q: [] }).length };
      runOp(KS, L, cs, 'open'); A.open = { mode: H.pub?.mode }; A.saleOld = KS.options(w, L, { t: 'sale', d: day() - 2 }).length;
      // 買的人：一棟有人租的（房客不是自己）
      const uT = occ.find(u => ![b1, b2, b3].some(b => b.agentId === u.occ) && w.agents[u.occ]); const tenant = w.agents[uT.occ]; const K = KK.houseBuy; const price = ESTATE.valueOf(w, uT); const c = { t: 'pub', uid: uT.id, price, d: day(), q: [b1.agentId, b2.agentId, b3.agentId] };
      const f = K.facts(w, b1, c); collect(K, b1, c); mkPrompt('houseBuy_pub', b1, c, 'houseBuy');
      A.facts = { price: f.includes(String(price)), tenant: has(f, tenant), cash: f.includes('900'), left: f.includes(String(900 - price)), others: has(f, b2) && has(f, b3), own: f.includes(t('你名下還沒有房子')), town: f.includes(String(Object.keys(E.units).length)) };
      A.ids = ids(K, b1, c).join(); rates.houseBuy_pub = rate(K, b1, c, ['buy']);
      // 自己租的那一棟
      const uS = unitOf(b3); const cS = { t: 'pub', uid: uS.id, price: ESTATE.valueOf(w, uS), d: day(), q: [b3.agentId] }; const fS = K.facts(w, b3, cS); collect(K, b3, cS); A.self = { facts: fS.includes(fill('這就是你們家現在租的那一棟，買下來以後不用再付每週 {r} 銀幣的房租，改成每週繳一點地價稅。', { r: ESTATE.rentOf(w, uS, uS.occ) })) };
      b3.personality.traits = []; const mSelf = (() => { const ops = K.options(w, b3, cS); return r3(ops.find(o => o.id === 'buy').base); })(); const mOther = (() => { const ops = K.options(w, b3, c); return r3(ops.find(o => o.id === 'buy').base); })(); A.self.keener = mSelf > mOther;
      // 晚一步的人：選項是同一輪先列好的
      const late = opOf(K, b2, c, 'buy'); const tr0 = w.stockpile.get('silver'); const sold0 = E.stats.sold || 0; const L1 = leak(() => runOp(K, b1, c, 'buy'));
      A.buy = { owner: uT.owner === b1.agentId, paid: r3(900 - cash(b1)), town: r3(w.stockpile.get('silver') - tr0), leak: L1.leak, sold: (E.stats.sold || 0) - sold0, log: logs().slice(-15).some(x => x.includes('🏘️') && has(x, b1)), mem: memHas(b1, '我買了一棟房子，可以收租了。'), tmem: memHas(tenant, '我們租的公有房舍被{b}買下了，以後房租要付給他。'), home: E.home[tenant.agentId] === uT.id && uT.occ === tenant.agentId, desc: has(String(ESTATE.describe(w, tenant)), b1), wk: H.wk?.pub };
      const L2 = leak(() => { const C = capture(() => late.run(w, b2, c)); return C.ret; }); A.late = { paid: r3(700 - cash(b2)), owner: uT.owner === b1.agentId, res: tx(L2.ret), isLate: tx(L2.ret) === fill('晚了一步，那棟房子已經被{o}買走了', { o: b1.name }), leak: L2.leak, void: K.options(w, b3, c).length };
      // 買自己租的那一棟
      const L3 = leak(() => runOp(K, b3, cS, 'buy')); A.selfBuy = { owner: uS.owner === b3.agentId, home: E.home[b3.agentId] === uS.id && uS.occ === b3.agentId, mem: memHas(b3, '我把我們家租的房子買下來了，以後不用再付房租。'), leak: L3.leak, desc: String(ESTATE.describe(w, b3)) === t('住自家的房子') || String(ESTATE.describe(w, b3)).startsWith(t('住自家的房子')) };
      // 作廢與做不到的
      H.wk = { d: day(), pub: 0, all: 0 }; const uN = pubs().find(u => u.occ && w.agents[u.occ] && u.occ !== b2.agentId); const cN = { t: 'pub', uid: uN.id, price: ESTATE.valueOf(w, uN), d: day(), q: [] }; A.void = { live: K.options(w, b2, cN).length };
      A.void.old = K.options(w, b2, Object.assign({}, cN, { d: day() - 2 })).length; setCash(b2, cN.price - 1); A.void.poor = K.options(w, b2, cN).length; setCash(b2, 700);
      w.civic.jail[b2.agentId] = day() + 3; A.void.jail = K.options(w, b2, cN).length; delete w.civic.jail[b2.agentId];
      const fake = []; for (let i = 0; i < 4; i++) { const id = 'TF' + i; E.units[id] = { id, owner: b2.agentId, occ: 'ghost_f' + i, lv: 0 }; fake.push(id); } A.void.cap = K.options(w, b2, cN).length; for (const id of fake) delete E.units[id]; // 700 銀幣最多三棟
      H.wk.pub = 2; A.void.week = K.options(w, b2, cN).length; H.wk.pub = 0;
      // 說不買：三週內不再問
      const pk0 = E.stats.hsPubPass || 0; runOp(K, b2, cN, 'pass'); const C3 = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'houseBuy'); A.pass = { cooled: H.buyNo[b2.agentId] === day(), stat: (E.stats.hsPubPass || 0) - pk0, asked: C3.some(x => x.who === b2.agentId), others: C3.some(x => x.who === b1.agentId), owner: !uN.owner, cash: cash(b2) }; delete H.buyNo[b2.agentId];
      // 照個性：小氣的不買，看重錢的買
      b2.personality.traits = ['thrifty', 'ascetic']; const pThr = pick(K, b2, cN); b2.personality.traits = ['greedy']; b2.personality.values = ['財富']; const pGr = pick(K, b2, cN); plain(b2); A.lean = { pThr, pGr };
      // 經過決策核心（照個性那條路）：三位都被問到，最多賣出一棟給先說要的人，錢進公庫
      { const o0 = K.options; K.options = (w2, a2, c2) => o0(w2, a2, c2).filter(o => o.id === 'buy'); const n2 = seen.length; const s0 = E.stats.sold || 0; const before = pubs().length; const T0 = MONEY.total(w), P0 = MM.pend; let err = null;
        try { DECIDE.askNow(w, [b1, b2, b3].map(a => ({ a, kind: 'houseBuy', ctx: Object.assign({}, cN, { q: [b1.agentId, b2.agentId, b3.agentId] }) }))); } catch (e) { err = String(e.message); } finally { K.options = o0; }
        const got = seen.slice(n2).filter(x => x.kind === 'houseBuy'); A.flow = { err, decided: got.length, sold: (E.stats.sold || 0) - s0, pubs: before - pubs().length, owner: uN.owner === b1.agentId, lateTxt: got.filter(x => x.res === fill('晚了一步，那棟房子已經被{o}買走了', { o: b1.name })).length, leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), log: (X0.log[b1.agentId] || []).some(e => e.kind === 'houseBuy' && e.id === 'buy') }; }
      // 決策核心沒開：跟以前一樣，最有錢的人直接買下，沒有人被問
      { rich(900, 60, 60); const na = asked.length; const s0 = E.stats.sold || 0; const own0 = ESTATE.ownsOf(w, b1.agentId).length; const Lo = leak(() => offDecide(() => capture(() => ESTATE.weekly(w, ESTATE.households(w), true))));
        A.off = { asked: asked.length - na + Lo.ret.got.length, sold: (E.stats.sold || 0) - s0, b1: ESTATE.ownsOf(w, b1.agentId).length - own0, leak: Lo.leak };
        setCash(b1, 900); const s1 = E.stats.sold || 0; const C4 = capture(() => ESTATE.market(w, ESTATE.households(w))); A.direct = { asked: C4.got.length, sold: (E.stats.sold || 0) - s1 }; }
      A.bad = houseBad(); }

    // ============ B 撐不下去的屋主 ============
    const B = {}; out.B = B; { const K = KK.homeSell, KB = KK.houseBuy; const mk = () => { H.wk = { d: day(), pub: 0, all: 0 }; /* 每個情境算新的一週（一週最多成交三筆） */ const o = take(inPub); const u = unitOf(o); u.owner = o.agentId; setCash(o, 2); MARKET.S(w).hungry[o.agentId] = 3; return { o, u }; };
      rich(900, 700, 180); for (const u of Object.values(E.units)) if (u.owner === b1.agentId || u.owner === b2.agentId || u.owner === b3.agentId) u.owner = null; // 前一段買的都還給鎮上，三位名下沒有房子
      const { o, u } = mk(); const price = ESTATE.valueOf(w, u), low = Math.round(price * 0.8); const hh = ESTATE.households(w);
      const C1 = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'homeSell'); B.ask = { n: C1.length, who: C1[0]?.who === o.agentId, t: C1[0]?.ctx?.t, uid: C1[0]?.ctx?.uid === u.id };
      const c = { t: 'ask', uid: u.id, d: day() }; const f = K.facts(w, o, c); collect(K, o, c); mkPrompt('homeSell_ask', o, c, 'homeSell'); const mort = ESTATE.mortInfo(w, o);
      B.facts = { cash: /只剩 2 銀幣|only 2 silver left/.test(f), hungry: /已經 3 天沒吃飽|not eaten properly for 3 days/.test(f), price: f.includes(String(price)), low: f.includes(String(low)), buyers: has(f, b1) && has(f, b2) && !has(f, b3), rent: f.includes(String(Math.max(2, Math.round(ESTATE.rentOf(w, { id: 'x', owner: 'nobody', lv: u.lv }))))), mort: !!mort && f.includes(String(mort.n)) };
      B.ids = ids(K, o, c).join(); rates.homeSell_sell = rate(K, o, c, ['sell']); rates.homeSell_mort = rate(K, o, c, ['mortgage']); rates.homeSell_hold = rate(K, o, c, ['hold']);
      { w.bank.open = false; B.noBank = ids(K, o, c).join(); rates.homeSell_sell_nomort = rate(K, o, c, ['sell']); rich(60, 60, 60); B.nothing = ids(K, o, c).join(); B.notAsked = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'homeSell').length; w.bank.open = true; B.noBuyer = ids(K, o, c).join(); B.noBuyerFacts = K.facts(w, o, c).includes(t('鎮上現在沒有人買得起這棟房子。').trim()); rich(900, 700, 180); }
      // 照個性：餓得久、家裡有小孩的比較會賣；看重傳統的比較會撐
      { const m1 = (() => { MARKET.S(w).hungry[o.agentId] = 6; const x = r3(opOf(K, o, c, 'sell').base); MARKET.S(w).hungry[o.agentId] = 3; return x; })(); const m0 = r3(opOf(K, o, c, 'sell').base); o.personality.values = ['傳統']; const m2 = r3(opOf(K, o, c, 'sell').base); plain(o); B.lean = { hungrier: m1 > m0, trad: m2 < m0 }; }
      // 撐著：什麼都不動
      const Lh = leak(() => runOp(K, o, c, 'hold')); B.hold = { leak: Lh.leak, owner: u.owner === o.agentId, cash: cash(o), listed: !!H.sale[u.id] };
      // 拿出來賣：掛出去，出得起的人被問到
      const R1 = runOp(K, o, c, 'sell'); const q = R1.got.filter(x => x.kind === 'houseBuy'); const S1 = H.sale[u.id];
      B.list = { listed: !!S1 && S1.by === o.agentId && S1.price === price && S1.low === low, asked: q.length === 2 && q.every(x => x.ctx.t === 'home' && x.ctx.uid === u.id && x.ctx.tok === S1.tok), who: q.map(x => x.who).sort().join() === [b1.agentId, b2.agentId].sort().join(), log: logs().slice(-15).some(x => x.includes('📉') && has(x, o)), mem: memHas(o, '實在撐不下去，我把自己住的房子拿出來賣了。'), again: K.options(w, o, c).length, res: R1.txt };
      const cb = q[0]?.ctx || {}; const fb = KB.facts(w, b1, cb); collect(KB, b1, cb); mkPrompt('houseBuy_home', b1, cb, 'houseBuy');
      B.bfacts = { seller: has(fb, o), price: fb.includes(String(price)), low: fb.includes(String(low)), hungry: /他已經 3 天沒吃飽了|not eaten properly for 3 days/.test(fb), cash: fb.includes('900'), other: has(fb, b2) };
      B.bids = ids(KB, b1, cb).join(); setCash(b3, low + 5); B.bidsPoor = ids(KB, b3, cb).join(); setCash(b3, 180); B.kinVoid = KB.options(w, o, cb).length;
      rates.houseBuy_home_full = rate(KB, b1, cb, ['full']); rates.houseBuy_home_low = rate(KB, b1, cb, ['low']);
      { setAff(b1, o, 70); const friend = r3(opOf(KB, b1, cb, 'full').base - opOf(KB, b1, cb, 'low').base); setAff(b1, o, -40); const foe = r3(opOf(KB, b1, cb, 'full').base - opOf(KB, b1, cb, 'low').base); setAff(b1, o, 0); B.blean = { friend, foe, ok: friend > foe }; }
      // 照開價買：錢從買的人到屋主，房子過戶，屋主一家照樣住在原地
      const lateFull = opOf(KB, b2, cb, 'full'); const sold0 = E.stats.sold || 0; const Lf = leak(() => runOp(KB, b1, cb, 'full'));
      B.full = { owner: u.owner === b1.agentId, paid: r3(900 - cash(b1)), got: r3(cash(o) - 2), leak: Lf.leak, home: E.home[o.agentId] === u.id && u.occ === o.agentId && E.homeless[o.agentId] === undefined, sold: (E.stats.sold || 0) - sold0, gone: !H.sale[u.id], log: logs().slice(-15).some(x => x.includes('📉') && has(x, o) && has(x, b1)), smem: memHas(o, '把房子賣給{b}了，以後住在這裡要付房租。'), bmem: memHas(b1, '我花 {n} 銀幣買下{o}住的房子，他們一家改付房租給我。'), rent: has(String(ESTATE.describe(w, o)), b1), aff: (o.relationships.relationships[b1.agentId]?.affinity || 0) > 0 };
      const Ll = leak(() => capture(() => lateFull.run(w, b2, cb)).ret); B.late = { res: tx(Ll.ret), isLate: tx(Ll.ret) === fill('晚了一步，{o}的房子已經被{x}買走了', { o: o.name, x: b1.name }), paid: r3(700 - cash(b2)), leak: Ll.leak, void: KB.options(w, b2, cb).length };
      // 下一次收租：賣掉房子的人付房租給新屋主
      { setCash(o, 60); const rent = ESTATE.rentOf(w, u, o.agentId); let recv = 0; const add0 = WALLET.add; WALLET.add = function (ww, a, n) { if (a === b1) recv += n; return add0.apply(this, arguments); }; let Lw; try { Lw = leak(() => capture(() => ESTATE.weekly(w, ESTATE.households(w), false))); } finally { WALLET.add = add0; } B.rent = { paid: r3(60 - cash(o)) === rent, got: recv >= rent, leak: Lw.leak, rent }; }
      // 只出八折：問屋主；不答應就什麼都不動，答應就照八折成交
      rich(900, 700, 180); for (const x of Object.values(E.units)) if (x.owner === b1.agentId && x.occ !== b1.agentId) x.owner = null;
      const s2 = mk(); const c2 = { t: 'ask', uid: s2.u.id, d: day() }; const p2 = ESTATE.valueOf(w, s2.u), low2 = Math.round(p2 * 0.8); const R2 = runOp(K, s2.o, c2, 'sell'); const cb2 = R2.got[0].ctx;
      const Rb = runOp(KB, b1, cb2, 'low'); const bidAsk = Rb.got.find(x => x.kind === 'homeSell'); const cbid = bidAsk?.ctx || {};
      B.bid = { asked: !!bidAsk && bidAsk.who === s2.o.agentId && cbid.t === 'bid' && cbid.n === low2 && cbid.by === b1.agentId, noted: H.sale[s2.u.id]?.bids?.[b1.agentId] === low2, noMove: cash(b1) === 900 && s2.u.owner === s2.o.agentId, again: KB.options(w, b1, cb2).length, res: Rb.txt };
      const fbid = K.facts(w, s2.o, cbid); collect(K, s2.o, cbid); mkPrompt('homeSell_bid', s2.o, cbid, 'homeSell'); B.bidFacts = { who: has(fbid, b1), n: fbid.includes(String(low2)), price: fbid.includes(String(p2)), cash: /只剩 2 銀幣|only 2 silver left/.test(fbid) }; B.bidIds = ids(K, s2.o, cbid).join(); rates.homeSell_bid_take = rate(K, s2.o, cbid, ['take']);
      const Lr = leak(() => runOp(K, s2.o, cbid, 'refuse')); B.refuse = { leak: Lr.leak, owner: s2.u.owner === s2.o.agentId, cash: cash(b1) === 900 && cash(s2.o) === 2, mem: memHas(b1, '我出八折想買{o}的房子，他沒答應。'), listed: !!H.sale[s2.u.id], b2can: ids(KB, b2, cb2).join() };
      const Rb2 = runOp(KB, b2, cb2, 'low'); const cbid2 = Rb2.got.find(x => x.kind === 'homeSell')?.ctx || {}; const Lt = leak(() => runOp(K, s2.o, cbid2, 'take'));
      B.take = { owner: s2.u.owner === b2.agentId, paid: r3(700 - cash(b2)) === low2, got: r3(cash(s2.o) - 2) === low2, leak: Lt.leak, home: E.home[s2.o.agentId] === s2.u.id && s2.u.occ === s2.o.agentId, hag: E.stats.hsHaggled >= 1, log: logs().slice(-15).some(x => /八折|80%/.test(x) && has(x, b2)), aff: (s2.o.relationships.relationships[b2.agentId]?.affinity || 0) < 0, gone: !H.sale[s2.u.id] };
      // 經過決策核心（照個性那條路）：屋主選賣，買的人一位出八折、一位照開價，照開價的買到；出八折的那一筆自然作廢
      { rich(900, 700, 180); for (const x of Object.values(E.units)) if ((x.owner === b1.agentId && x.occ !== b1.agentId) || (x.owner === b2.agentId && x.occ !== b2.agentId)) x.owner = null;
        const s3 = mk(); const c3 = { t: 'ask', uid: s3.u.id, d: day() }; const p3 = ESTATE.valueOf(w, s3.u); const o1 = K.options, o2 = KB.options;
        K.options = (w2, a2, cc) => o1(w2, a2, cc).filter(x => (cc.t === 'ask' ? x.id === 'sell' : x.id === 'take')); KB.options = (w2, a2, cc) => o2(w2, a2, cc).filter(x => x.id === (a2 === b1 ? 'low' : 'full'));
        const n3 = seen.length; const T0 = MONEY.total(w), P0 = MM.pend; let err = null; try { DECIDE.askNow(w, [{ a: s3.o, kind: 'homeSell', ctx: c3 }]); } catch (e) { err = String(e.message); } finally { K.options = o1; KB.options = o2; }
        const got = seen.slice(n3); B.flow = { err, seq: got.map(x => x.kind + '.' + x.id.split(':')[0]).join(' '), owner: s3.u.owner === b2.agentId, b2paid: r3(700 - cash(b2)) === p3, b1paid: 900 - cash(b1), seller: r3(cash(s3.o) - 2) === p3, leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), home: E.home[s3.o.agentId] === s3.u.id }; }
      // 掛了兩天沒有人買：收掉
      { rich(900, 700, 180); const s4 = mk(); const c4 = { t: 'ask', uid: s4.u.id, d: day() }; const R4 = runOp(K, s4.o, c4, 'sell'); const cb4 = R4.got[0].ctx; ESTATE.hsDaily(w, day() + 1); const still = !!H.sale[s4.u.id]; ESTATE.hsDaily(w, day() + 2);
        B.expire = { still, gone: !H.sale[s4.u.id], mem: memHas(s4.o, '房子掛了兩天沒有人買，先不賣了。'), void: KB.options(w, b1, cb4).length, owner: s4.u.owner === s4.o.agentId };
        // 等回話的這段時間有了錢、搬走了：這件事就過去了
        setCash(s4.o, 80); B.void = { rich: K.options(w, s4.o, c4).length }; setCash(s4.o, 2); B.void.live = K.options(w, s4.o, c4).length; B.void.old = K.options(w, s4.o, Object.assign({}, c4, { d: day() - 2 })).length;
        MARKET.S(w).hungry[s4.o.agentId] = 0; B.void.fed = K.options(w, s4.o, c4).length; MARKET.S(w).hungry[s4.o.agentId] = 3;
        // 拿去抵押
        const Lm = leak(() => runOp(K, s4.o, c4, 'mortgage')); const loan = w.bank.loans[s4.o.agentId]; B.mort = { loan: !!loan, coll: loan?.collateral === s4.u.id, got: r3(cash(s4.o) - 2), leak: Lm.leak, owner: s4.u.owner === s4.o.agentId, n: loan?.principal };
        // 欠著銀行、身上沒錢的屋主也會被問；已經有貸款就不能再抵押
        setCash(s4.o, 1); MARKET.S(w).hungry[s4.o.agentId] = 0; B.debtor = { ids: ids(K, s4.o, c4).join(), facts: /還欠銀行|still owe the bank/.test(K.facts(w, s4.o, c4)) }; collect(K, s4.o, c4); delete w.bank.loans[s4.o.agentId]; s4.u.owner = null; }
      // 決策核心沒開：跟以前一樣，一定賣給最有錢的人，沒有人被問
      { rich(900, 60, 60); for (const x of Object.values(E.units)) if (x.owner === b1.agentId && x.occ !== b1.agentId) x.owner = null; const s5 = mk(); const p5 = ESTATE.valueOf(w, s5.u); const pubKeep = Object.values(E.units).filter(x => !x.owner); for (const x of pubKeep) x.owner = 'hold_test'; // 公有房舍先收起來，只看這一筆
        const Lo = leak(() => capture(() => ESTATE.market(w, ESTATE.households(w)))); for (const x of pubKeep) if (x.owner === 'hold_test') x.owner = null;
        B.off = { asked: Lo.ret.got.length, owner: s5.u.owner === b1.agentId, got: r3(cash(s5.o) - 2) === p5, leak: Lo.leak, home: E.home[s5.o.agentId] === s5.u.id }; }
      B.bad = houseBad(); }

    // ============ C 鎮上缺房子：蓋不蓋 ============
    const C = {}; out.C = C; { const K = KK.buildRent; rich(900, 700, 500); const ghosts = []; for (const u of Object.values(E.units)) if (!u.occ) { u.occ = 'ghost_' + u.id; ghosts.push(u); }
      const fakes = []; for (let i = 0; i < 40 && ESTATE.hsShort(w) < 2; i++) { E.homeless['fake_' + i] = day(); fakes.push('fake_' + i); } C.short = ESTATE.hsShort(w);
      const mayor0 = w.proposals._mayor, cur0 = w.election.currentMayor; const noLeader = (fn) => { w.proposals._mayor = () => null; w.election.currentMayor = () => null; try { return fn(); } finally { w.proposals._mayor = mayor0; w.election.currentMayor = cur0; } };
      const hh = ESTATE.households(w); const C1 = capture(() => ESTATE.marketBy(w, hh)).got; const q = C1.filter(x => x.kind === 'buildRent'); const c = q[0]?.ctx || {};
      C.ask = { n: q.length, who: q.map(x => x.who).sort().join() === [b1, b2, b3].map(x => x.agentId).sort().join(), need: H.bld?.need, tok: q.every(x => x.ctx.tok === H.bld?.tok), pub: C1.filter(x => x.kind === 'townBuild').length };
      const f = K.facts(w, b1, c); collect(K, b1, c); mkPrompt('buildRent', b1, c); const rentNew = Math.max(2, Math.round(ESTATE.rentOf(w, { id: 'x', owner: 'nobody', lv: 0 })));
      C.facts = { cost: f.includes(String(ESTATE.BLD_COST)), rent: f.includes(String(rentNew)), weeks: f.includes(String(Math.ceil(ESTATE.BLD_COST / rentNew))), cash: f.includes('900'), others: has(f, b2) && has(f, b3), units: f.includes(String(Object.keys(E.units).length)) };
      C.ids = ids(K, b1, c).join(); rates.buildRent_build = rate(K, b1, c, ['build']);
      b1.personality.traits = ['thrifty', 'ascetic']; const pThr = pick(K, b1, c); b1.personality.traits = ['ambitious']; b1.personality.values = ['財富']; const pAmb = pick(K, b1, c); plain(b1); C.lean = { pThr, pAmb };
      const late3 = opOf(K, b3, c, 'build'); const n0 = Object.keys(E.units).length; const wd0 = w.stockpile.get('wood'), st0 = w.stockpile.get('stone'); const bl0 = E.stats.built || 0; const n1 = logs().length;
      const L1 = leak(() => runOp(K, b1, c, 'build')); const nu = Object.values(E.units).find(u => u.built === day() && u.owner === b1.agentId);
      C.build = { units: Object.keys(E.units).length - n0, mine: !!nu && !nu.occ, paid: r3(900 - cash(b1)), wood: r3(wd0 - w.stockpile.get('wood')), stone: r3(st0 - w.stockpile.get('stone')), leak: L1.leak, built: (E.stats.built || 0) - bl0, got: H.bld.got, log: logs().slice(-15).some(x => x.includes('🏗️') && has(x, b1)), mem: memHas(b1, '我蓋了一棟房子出租。'), res: L1.ret.txt };
      nu.occ = 'ghost_' + nu.id; ghosts.push(nu); const L2 = leak(() => runOp(K, b2, c, 'build')); const nu2 = Object.values(E.units).find(u => u.built === day() && u.owner === b2.agentId); if (nu2) { nu2.occ = 'ghost_' + nu2.id; ghosts.push(nu2); }
      const L3 = leak(() => capture(() => late3.run(w, b3, c)).ret); C.slot = { second: !!nu2, got: H.bld.got, units: Object.keys(E.units).length - n0, lateTxt: tx(L3.ret) === t('晚了一步，這週要蓋的房子已經有人蓋了'), paid3: 500 - cash(b3), leak: r3(L2.leak + L3.leak), void: K.options(w, b3, c).length };
      // 說不蓋：三週內不再問；沒有料就不問
      const C2 = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'buildRent'); const c2 = C2[0]?.ctx || {}; runOp(K, b3, c2, 'pass'); const C3 = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'buildRent');
      C.pass = { cooled: H.bldNo[b3.agentId] === day(), asked: C3.some(x => x.who === b3.agentId), others: C3.length }; delete H.bldNo[b3.agentId];
      const wd = w.stockpile.get('wood'); w.stockpile.consume('wood', wd, w.tickCount, 'test'); C.noMat = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'buildRent').length; w.stockpile.add('wood', wd, w.tickCount, 'test');
      // 沒有人自己出得起：問有工作、手上有點錢、借得到錢的人；借到了就蓋
      rich(30, 30, 30); const bor = npcs().find(x => !used.has(x.agentId) && alone(x) && x.job && !w.bank.loans[x.agentId]); used.add(bor.agentId); plain(bor); setCash(bor, 60); for (const o of npcs()) if (o !== bor && cash(o) >= 35 && ![b1, b2, b3].includes(o)) setCash(o, 30); // 前面賣房子拿到錢的人也壓下來：鎮上沒有人自己出得起
      const C4 = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'buildRent'); const cl = C4.find(x => x.who === bor.agentId)?.ctx || {}; const fl = K.facts(w, bor, cl); collect(K, bor, cl); mkPrompt('buildRent_loan', bor, cl, 'buildRent'); const need = Math.max(20, ESTATE.BLD_COST + 15 - 60);
      C.loanAsk = { asked: C4.some(x => x.who === bor.agentId), ids: ids(K, bor, cl).join(), facts: fl.includes(String(need)) && /45/.test(fl) }; rates.buildRent_loan = rate(K, bor, cl, ['loan']);
      { const KD = KK.bankDesk; const od = KD.options; KD.options = (w2, a2, cc) => od(w2, a2, cc).filter(x => cc?.t !== 'loan' || x.id === 'lend'); const n2 = Object.keys(E.units).length; const T0 = MONEY.total(w), P0 = MM.pend; let res = null, err = null; try { res = opOf(K, bor, cl, 'loan').run(w, bor, cl); } catch (e) { err = String(e.message); } finally { KD.options = od; }
        const ln = w.bank.loans[bor.agentId]; const mine = Object.values(E.units).find(u => u.owner === bor.agentId && u.built === day()); if (mine) { mine.occ = 'ghost_' + mine.id; ghosts.push(mine); }
        C.loan = { err, res: tx(res), ln: ln ? { p: ln.principal, k: ln.kind, need } : null, loan: !!ln && ln.principal === need && ln.kind === 'biz', built: Object.keys(E.units).length - n2, mine: !!mine, cash: r3(cash(bor)), leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), log: logs().some(x => x.includes('🏦') && has(x, bor)) }; }
      // 已經不缺房：作廢
      rich(900, 700, 500); const C5 = capture(() => ESTATE.marketBy(w, hh)).got.filter(x => x.kind === 'buildRent'); const c5 = C5[0]?.ctx || {}; const live = K.options(w, b1, c5).length; const keepH = {}; for (const id of fakes) { keepH[id] = E.homeless[id]; delete E.homeless[id]; } for (const u of ghosts) u.occ = null;
      C.void = { live, notShort: K.options(w, b1, c5).length, short: ESTATE.hsShort(w), old: 0 }; for (const u of ghosts) u.occ = 'ghost_' + u.id; for (const id of fakes) E.homeless[id] = keepH[id]; C.void.old = K.options(w, b1, Object.assign({}, c5, { d: day() - 2 })).length;
      // 決策核心沒開：跟以前一樣，最有錢的人直接蓋，沒有人被問
      { const n3 = Object.keys(E.units).length; const pubKeep = Object.values(E.units).filter(x => !x.owner); for (const x of pubKeep) x.owner = 'hold_test'; const Lo = leak(() => noLeader(() => capture(() => ESTATE.market(w, ESTATE.households(w))))); for (const x of Object.values(E.units)) if (x.owner === 'hold_test') x.owner = null;
        const built = Object.values(E.units).filter(u => u.built === day() && !u.occ); C.off = { asked: Lo.ret.got.length, built: Object.keys(E.units).length - n3, byRich: built.some(u => u.owner === b1.agentId), leak: Lo.leak }; for (const u of built) { u.occ = 'ghost_' + u.id; ghosts.push(u); } }
      C.bad = houseBad(); out._c = { ghosts: ghosts.map(u => u.id), fakes }; out._noLeader = 1;

    // ============ D 有人睡在廣場、一間空屋都沒有：公庫蓋不蓋 ============
      const D = {}; out.D = D; { const KT = KK.townBuild; rich(60, 60, 60); for (const id of fakes) delete E.homeless[id]; // 換成真的有人睡在廣場
        const aged = () => { for (const u of Object.values(E.units)) if (u.built === day()) u.built = day() - 1; }; aged(); // 今天已經蓋的不算進「這週蓋了幾棟」（原本的規則：私人今天蓋夠了，公庫就不蓋）
        const evictOne = () => { const h = take(inPub); const u = unitOf(h); ESTATE.evict(w, h.agentId, 'test'); u.occ = 'ghost_' + u.id; ghosts.push(u); setCash(h, 45); return h; };
        const h1 = evictOne(), h2 = evictOne(); D.homeless = Object.keys(E.homeless).length; const hh2 = ESTATE.households(w);
        const Cq = capture(() => ESTATE.marketBy(w, hh2)).got.filter(x => x.kind === 'townBuild'); const c = Cq[0]?.ctx || {}; D.ask = { n: Cq.length, who: Cq[0]?.who === L.agentId, num: c.n, tok: c.tok === H.pubB?.tok };
        const f = KT.facts(w, L, c); collect(KT, L, c); mkPrompt('townBuild', L, c);
        D.facts = { h: /2 戶人家（2 個人）|2 households in town \(2 people\)/.test(f), cost: f.includes(String(ESTATE.PUB_COST)), tr: f.includes(String(Math.floor(w.stockpile.get('silver')))), budget: f.includes(String(Math.floor(TREASURY.budget(w)))), mat: /10/.test(f) && /6/.test(f) };
        D.ids = ids(KT, L, c).join(); D.notLeader = KT.options(w, b1, c).length; rates.townBuild_build = rate(KT, L, c, ['one', 'two']); rates.townBuild_two = rate(KT, L, c, ['two']);
        { const t0 = L.personality.traits, v0 = L.personality.values; L.personality.traits = ['thrifty', 'greedy']; L.personality.values = []; const mean = r3(opOf(KT, L, c, 'no').base - opOf(KT, L, c, 'one').base); L.personality.traits = ['kind', 'generous']; L.personality.values = ['社群']; const warm = r3(opOf(KT, L, c, 'no').base - opOf(KT, L, c, 'one').base); L.personality.traits = t0; L.personality.values = v0; D.lean = { mean, warm, ok: mean > warm }; }
        // 先不蓋：沒有房子，睡廣場的人記得
        const n0 = Object.keys(E.units).length; const tr0 = w.stockpile.get('silver'); const a0 = h1.relationships.getOrCreate(L.agentId, L.name).affinity || 0; const Ln = leak(() => runOp(KT, L, c, 'no'));
        D.no = { units: Object.keys(E.units).length - n0, tr: r3(tr0 - w.stockpile.get('silver')), leak: Ln.leak, log: logs().slice(-15).some(x => x.includes('🏚️') && has(x, L)), mem: memHas(h1, '我們沒地方住，{a}卻說公庫先不蓋房子。'), aff: (h1.relationships.relationships[L.agentId]?.affinity || 0) < a0, still: E.homeless[h1.agentId] !== undefined, again: KT.options(w, L, c).length };
        // v11.14.0 整合時加：同一位首長說過先不蓋，三週內不再問（以前每週都問、每週都扣睡廣場的人對他的好感）；過了三週、或換了首長，重新問
        { const q = () => capture(() => ESTATE.marketBy(w, hh2)).got.filter(x => x.kind === 'townBuild').length; const P = H.pubNo; const q1 = q(); P.d -= 20; const q20 = q(); P.by = 'someone_else'; const qNew = q(); P.by = L.agentId; P.d -= 1; const q21 = q(); D.quiet = { set: P.by === L.agentId, q1, q20, qNew, q21 }; }
        // 蓋一棟：公庫付錢、用掉料，睡廣場的人當下就搬進去
        aged(); const Cq2 = capture(() => ESTATE.marketBy(w, hh2)).got.filter(x => x.kind === 'townBuild'); const c2 = Cq2[0]?.ctx || {}; const wd0 = w.stockpile.get('wood'), st0 = w.stockpile.get('stone'); const pb0 = E.stats.publicBuilt || 0; const a1 = h2.relationships.getOrCreate(L.agentId, L.name).affinity || 0;
        const Lb = leak(() => runOp(KT, L, c2, 'one')); const housed = [h1, h2].filter(h => E.homeless[h.agentId] === undefined && E.home[h.agentId] && E.units[E.home[h.agentId]]?.pub);
        D.one = { units: Object.keys(E.units).length - n0, pub: (E.stats.publicBuilt || 0) - pb0, tr: r3(tr0 - w.stockpile.get('silver')), wood: r3(wd0 - w.stockpile.get('wood')), stone: r3(st0 - w.stockpile.get('stone')), leak: Lb.leak, housed: housed.length, still: Object.keys(E.homeless).length, log: logs().slice(-15).some(x => x.includes('🏗️') && has(x, L)), mem: memHas(L, '有人睡在廣場，我決定由公庫出錢蓋公有房舍。'), hmem: memHas(h2, '{a}決定由公庫蓋房子給沒地方住的人。'), aff: (h2.relationships.relationships[L.agentId]?.affinity || 0) > a1, res: Lb.ret.txt };
        // 蓋兩棟；公庫不夠就不列
        aged(); const h3 = evictOne(); const fk2 = []; for (let i = 0; i < 40 && ESTATE.hsShort(w) < 2; i++) { E.homeless['fk2_' + i] = day(); fk2.push('fk2_' + i); } const Cq3 = capture(() => ESTATE.marketBy(w, ESTATE.households(w))).got.filter(x => x.kind === 'townBuild'); const c3 = Cq3[0]?.ctx || {}; const n3 = Object.keys(E.units).length; const tr3 = w.stockpile.get('silver');
        const sp = w.stockpile; const all = sp.get('silver'); sp.consume('silver', all - 20, w.tickCount, 'test'); D.broke = { ids: ids(KT, L, c3).join(), asked: capture(() => ESTATE.marketBy(w, ESTATE.households(w))).got.filter(x => x.kind === 'townBuild').length }; sp.add('silver', all - 20, w.tickCount, 'test');
        D.twoIds = ids(KT, L, c3).join(); runOp(KT, L, c3, 'two'); for (const id of fk2) delete E.homeless[id]; D.two = { units: Object.keys(E.units).length - n3, tr: r3(tr3 - w.stockpile.get('silver')), homeless: Object.keys(E.homeless).length };
        for (const u of Object.values(E.units)) if (u.pub && u.built === day() && !u.occ) { u.occ = 'ghost_' + u.id; ghosts.push(u); }
        // 等回話的這段時間有空屋了、沒人睡廣場了：不用蓋
        aged(); const h4 = evictOne(); const Cq4 = capture(() => ESTATE.marketBy(w, ESTATE.households(w))).got.filter(x => x.kind === 'townBuild'); const c4 = Cq4[0]?.ctx || {}; const live = KT.options(w, L, c4).length; const g = ghosts[0]; g.occ = null; const vac = KT.options(w, L, c4).length; g.occ = 'ghost_' + g.id;
        D.void = { live, vac, old: KT.options(w, L, Object.assign({}, c4, { d: day() - 2 })).length, tok: KT.options(w, L, Object.assign({}, c4, { tok: -1 })).length };
        // 首長不在鎮上：照原本的規則，公庫直接蓋；決策核心沒開也一樣
        aged(); const n4 = Object.keys(E.units).length; const Cn = noLeader(() => capture(() => ESTATE.marketBy(w, ESTATE.households(w)))); ESTATE.rehouse(w); /* 每週流程裡蓋完就接著安置 */ D.noLeader = { asked: Cn.got.filter(x => x.kind === 'townBuild').length, built: Object.keys(E.units).length - n4, housed: E.homeless[h4.agentId] === undefined };
        for (const u of Object.values(E.units)) if (u.pub && u.built === day() && !u.occ) { u.occ = 'ghost_' + u.id; ghosts.push(u); }
        aged(); const h5 = evictOne(); const n5 = Object.keys(E.units).length; const pubKeep = Object.values(E.units).filter(x => !x.owner); for (const x of pubKeep) x.owner = 'hold_test'; const Lo = leak(() => capture(() => ESTATE.market(w, ESTATE.households(w)))); for (const x of Object.values(E.units)) if (x.owner === 'hold_test') x.owner = null;
        D.off = { asked: Lo.ret.got.length, built: Object.keys(E.units).length - n5, leak: Lo.leak }; ESTATE.rehouse(w); D.off.housed = E.homeless[h5.agentId] === undefined;
        D.bad = houseBad(); }
      for (const u of ghosts) if (String(u.occ).startsWith('ghost_')) u.occ = null; for (const id of fakes) delete E.homeless[id]; }

    // ============ E 幫傭 ============
    const Ev = {}; out.E = Ev; { const KH = KK.hireHelp, KO = KK.helpOffer; rich(60, 60, 60); for (const k of Object.keys(E.servants)) delete E.servants[k];
      const m = take(), s1 = take((x) => !ESTATE.ownsOf(w, x.agentId).length), s2 = take((x) => !ESTATE.ownsOf(w, x.agentId).length), s3 = take((x) => !ESTATE.ownsOf(w, x.agentId).length);
      for (const o of npcs()) if (![m, s1, s2, s3].includes(o) && cash(o) < 15) WALLET.add(w, o, 15 - cash(o)); setCash(m, 700); setCash(s1, 1); setCash(s2, 3); setCash(s3, 5);
      const C1 = capture(() => ESTATE.servantsBy(w)).got; const c = C1.find(x => x.kind === 'hireHelp')?.ctx || {}; Ev.ask = { n: C1.length, who: C1[0]?.who === m.agentId, t: c.t, pool: ESTATE.hsPool(w, m).slice(0, 3).map(x => x.agentId).join() === [s1, s2, s3].map(x => x.agentId).join(), again: capture(() => ESTATE.servantsBy(w)).got.length };
      const f = KH.facts(w, m, c); collect(KH, m, c); mkPrompt('hireHelp', m, c);
      Ev.facts = { cash: f.includes('700'), pay: f.includes(String(ESTATE.SERVANT_PAY)) && f.includes(String(ESTATE.SERVANT_PAY * 7)), list: has(f, s1) && has(f, s2) && has(f, s3) };
      const idsH = KH.options(w, m, c).map(o => String(o.id)); Ev.ids = { no: idsH.includes('no'), s1: idsH.includes('hire:' + s1.agentId), s2: idsH.includes('hire:' + s2.agentId), s3: idsH.includes('hire:' + s3.agentId), n: idsH.length }; rates.hireHelp_hire = rate(KH, m, c, ['hire']);
      { setAff(m, s2, 70); setAff(m, s1, -40); const best = (() => { const ops = KH.options(w, m, c); return ops.slice().sort((x, y) => y.base - x.base)[0].id; })(); setAff(m, s2, 0); setAff(m, s1, 0); m.personality.traits = ['thrifty', 'ascetic']; const pThr = pick(KH, m, c); plain(m); Ev.lean = { friend: best === 'hire:' + s2.agentId, pThr }; }
      // 不請：28 天內不再問
      const Rn = runOp(KH, m, c, 'no'); Ev.no = { servants: Object.keys(E.servants).length, asked: Rn.got.length };
      // 請某一位：問他去不去
      const Rh = runOp(KH, m, c, 'hire:' + s2.agentId); const off = Rh.got.find(x => x.kind === 'helpOffer'); const co = off?.ctx || {};
      Ev.hire = { asked: !!off && off.who === s2.agentId && co.m === m.agentId, pending: H.svOff[s2.agentId]?.m === m.agentId, notYet: !E.servants[s2.agentId], soon: H.svAsk[m.agentId] === day() - 21, res: Rh.txt };
      const fo = KO.facts(w, s2, co); collect(KO, s2, co); mkPrompt('helpOffer', s2, co);
      Ev.ofacts = { master: has(fo, m), pay: fo.includes(String(ESTATE.SERVANT_PAY)) && fo.includes(String(ESTATE.SERVANT_PAY * 7)), cash: /只剩 3 銀幣|only 3 silver left/.test(fo), mc: fo.includes('700') };
      Ev.oids = ids(KO, s2, co).join(); Ev.oNotMe = KO.options(w, s1, co).length; rates.helpOffer_go = rate(KO, s2, co, ['go']);
      { setAff(s2, m, -60); const foe = pick(KO, s2, co); const foeTxt = tx(opOf(KO, s2, co, 'no').why); setAff(s2, m, 0); MARKET.S(w).hungry[s2.agentId] = 3; const hungry = pick(KO, s2, co); MARKET.S(w).hungry[s2.agentId] = 0; Ev.olean = { foe, hungry, foeTxt: has(foeTxt, m) }; }
      const Lg = leak(() => runOp(KO, s2, co, 'go'));
      Ev.go = { servant: E.servants[s2.agentId] === m.agentId, off: !H.svOff[s2.agentId], leak: Lg.leak, log: logs().slice(-15).some(x => x.includes('🧹') && has(x, m) && has(x, s2)), smem: memHas(s2, '我到{m}家幫傭，一天 {n} 銀幣。'), mmem: memHas(m, '家裡請了{s}來幫傭。'), desc: has(String(ESTATE.describe(w, s2)), m), again: KO.options(w, s2, co).length };
      const cm0 = cash(m), cs0 = cash(s2); const Lp = leak(() => ESTATE.payServants(w)); Ev.pay = { m: r3(cm0 - cash(m)), s: r3(cash(s2) - cs0), leak: Lp.leak };
      // 第二位說不去：主人知道，這個人四週內不會再被同一位主人問
      const c2 = { t: 'hire', d: day() }; const Rh2 = runOp(KH, m, c2, 'hire:' + s3.agentId); const co2 = Rh2.got.find(x => x.kind === 'helpOffer')?.ctx || {}; const Ln = leak(() => runOp(KO, s3, co2, 'no'));
      Ev.refuse = { servant: !E.servants[s3.agentId], leak: Ln.leak, mmem: memHas(m, '我想請{s}來家裡幫傭，他沒答應。'), smem: memHas(s3, '{m}想請我去他家幫傭，我沒答應。'), pool: !ESTATE.hsPool(w, m).includes(s3), off: !H.svOff[s3.agentId] };
      // 作廢：等回話的這段時間主人錢少了、名額滿了
      const Rh3 = runOp(KH, m, c2, 'hire:' + s1.agentId); const co3 = Rh3.got.find(x => x.kind === 'helpOffer')?.ctx || {}; const live = KO.options(w, s1, co3).length; setCash(m, 100); const poorM = KO.options(w, s1, co3).length; setCash(m, 700); ESTATE.hsDaily(w, day() + 2);
      Ev.void = { live, poorM, expired: KO.options(w, s1, co3).length, hireOld: KH.options(w, m, { t: 'hire', d: day() - 2 }).length, hirePoor: (() => { setCash(m, 250); const n = KH.options(w, m, c2).length; setCash(m, 700); return n; })() };
      // 主人錢少了：辭不辭退由他決定
      setCash(m, 100); const Ck = capture(() => ESTATE.servantsBy(w)).got; const ck = Ck.find(x => x.kind === 'hireHelp' && x.ctx.t === 'keep')?.ctx || {}; const fk = KH.facts(w, m, ck); collect(KH, m, ck); mkPrompt('hireHelp_keep', m, ck, 'hireHelp');
      Ev.keepAsk = { asked: Ck.length === 1 && Ck[0].who === m.agentId && ck.t === 'keep', facts: fk.includes('100') && has(fk, s2), ids: ids(KH, m, ck).join(), again: capture(() => ESTATE.servantsBy(w)).got.length, still: E.servants[s2.agentId] === m.agentId }; rates.hireHelp_fire = rate(KH, m, ck, ['fire']);
      { setAff(m, s2, 70); m.personality.traits = ['kind', 'generous']; const warm = pick(KH, m, ck); setAff(m, s2, 0); m.personality.traits = ['thrifty', 'greedy']; const cold = pick(KH, m, ck); plain(m); Ev.klean = { warm, cold }; }
      const Lk = leak(() => runOp(KH, m, ck, 'keep')); Ev.keep = { still: E.servants[s2.agentId] === m.agentId, leak: Lk.leak };
      const Lf = leak(() => runOp(KH, m, ck, 'fire')); Ev.fire = { gone: !E.servants[s2.agentId], leak: Lf.leak, smem: memHas(s2, '{m}說請不起了，我被辭退了。'), log: logs().slice(-15).some(x => x.includes('🧹') && has(x, m) && has(x, s2)), void: KH.options(w, m, ck).length };
      // 付不出工錢那天幫傭的人照舊會走（原本的規則沒有動）
      E.servants[s2.agentId] = m.agentId; setCash(m, 1); ESTATE.payServants(w); Ev.cantPay = { gone: !E.servants[s2.agentId] };
      // 經過決策核心（照個性那條路）：主人說請、對方說去
      { setCash(m, 700); delete H.svAsk[m.agentId]; for (const k of Object.keys(H.svNo)) delete H.svNo[k]; const o1 = KH.options, o2 = KO.options; KH.options = (w2, a2, cc) => o1(w2, a2, cc).filter(x => x.id === 'hire:' + s1.agentId); KO.options = (w2, a2, cc) => o2(w2, a2, cc).filter(x => x.id === 'go');
        const n2 = seen.length; let err = null; const T0 = MONEY.total(w), P0 = MM.pend; try { ESTATE.servantsBy(w); } catch (e) { err = String(e.message); } finally { KH.options = o1; KO.options = o2; }
        Ev.flow = { err, seq: seen.slice(n2).filter(x => x.who === m.agentId || x.who === s1.agentId).map(x => x.kind + '.' + x.id.split(':')[0]).join(' '), servant: E.servants[s1.agentId] === m.agentId, leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)) }; }
      // 決策核心沒開：跟以前一樣，有錢就自動請最窮的人、對方一定去；錢少了自動辭退
      { for (const k of Object.keys(E.servants)) delete E.servants[k]; setCash(m, 700); setCash(s1, 1); setCash(s2, 3); const C5 = capture(() => ESTATE.servants(w)); const hired = Object.entries(E.servants).filter(([, x]) => x === m.agentId).map(([k]) => k);
        setCash(m, 100); ESTATE.servants(w); Ev.off = { asked: C5.got.length, hired: hired.length === 2 && hired.includes(s1.agentId) && hired.includes(s2.agentId), fired: !Object.values(E.servants).includes(m.agentId) };
        setCash(m, 3000); /* 這一趟原本的規則也會讓最有錢的人買公有房舍，錢給夠，買完還請得起人 */ const C6 = offDecide(() => capture(() => { ESTATE.weekly(w, ESTATE.households(w), true); })); Ev.off.viaWeekly = C6.got.length === 0 && Object.values(E.servants).includes(m.agentId); for (const k of Object.keys(E.servants)) delete E.servants[k]; }
      out.Em = m.agentId; out.Es = s1.agentId; }
    out.rates = rates; out.bad1 = houseBad();

    // ============ 存讀檔 ============
    { H.pub = { mode: 'vacant', by: L.agentId, d: day() }; H.sale.TEST = { by: b1.agentId, d: day(), price: 100, low: 80, tok: 9, bids: {} }; H.svNo['a|b'] = day();
      const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); let err = null, opErr = null; try { w2.loadSave(sv); w2.observerMode = true; } catch (e) { err = String(e.message); }
      try { const m2 = w2.agents[out.Em]; if (m2) { KK.hireHelp.options(w2, m2, { t: 'hire', d: day() }); KK.hireHelp.facts(w2, m2, { t: 'hire', d: day() }); } const x = w2.agents[b1.agentId]; if (x) KK.buildRent.options(w2, x, { d: day(), tok: 1 }); } catch (e) { opErr = String(e.message); }
      const sv2 = JSON.parse(JSON.stringify(sv)); delete sv2.estate.hs; const w3 = new World(); let err3 = null, hs3 = null; try { w3.loadSave(sv2); w3.observerMode = true; hs3 = ESTATE.S(w3).hs; } catch (e) { err3 = String(e.message); }
      out.SV = { err, opErr, pub: w2.estate?.hs?.pub?.mode === 'vacant', sale: w2.estate?.hs?.sale?.TEST?.price === 100, no: w2.estate?.hs?.svNo?.['a|b'] === day(), mode: ESTATE.pubMode(w2), err3, old: !!hs3 && typeof hs3.sale === 'object' && typeof hs3.buyNo === 'object' && ESTATE.pubMode(w3) === 'open' };
      delete H.sale.TEST; delete H.svNo['a|b']; H.pub = { mode: 'open', by: L.agentId, d: day() }; w2.reset?.(); w3.reset?.(); }

    // ============ 開 AI ============
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const ps = []; let reply = []; ce._askJson = async (p) => { ps.push(String(p)); return typeof reply === 'function' ? reply(String(p)) : reply; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) { const reset = () => { X0._gAsked = {}; X0._kAsked = {}; X0._asked = 0; X0._cDay = day(); X0.lastDay = day(); }; const settle = async () => { await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); };
        rich(900, 700, 60); for (const x of Object.values(E.units)) if ([b1.agentId, b2.agentId].includes(x.owner) && x.occ !== x.owner) x.owner = null; H.wk = { d: day(), pub: 0, all: 0 };
        // 買公有房舍：題目當場送出，回話來了才成交，理由寫進決定紀錄；用 house 那一組
        const u1 = Object.values(E.units).find(u => !u.owner && u.occ && w.agents[u.occ] && ![b1.agentId, b2.agentId].includes(u.occ)); const c1 = { t: 'pub', uid: u1.id, price: ESTATE.valueOf(w, u1), d: day(), q: [b1.agentId] };
        reset(); reply = [{ n: 1, pick: 'buy', why: 'model reason 114', feel: 'greed' }]; const n0 = seen.length; DECIDE.askNow(w, [{ a: b1, kind: 'houseBuy', ctx: c1 }]); const pending = !seen.slice(n0).some(e => e.kind === 'houseBuy') && !u1.owner; await settle();
        const e1 = seen.slice(n0).find(x => x.kind === 'houseBuy'); o.buy = { pending, id: e1?.id, src: e1?.src, reason: e1?.reason, group: X0._gAsked.house, owner: u1.owner === b1.agentId, rec: (X0.log[b1.agentId] || []).some(x => x.kind === 'houseBuy' && x.ai === 1 && tx(x.why) === 'model reason 114') };
        const p1 = ps.find(x => /pass＝/.test(x) && /buy＝/.test(x)) || ''; o.p1 = { codes: !!p1, cjk: /[一-鿿]/.test(p1), sample: (p1.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 回話晚到：等的這段時間房子被別人買走，這一筆作廢，不動錢
        const u2 = Object.values(E.units).find(u => !u.owner && u.occ && w.agents[u.occ] && ![b1.agentId, b2.agentId].includes(u.occ)); const c2 = { t: 'pub', uid: u2.id, price: ESTATE.valueOf(w, u2), d: day(), q: [b1.agentId, b2.agentId] };
        reset(); let gate = null; const hold = new Promise(r2 => { gate = r2; }); reply = async () => { await hold; return [{ n: 1, pick: 'buy', why: 'too late' }]; }; const n1 = seen.length; setCash(b2, 700); DECIDE.askNow(w, [{ a: b2, kind: 'houseBuy', ctx: c2 }]);
        setCash(b1, 900); runOp(KK.houseBuy, b1, c2, 'buy'); const T0 = MONEY.total(w), P0 = MM.pend; gate(); await settle(); o.late = { owner: u2.owner === b1.agentId, b2cash: cash(b2), decided: seen.slice(n1).filter(x => x.kind === 'houseBuy' && x.who === b2.agentId).length, leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), bad: houseBad().length };
        // 借錢蓋房：銀行家晚一點才點頭，錢到了再動工
        const ghosts = out._c.ghosts.map(id => E.units[id]).filter(Boolean); for (const u of Object.values(E.units)) if (!u.occ) { u.occ = 'ghost_' + u.id; ghosts.push(u); } const fakes = []; for (let i = 0; i < 40 && ESTATE.hsShort(w) < 1; i++) { E.homeless['fake_' + i] = day(); fakes.push('fake_' + i); }
        rich(30, 30, 30); const bor = npcs().find(x => !used.has(x.agentId) && alone(x) && x.job && !w.bank.loans[x.agentId] && x.agentId !== w.bank.banker); used.add(bor.agentId); plain(bor); setCash(bor, 60); H.bld = { d: day(), need: 1, got: 0, tok: ++H.n }; const cb = { d: day(), tok: H.bld.tok, q: [bor.agentId] };
        reset(); let gate2 = null; const hold2 = new Promise(r2 => { gate2 = r2; }); reply = async (p) => { if (/lend＝/.test(p)) { await hold2; return [{ n: 1, pick: 'lend', why: 'good risk' }]; } return [{ n: 1, pick: 'loan', why: 'rent will repay it' }]; };
        const nu0 = Object.keys(E.units).length; const n2 = seen.length; DECIDE.askNow(w, [{ a: bor, kind: 'buildRent', ctx: cb }]); await new Promise(r2 => setTimeout(r2, 30)); await new Promise(r2 => setTimeout(r2, 30));
        const mid = { units: Object.keys(E.units).length - nu0, waiting: !!BANK.pendingOf(w, bor), loan: !!w.bank.loans[bor.agentId], picked: seen.slice(n2).find(x => x.kind === 'buildRent')?.id, res: seen.slice(n2).find(x => x.kind === 'buildRent')?.res, mem: memHas(bor, '我去銀行談蓋房子的貸款，等銀行家回話。') };
        const T1 = MONEY.total(w), P1 = MM.pend; gate2(); await settle(); await new Promise(r2 => setTimeout(r2, 30));
        o.loan = { mid, units: Object.keys(E.units).length - nu0, loan: w.bank.loans[bor.agentId]?.kind === 'biz', mine: Object.values(E.units).some(u => u.owner === bor.agentId && u.built === day()), leak: r3((MONEY.total(w) - T1) - (MM.pend - P1)), banker: seen.slice(n2).some(x => x.kind === 'bankDesk' && x.id === 'lend' && x.src === 'ai') };
        for (const u of ghosts) if (String(u.occ).startsWith('ghost_')) u.occ = null; for (const id of fakes) delete E.homeless[id];
        // 額度：同一類一天最多問 AI 三件，其餘當場照個性
        reset(); reply = []; rich(900, 700, 500); for (const x of Object.values(E.units)) if ([b1.agentId, b2.agentId, b3.agentId].includes(x.owner) && x.occ !== x.owner) x.owner = null; H.wk = { d: day(), pub: 0, all: 0 }; const pubsNow = Object.values(E.units).filter(u => !u.owner && u.occ && w.agents[u.occ]).slice(0, 5); const n3 = seen.length; const xs = npcs().filter(x => !used.has(x.agentId) && alone(x)).slice(0, 5); for (const x of xs) { setCash(x, 800); x.personality.traits = ['thrifty', 'ascetic']; x.personality.values = []; } /* 照個性的那兩位都不買，這週兩棟的上限就不會先被用掉 */
        DECIDE.askNow(w, xs.map((x, i) => ({ a: x, kind: 'houseBuy', ctx: { t: 'pub', uid: pubsNow[i].id, price: ESTATE.valueOf(w, pubsNow[i]), d: day(), q: [] } }))); /* 每人問的是不同的一棟 */ const ruled = seen.slice(n3).filter(x => x.kind === 'houseBuy' && x.src === 'rule').length; const sent = X0._kAsked.houseBuy, grp = X0._gAsked.house; await settle();
        o.quota = { n: xs.length, ai: sent, ruled, group: grp }; for (const x of xs) setCash(x, 40); }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }
    out.prompts = Object.fromEntries(Object.entries(prompts).map(([k, p]) => [k, { len: String(p).length, err: /^ERR/.test(p) ? p : null, cjk: /[一-鿿]/.test(p), sample: (String(p).match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] }]));
    out.bad2 = houseBad();

    // ============ 放著跑：每週前讓十二個人手上有錢（模擬住久了的鎮），看這幾件事自己發生、帳對得上、住處一致 ============
    { const errs0 = []; const tick = () => { try { tick1(); } catch (e) { errs0.push(String(e.stack || e.message).slice(0, 300)); } }; const n0 = asked.length; const s0 = seen.length; const st0 = Object.assign({}, E.stats); const badRun = []; let hl = 0;
      for (const k of Object.keys(H.buyNo)) delete H.buyNo[k]; for (const k of Object.keys(H.bldNo)) delete H.bldNo[k]; for (const k of Object.keys(H.svAsk)) delete H.svAsk[k]; delete H.pubAsk;
      const richOnes = npcs().filter(x => (x.age ?? 30) >= 22 && !String(x.agentId).startsWith('visit_')).slice(0, 12); const top = () => { for (const a of richOnes) if (w.agents[a.agentId] === a && !a.isDead && cash(a) < 600) WALLET.add(w, a, 900 - cash(a)); };
      tick(); top(); tick(); const d0 = day(); MM.lastT = MONEY.total(w) - (MM.pend || 0); let injected = 0;
      for (let i = 0; i < LONG; i++) { if (day() % 7 === 6) { const T0 = MONEY.total(w); top(); injected += MONEY.total(w) - T0; MM.lastT += MONEY.total(w) - T0; } tick(); const b = houseBad(); if (b.length && badRun.length < 5) badRun.push(day() + ':' + b.slice(0, 2).join('|')); hl = Math.max(hl, Object.keys(E.homeless).length); if (i % 10 === 0) await new Promise(r2 => setTimeout(r2, 0)); }
      let other = 0; for (const [kk, Dd] of Object.entries(w.money?.days || {})) if (+kk > d0) other += Math.abs(Dd.other || 0);
      const per = {}; for (const e of asked.slice(n0)) per[e.kind] = (per[e.kind] || 0) + 1; const pk = {}; for (const e of seen.slice(s0)) if (KEYS.includes(e.kind)) pk[e.kind + '.' + e.id.split(':')[0]] = (pk[e.kind + '.' + e.id.split(':')[0]] || 0) + 1;
      const dst = {}; for (const k of Object.keys(E.stats)) if ((E.stats[k] || 0) !== (st0[k] || 0)) dst[k] = r3((E.stats[k] || 0) - (st0[k] || 0));
      out.run = { errs: errs0.slice(0, 3), days: day() - d0, kinds: per, picks: pk, other: Math.round(other * 100) / 100, bad: badRun, stats: dst, servants: Object.keys(E.servants).length, hl, injected: Math.round(injected) }; }
    const nm = npcs().concat(Object.values(w.agents)).map(a => a.name).filter(Boolean).sort((x, y) => y.length - x.length); const loc = (s2) => { let r2 = String(s2); try { for (const n of nm) if (r2.includes(n)) r2 = r2.split(n).join(I18N.localizeNames ? I18N.localizeNames(n, true) : n); } catch (e) {} return r2; };
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(-300).map(loc);
    out.texts = texts.filter(Boolean).map(loc);
    out.logTexts = (w.messageLog || []).filter(m => /^(🏘️|📉|🏗️|🧹|🏚️)/.test(String(m.content || ''))).map(m => loc(World.logText ? World.logText(m) : m.content)).slice(-120);
    return out; } catch (e) { out.fatal = String(e.stack || e.message).slice(0, 900); return out; } }, { KEYS, LONG });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s)); const zh = lang === 'zh';
  if (r.fatal) { ok(false, `${tag} 測試中途出錯`, { fatal: r.fatal, done: Object.keys(r), D: r.D, C: r.C && { ask: r.C.ask, off: r.C.off } }); await ctx.close(); return; }
  ok(r.on && r.pop >= 60 && r.leader, `${tag} 決策核心開著，鎮上 ${r.pop} 人，有首長`, { on: r.on, pop: r.pop, leader: r.leader });
  { const g = Object.fromEntries(r.reg.map(x => [x.k, x]));
    ok(r.reg.every(x => !x.missing && x.scan === false && x.title && x.g === 'house'), `${tag} 登記了七種新的選擇點，都由那一刻送進來、用 house 那一組額度（共 ${r.total} 種）`, r.reg);
    ok(r.group === 8 && g.houseBuy.kind === 3 && g.townSale.kind === 2 && g.townBuild.kind === 2, `${tag} 額度：house 一天 8 件，買房一天最多 3 件，首長的兩種各 2 件`, { group: r.group, reg: r.reg }); }
  { const A = r.A;
    ok(A.ask.leader && A.ask.buyers === 6 && A.ask.units === 2 && A.ask.who && A.ask.q && A.ask.price && A.ask.once === 0, `${tag} 公有房舍標售：先問首長這陣子賣不賣（28 天一次），再把最多兩棟各問前三有錢的人`, A.ask);
    ok(Object.values(A.saleFacts).every(Boolean) && A.saleIds === 'open,vacant,hold' && A.saleNotLeader === 0 && A.saleOld === 0, `${tag} 首長的題目：有幾棟公有房舍、幾棟有人租、公庫多少、幾個人出得起、現在的做法；三個選項；不是首長、過了兩天就不問`, { f: A.saleFacts, ids: A.saleIds, nl: A.saleNotLeader, old: A.saleOld });
    ok(A.hold.mode === 'hold' && A.hold.by && A.hold.log && A.hold.mem && A.hold.asked === 0 && A.hold.voidBuy === 0 && A.hold.cur, `${tag} 首長說這陣子不標售：記下來、鎮上看得到，那一週沒有人被問要不要買，已經問出去的也作廢`, A.hold);
    ok(A.vacant.mode === 'vacant' && A.vacant.asked > 0 && A.vacant.allVacant && A.vacant.occVoid === 0 && A.open.mode === 'open', `${tag} 首長說只標售空著的：被問到的都是空屋，有人住的不賣；改回照常標售也可以`, { v: A.vacant, o: A.open });
    ok(Object.values(A.facts).every(Boolean) && A.ids === 'pass,buy', `${tag} 買的人的題目：價錢、現在誰租著、身上的錢與買下以後剩多少、名下有沒有房子、鎮上的房子、還有誰在看；選項是不買／買`, { f: A.facts, ids: A.ids });
    ok(A.self.facts && A.self.keener, `${tag} 那一棟剛好是自己租的：題目寫明買下來不用再付房租，也比較想買`, A.self);
    ok(A.buy.owner && A.buy.paid === A.buy.town && A.buy.paid > 0 && A.buy.leak === 0 && A.buy.sold === 1 && A.buy.log && A.buy.mem && A.buy.tmem && A.buy.home && A.buy.desc && A.buy.wk === 1, `${tag} 買下：${A.buy.paid} 銀幣從買的人進公庫，房子過戶，房客照樣住、改付房租給新屋主，雙方都記得`, A.buy);
    ok(A.late.paid === 0 && A.late.owner && A.late.isLate && A.late.leak === 0 && A.late.void === 0, `${tag} 晚一步的人：沒付錢、房子不變，結果寫「晚了一步」；之後這一題就作廢`, A.late);
    ok(A.selfBuy.owner && A.selfBuy.home && A.selfBuy.mem && A.selfBuy.leak === 0 && A.selfBuy.desc, `${tag} 買下自己租的那一棟：人不用搬，從租客變成住自家的房子`, A.selfBuy);
    ok(A.void.live === 2 && A.void.old === 0 && A.void.poor === 0 && A.void.jail === 0 && A.void.cap === 0 && A.void.week === 0, `${tag} 做不到就不列：過了兩天、錢不夠、被關、名下房子已經太多、這週已經賣了兩棟`, A.void);
    ok(A.pass.cooled && A.pass.stat === 1 && !A.pass.asked && A.pass.others && A.pass.owner && A.pass.cash === 700, `${tag} 說不買：錢與房子都不動，三週內不再問他，別人照問`, A.pass);
    ok(A.lean.pThr === 'pass' && A.lean.pGr === 'buy', `${tag} 照個性：節儉又清心寡慾的不買，貪心又看重財富的買`, A.lean);
    ok(!A.flow.err && A.flow.decided === 3 && A.flow.sold === 1 && A.flow.pubs === 1 && A.flow.owner && A.flow.lateTxt === 2 && A.flow.leak === 0 && A.flow.log, `${tag} 走決策核心：三位都說要，最有錢的先買到，另外兩位晚了一步，只賣出一棟、帳對得上`, A.flow);
    ok(A.off.asked === 0 && A.off.sold >= 1 && A.off.b1 >= 1 && A.off.leak === 0 && A.direct.asked === 0 && A.direct.sold >= 1, `${tag} 決策核心沒開（或直接呼叫 ESTATE.market）：跟以前一樣，最有錢的人直接買下，沒有人被問`, { off: A.off, direct: A.direct });
    ok(A.bad.length === 0, `${tag} 這一段做完：每一戶最多住一處、屋主都還在`, A.bad); }
  { const B = r.B;
    ok(B.ask.n === 1 && B.ask.who && B.ask.t === 'ask' && B.ask.uid, `${tag} 撐不下去的屋主（身上不到 3 銀幣又挨餓）：每週問他本人`, B.ask);
    ok(Object.values(B.facts).every(Boolean) && B.ids === 'hold,sell,mortgage', `${tag} 題目：身上的錢、餓了幾天、房子值多少、八折是多少、誰出得起、賣了以後的房租、抵押借得到多少；選項是撐著／賣／抵押`, { f: B.facts, ids: B.ids });
    ok(B.noBank === 'hold,sell' && B.noBuyer === 'hold,mortgage' && B.noBuyerFacts && B.nothing === '' && B.notAsked === 0, `${tag} 只列做得到的：銀行沒開就沒有抵押、沒人買得起就沒有賣（題目寫明）；兩樣都不行就不問`, { nb: B.noBank, nbu: B.noBuyer, f: B.noBuyerFacts, no: B.nothing, na: B.notAsked });
    ok(B.lean.hungrier && B.lean.trad, `${tag} 照個性：餓得越久越會賣，看重傳統的比較會撐`, B.lean);
    ok(B.hold.leak === 0 && B.hold.owner && B.hold.cash === 2 && !B.hold.listed, `${tag} 撐著：錢與房子都不動`, B.hold);
    ok(B.list.listed && B.list.asked && B.list.who && B.list.log && B.list.mem && B.list.again === 0, `${tag} 拿出來賣：掛出去（開價照行情、八折價記好），出得起的兩位被問到，鎮上看得到；掛著的時候不重複問`, B.list);
    ok(Object.values(B.bfacts).every(Boolean) && B.bids === 'pass,full,low' && B.bidsPoor === 'pass,low' && B.kinVoid === 0, `${tag} 買的人的題目：誰賣、開價、八折價、他餓了幾天、自己的錢、還有誰被問；出不起全價的只有不買／出八折；屋主自己家的人不會被列為買主`, { f: B.bfacts, ids: B.bids, poor: B.bidsPoor, kin: B.kinVoid });
    ok(B.blean.ok, `${tag} 照個性：跟屋主要好的比較會照價買，有過節的比較會殺價`, B.blean);
    ok(B.full.owner && B.full.paid === B.full.got && B.full.paid > 0 && B.full.leak === 0 && B.full.home && B.full.sold === 1 && B.full.gone && B.full.log && B.full.smem && B.full.bmem && B.full.rent && B.full.aff, `${tag} 照開價買：${B.full.paid} 銀幣從買的人到屋主，房子過戶，屋主一家照樣住在原地、沒有人無家可歸，雙方都記得`, B.full);
    ok(B.late.isLate && B.late.paid === 0 && B.late.leak === 0 && B.late.void === 0, `${tag} 另一位晚了一步：沒付錢，結果寫明被誰買走`, B.late);
    ok(B.rent.paid && B.rent.got && B.rent.leak === 0, `${tag} 下一次收租：賣掉房子的人付 ${B.rent.rent} 銀幣房租給新屋主`, B.rent);
    ok(B.bid.asked && B.bid.noted && B.bid.noMove && B.bid.again === 0, `${tag} 只出八折：先問屋主答不答應，這時錢與房子都還沒動；出過價的人不再重複問`, B.bid);
    ok(Object.values(B.bidFacts).every(Boolean) && B.bidIds === 'refuse,take', `${tag} 屋主的題目：誰出價、出多少、原本開價、自己剩多少錢；選項是不賣這個價／接受`, { f: B.bidFacts, ids: B.bidIds });
    ok(B.refuse.leak === 0 && B.refuse.owner && B.refuse.cash && B.refuse.mem && B.refuse.listed && B.refuse.b2can === 'pass,full,low', `${tag} 不賣這個價：什麼都不動，出價的人知道被拒絕，房子還掛著、別人還可以買`, B.refuse);
    ok(B.take.owner && B.take.paid && B.take.got && B.take.leak === 0 && B.take.home && B.take.hag && B.take.log && B.take.aff && B.take.gone, `${tag} 接受八折：照八折成交，屋主一家照樣住，鎮上的紀錄寫明是八折，屋主對殺價的人有點疙瘩`, B.take);
    ok(!B.flow.err && B.flow.owner && B.flow.b2paid && B.flow.b1paid === 0 && B.flow.seller && B.flow.leak === 0 && B.flow.home && /homeSell\.sell houseBuy\.low houseBuy\.full/.test(B.flow.seq), `${tag} 走決策核心：屋主賣、一位出八折、一位照開價，照開價的買到，出八折的沒付錢，帳對得上（${B.flow.seq}）`, B.flow);
    ok(B.expire.still && B.expire.gone && B.expire.mem && B.expire.void === 0 && B.expire.owner, `${tag} 掛了兩天沒有人買：收掉，屋主記得，房子還是他的`, B.expire);
    ok(B.void.rich === 0 && B.void.live >= 2 && B.void.old === 0 && B.void.fed === 0, `${tag} 等回話的這段時間有了錢、吃飽了、過了兩天：這件事就過去了`, B.void);
    ok(B.mort.loan && B.mort.coll && B.mort.got === B.mort.n && B.mort.got > 0 && B.mort.leak === 0 && B.mort.owner, `${tag} 拿去抵押：跟銀行借到 ${B.mort.got} 銀幣，房子還是自己的、押在銀行`, B.mort);
    ok(B.debtor.ids === 'hold,sell' && B.debtor.facts, `${tag} 欠著銀行又沒錢的屋主也會被問，題目寫明欠多少；已經有貸款就不能再抵押`, B.debtor);
    ok(B.off.asked === 0 && B.off.owner && B.off.got && B.off.leak === 0 && B.off.home, `${tag} 直接呼叫 ESTATE.market（原本的規則）：一定賣給最有錢的人，沒有人被問`, B.off);
    ok(B.bad.length === 0, `${tag} 這一段做完：每一戶最多住一處、屋主都還在`, B.bad); }
  { const C = r.C;
    ok(C.short >= 2 && C.ask.n === 3 && C.ask.who && C.ask.need === 2 && C.ask.tok, `${tag} 鎮上缺房子：問出得起的前三位，這週最多蓋兩棟`, { s: C.short, a: C.ask });
    ok(Object.values(C.facts).every(Boolean) && C.ids === 'pass,build', `${tag} 題目：蓋一棟多少錢、租出去一週收多少、幾週回本、自己的錢、還有誰被問、鎮上的房子；選項是不蓋／蓋`, { f: C.facts, ids: C.ids });
    ok(C.lean.pThr === 'pass' && C.lean.pAmb === 'build', `${tag} 照個性：節儉又清心寡慾的不蓋，有野心又看重財富的蓋`, C.lean);
    ok(C.build.units === 1 && C.build.mine && C.build.paid === 110 && C.build.wood === 12 && C.build.stone === 8 && C.build.leak === 0 && C.build.built === 1 && C.build.got === 1 && C.build.log && C.build.mem, `${tag} 蓋：110 銀幣付給木作坊和礦場、用掉 12 木 8 石，多一棟出租屋，帳對得上`, C.build);
    ok(C.slot.second && C.slot.got === 2 && C.slot.units === 2 && C.slot.lateTxt && C.slot.paid3 === 0 && C.slot.leak === 0 && C.slot.void === 0, `${tag} 這週的兩棟蓋滿了：第三位晚了一步，沒有付錢、沒有多蓋`, C.slot);
    ok(C.pass.cooled && !C.pass.asked && C.pass.others >= 1 && C.noMat === 0, `${tag} 說不蓋：三週內不再問他；倉裡沒有料就不問任何人`, { p: C.pass, m: C.noMat });
    ok(C.loanAsk.asked && C.loanAsk.ids === 'pass,loan' && C.loanAsk.facts, `${tag} 沒有人自己出得起：問有工作、借得到錢的人，選項是不蓋／跟銀行借錢蓋，題目寫明借多少、幾天還`, C.loanAsk);
    ok(!C.loan.err && C.loan.loan && C.loan.built === 1 && C.loan.mine && C.loan.leak === 0 && C.loan.log, `${tag} 借錢蓋：銀行撥款（四十五天的創業貸款），房子蓋好，帳對得上`, C.loan);
    ok(C.void.live === 2 && C.void.notShort === 0 && C.void.short === 0 && C.void.old === 0, `${tag} 等回話的這段時間已經不缺房、過了兩天：作廢`, C.void);
    ok(C.off.asked === 0 && C.off.built >= 1 && C.off.byRich && C.off.leak === 0, `${tag} 直接呼叫 ESTATE.market（原本的規則）：最有錢的人直接蓋，沒有人被問`, C.off);
    ok(C.bad.length === 0, `${tag} 這一段做完：住處一致`, C.bad); }
  { const D = r.D;
    ok(D.homeless === 2 && D.ask.n === 1 && D.ask.who && D.ask.num >= 1 && D.ask.tok, `${tag} 有人睡在廣場、一間空屋都沒有：問首長公庫蓋不蓋`, { h: D.homeless, a: D.ask });
    ok(Object.values(D.facts).every(Boolean) && /^no,one(,two)?$/.test(D.ids) && D.notLeader === 0, `${tag} 題目：幾戶幾個人沒地方住、蓋一棟多少錢與用多少料、公庫有多少、可以動用多少；選項是先不蓋／蓋一棟（／蓋兩棟）；不是首長不問`, { f: D.facts, ids: D.ids });
    ok(D.lean.ok, `${tag} 照個性：心腸好、看重社群的首長比小氣貪心的更會蓋`, D.lean);
    ok(D.quiet.set && D.quiet.q1 === 0 && D.quiet.q20 === 0 && D.quiet.qNew === 1 && D.quiet.q21 === 1, `${tag} 先不蓋之後同一位首長三週內不再被問，換了首長或過了三週才再問`, D.quiet);
    ok(D.no.units === 0 && D.no.tr === 0 && D.no.leak === 0 && D.no.log && D.no.mem && D.no.aff && D.no.still && D.no.again === 0, `${tag} 先不蓋：公庫不動，鎮上看得到這個決定，睡廣場的人記得、對首長的好感下降`, D.no);
    ok(D.one.units === 1 && D.one.pub === 1 && D.one.tr > 0 && D.one.tr <= 100 && D.one.wood === 10 && D.one.stone === 6 && D.one.leak === 0 && D.one.housed === 1 && D.one.log && D.one.mem && D.one.hmem && D.one.aff, `${tag} 蓋一棟：公庫出 100 銀幣（工程款有一部分付給鎮上的木作坊，公庫淨少 ${D.one.tr}）、用掉 10 木 6 石，睡廣場的一戶當下就搬進去，大家記得`, D.one);
    ok(D.broke.ids === '' && D.broke.asked === 0 && D.twoIds === 'no,one,two' && D.two.units === 2 && D.two.tr > D.one.tr && D.two.tr <= 200 && D.two.homeless === 0, `${tag} 公庫沒有可以動用的錢就不問；缺得多時可以一次蓋兩棟，沒有人再睡廣場`, { b: D.broke, t: D.two });
    ok(D.void.live >= 2 && D.void.vac === 0 && D.void.old === 0 && D.void.tok === 0, `${tag} 等回話的這段時間有空屋了、過了兩天、已經問過新的一次：作廢`, D.void);
    ok(D.noLeader.asked === 0 && D.noLeader.built >= 1 && D.noLeader.housed, `${tag} 首長不在鎮上：照原本的規則，公庫直接蓋，睡廣場的人有地方住`, D.noLeader);
    ok(D.off.asked === 0 && D.off.built >= 1 && D.off.leak === 0 && D.off.housed, `${tag} 直接呼叫 ESTATE.market（原本的規則）：公庫自動蓋，沒有人被問`, D.off);
    ok(D.bad.length === 0, `${tag} 這一段做完：住處一致`, D.bad); }
  { const E = r.E;
    ok(E.ask.n === 1 && E.ask.who && E.ask.t === 'hire' && E.ask.pool && E.ask.again === 0, `${tag} 幫傭：身上 300 銀幣以上、還請得起的人才被問（28 天一次），人選是鎮上最窮的三位`, E.ask);
    ok(Object.values(E.facts).every(Boolean) && E.ids.no && E.ids.s1 && E.ids.s2 && E.ids.s3 && E.ids.n === 4, `${tag} 主人的題目：自己的錢、一天與一週的工錢、三位人選；選項是不請／請其中一位`, { f: E.facts, ids: E.ids });
    ok(E.lean.friend && E.lean.pThr === 'no', `${tag} 照個性：要請會先請交情好的；節儉又清心寡慾的不請`, E.lean);
    ok(E.no.servants === 0 && E.no.asked === 0, `${tag} 不請：沒有人被找上`, E.no);
    ok(E.hire.asked && E.hire.pending && E.hire.notYet && E.hire.soon, `${tag} 請某一位：先問對方去不去，答應之前還不算數`, E.hire);
    ok(Object.values(E.ofacts).every(Boolean) && E.oids === 'no,go' && E.oNotMe === 0, `${tag} 被請的人的題目：誰請、工錢、自己剩多少、主人大約有多少；選項是不去／去；沒被請的人不問`, { f: E.ofacts, ids: E.oids });
    ok(E.olean.foe === 'no' && E.olean.hungry === 'go' && E.olean.foeTxt, `${tag} 照個性：跟主人有過節的不去（理由說得出是誰），餓著的會去`, E.olean);
    ok(E.go.servant && E.go.off && E.go.leak === 0 && E.go.log && E.go.smem && E.go.mmem && E.go.desc && E.go.again === 0, `${tag} 去：成了幫傭，雙方都記得、鎮上看得到`, E.go);
    ok(E.pay.m === 3 && E.pay.s === 3 && E.pay.leak === 0, `${tag} 每天的工錢：3 銀幣從主人到幫傭的人`, E.pay);
    ok(E.refuse.servant && E.refuse.leak === 0 && E.refuse.mmem && E.refuse.smem && E.refuse.pool && E.refuse.off, `${tag} 不去：主人知道被拒絕，四週內不會再找同一個人`, E.refuse);
    ok(E.void.live === 2 && E.void.poorM === 0 && E.void.expired === 0 && E.void.hireOld === 0 && E.void.hirePoor === 0, `${tag} 等回話的這段時間主人錢少了、邀約過了兩天：作廢；主人不到 300 銀幣不問`, E.void);
    ok(E.keepAsk.asked && E.keepAsk.facts && E.keepAsk.ids === 'keep,fire' && E.keepAsk.again === 0 && E.keepAsk.still, `${tag} 主人錢少了（不到 150）：不再自動辭退，問他本人（兩週一次）`, E.keepAsk);
    ok(E.klean.warm === 'keep' && E.klean.cold === 'fire', `${tag} 照個性：心腸好、跟幫傭的人要好的會留；小氣貪心的辭退`, E.klean);
    ok(E.keep.still && E.keep.leak === 0 && E.fire.gone && E.fire.leak === 0 && E.fire.smem && E.fire.log && E.fire.void === 0 && E.cantPay.gone, `${tag} 留著就繼續付工錢；辭退的話對方記得、鎮上看得到；真的付不出工錢那天對方照舊會走`, { k: E.keep, f: E.fire, c: E.cantPay });
    ok(!E.flow.err && E.flow.servant && E.flow.leak === 0 && /hireHelp\.hire helpOffer\.go/.test(E.flow.seq), `${tag} 走決策核心：主人說請、對方說去（${E.flow.seq}）`, E.flow);
    ok(E.off.asked === 0 && E.off.hired && E.off.fired && E.off.viaWeekly, `${tag} 決策核心沒開（或直接呼叫 ESTATE.servants）：跟以前一樣，自動請最窮的兩位、錢少了自動辭退`, E.off); }
  { const R = r.rates; const band = (v, lo, hi) => v != null && v >= lo && v <= hi;
    ok(band(R.houseBuy_pub, 0.3, 0.8) && band(R.houseBuy_home_full, 0.15, 0.6) && band(R.houseBuy_home_low, 0.1, 0.55), `${tag} 照個性的比例：買公有房舍 ${R.houseBuy_pub}；屋主賣房時照開價買 ${R.houseBuy_home_full}、只出八折 ${R.houseBuy_home_low}`, R);
    ok(band(R.homeSell_sell, 0.2, 0.7) && band(R.homeSell_mort, 0.08, 0.5) && band(R.homeSell_hold, 0.1, 0.6) && band(R.homeSell_sell_nomort, 0.3, 0.85) && band(R.homeSell_bid_take, 0.4, 0.9), `${tag} 屋主：賣 ${R.homeSell_sell}、抵押 ${R.homeSell_mort}、撐著 ${R.homeSell_hold}（不能抵押時賣 ${R.homeSell_sell_nomort}）；接受八折 ${R.homeSell_bid_take}`, R);
    ok(band(R.buildRent_build, 0.25, 0.75) && band(R.buildRent_loan, 0.15, 0.65), `${tag} 蓋出租屋：自己出錢 ${R.buildRent_build}、借錢蓋 ${R.buildRent_loan}`, R);
    ok(band(R.townSale_hold, 0.05, 0.5) && band(R.townSale_vacant, 0.05, 0.5) && band(R.townBuild_build, 0.5, 0.97), `${tag} 首長：不標售 ${R.townSale_hold}、只賣空屋 ${R.townSale_vacant}；公庫蓋房 ${R.townBuild_build}（其中蓋兩棟 ${R.townBuild_two}）`, R);
    ok(band(R.hireHelp_hire, 0.3, 0.8) && band(R.helpOffer_go, 0.55, 0.95) && band(R.hireHelp_fire, 0.4, 0.9), `${tag} 幫傭：主人請 ${R.hireHelp_hire}、對方去 ${R.helpOffer_go}；錢少了辭退 ${R.hireHelp_fire}`, R); }
  ok(r.bad0.length === 0 && r.bad1.length === 0 && r.bad2.length === 0, `${tag} 住處一致：開局、五段做完、開過 AI 之後，每一戶最多住一處、屋主都還在`, { b0: r.bad0, b1: r.bad1, b2: r.bad2 });
  ok(!r.SV.err && !r.SV.opErr && r.SV.pub && r.SV.sale && r.SV.no && r.SV.mode === 'vacant' && !r.SV.err3 && r.SV.old, `${tag} 存讀檔：首長定的做法、掛著的房子、被拒絕的紀錄都在；沒有這幾格的舊存檔讀進來照常標售`, r.SV);
  { const m = r.mind;
    ok(m.aiOn && m.buy.pending && m.buy.id === 'buy' && m.buy.src === 'ai' && m.buy.reason === 'model reason 114' && m.buy.group === 1 && m.buy.owner && m.buy.rec, `${tag} 開著 AI：題目送出去等回話，回來才成交，理由寫進決定紀錄，用 house 那一組`, m.buy);
    ok(m.p1.codes && (zh || !m.p1.cjk), `${tag} 題目用選項代號（pass／buy）${zh ? '' : '，英文題目沒有殘留中文'}`, m.p1);
    ok(m.late.owner && m.late.b2cash === 700 && m.late.decided === 0 && m.late.leak === 0 && m.late.bad === 0, `${tag} 回話晚到：等的時候房子被別人買走，這一筆作廢，不動錢、不動住處`, m.late);
    ok(m.loan.mid.units === 0 && m.loan.mid.waiting && !m.loan.mid.loan && m.loan.mid.picked === 'loan' && m.loan.mid.mem && m.loan.units === 1 && m.loan.loan && m.loan.mine && m.loan.leak === 0 && m.loan.banker, `${tag} 借錢蓋房要等銀行家：他還沒點頭時不動工，點頭、錢到了才蓋，帳對得上`, m.loan);
    ok(m.quota.n === 5 && m.quota.ai === 3 && m.quota.ruled === 2 && m.quota.group === 3, `${tag} 額度：買房一天最多 3 件問 AI，其餘當場照個性決定`, m.quota); }
  { const bad = Object.entries(r.prompts).filter(([, p]) => p.err || p.len < 200 || (!zh && p.cjk));
    ok(Object.keys(r.prompts).length >= 11 && bad.length === 0, `${tag} 十一種題目都組得出來${zh ? '' : '，英文題目沒有殘留中文'}`, bad.slice(0, 3)); }
  { const run = r.run;
    ok(run.errs.length === 0 && run.days >= LONG - 1 && run.other === 0 && run.bad.length === 0, `${tag} 放著跑 ${run.days} 天：沒有錯誤、帳上對不上的錢是 0、每天住處都一致`, { errs: run.errs, other: run.other, bad: run.bad });
    ok((run.kinds.hireHelp || 0) >= 1 && (run.kinds.helpOffer || 0) >= 1 && ((run.kinds.houseBuy || 0) + (run.kinds.buildRent || 0) + (run.kinds.townSale || 0)) >= 1, `${tag} 這幾件事會自己發生（被問到的次數：${JSON.stringify(run.kinds)}；選了什麼：${JSON.stringify(run.picks)}）`, run); }
  if (!zh) { const bad = r.texts.concat(r.seenTexts, r.logTexts).filter(cjk); ok(r.texts.length > 80 && bad.length === 0, `${tag} 英文：題目、選項、理由、結果、鎮上的紀錄都沒有殘留中文（${r.texts.length + r.seenTexts.length + r.logTexts.length} 句）`, bad.slice(0, 5)); }
  else ok(r.texts.length > 80 && !r.texts.some(x => /^ERR|undefined|\[object|\{[a-z0-9]+\}/i.test(x)) && !r.texts.concat(r.logTexts).some(x => /[—–]/.test(x)), `${tag} 中文：${r.texts.length} 句題目與選項都組得出來，沒有漏填的空格、沒有破折號`, r.texts.filter(x => /^ERR|undefined|\[object|\{[a-z0-9]+\}|[—–]/i.test(x)).slice(0, 5));
  ok(errs.length === 0, `${tag} 全程沒有錯誤訊息`, errs.slice(0, 5));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const only = process.env.ONLY || ''; // ONLY=zh 或 ONLY=en：只跑其中一輪（除錯用）
  try { if (only !== 'en') await run(browser, 'mobile', 'zh'); if (only !== 'zh') await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
