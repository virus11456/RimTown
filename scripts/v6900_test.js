// v6.90.0 房產、資本與財富流動:開局家族、一戶一戶分房、收租(房東／公庫)、欠租驅逐露宿與重新租房、公有房舍標售、
// 缺錢賣屋變租客、缺房蓋出租屋、房屋抵押與銀行收房、存款利息只從放款利息付、銀行家利潤、傭人僱用與辭退、富人消費隨財富增加、
// 罷工與讓步、經營風險、房子繼承、AI 與詳情、經濟頁住宅市場、存讀檔;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {};
      // 1) 開局家族:新世界一開始就有夫妻、有爸媽的小孩
      const w = new World(); w.townTheme = 'frontier'; w.townName = 'EstT'; w.rosterMode = 'scripted'; w.reset(); w.observerMode = true; ORIGIN.seed(w, 1, { seed: 42 });
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const couples = npcs().filter(a => Object.values(a.relationships.relationships).some(r => r.status === 'married')).length / 2; const kids = npcs().filter(a => (a._parentNames || []).length).length;
      out.fam = { couples, kids, pop: npcs().length };
      WALLET.S(w); const Wl = w.wallet; const E = ESTATE.S(w); ESTATE.init(w); const hh = ESTATE.households(w);
      out.hh = { hh: hh.size, units: Object.keys(E.units).length, pop: npcs().length };
      const kid = npcs().find(a => (a._parentNames || []).length && a.age < 18); out.kidWithParent = !kid || ESTATE.headOf(w, kid).name === kid._parentNames.find(n => n === ESTATE.headOf(w, kid).name) || (kid._parentNames || []).includes(ESTATE.headOf(w, kid).name) || ESTATE.headOf(w, kid) !== kid;
      // 2) 收租:租客付給房東,公有房舍付給公庫
      const tenantU = Object.values(E.units).find(u => u.occ && !u.owner); const landlord = npcs().find(a => !(hh.get(tenantU?.occ) || []).includes(a) && !ESTATE.ownsOf(w, a.agentId).length);
      const tMembers = hh.get(tenantU.occ); for (const m of tMembers) Wl.bal[m.agentId] = 100;
      const t0 = w.stockpile.get('silver'); ESTATE.weekly(w, ESTATE.households(w)); out.townRent = w.stockpile.get('silver') > t0;
      tenantU.owner = landlord.agentId; Wl.bal[landlord.agentId] = 10; for (const m of tMembers) Wl.bal[m.agentId] = 100; const rent = ESTATE.rentOf(w, tenantU);
      E.arrears = {}; const pt0 = E.stats.ptax || 0; const tb0 = tMembers.reduce((s2, m) => s2 + Wl.bal[m.agentId], 0); const recv = []; const _add = WALLET.add; WALLET.add = function (ww, a, n) { if (a === landlord) recv.push(n); return _add.apply(this, arguments); }; try { ESTATE.weekly(w, ESTATE.households(w)); } finally { WALLET.add = _add; } const tb1 = tMembers.reduce((s2, m) => s2 + Wl.bal[m.agentId], 0);
      out.tenantPaid = Math.round((tb0 - tb1) * 100) / 100; out.landlordRent = Math.round(recv.reduce((a, b) => a + b, 0) * 100) / 100; /* 房東自己也可能付房租,所以看收到的錢 */ out.rent = rent; out.stillThere = E.units[tenantU.id].occ === tenantU.occ; out.llDbg = [landlord.agentId, E.units[tenantU.id].owner, Wl.bal[landlord.agentId], landlord.age, !!w.agents[landlord.agentId], Object.keys(E.servants).length, ESTATE.ownsOf(w, landlord.agentId).length];
      // 3) 付不起就欠租,欠太多被趕到廣場;存到錢、有空屋又租回來
      for (const m of tMembers) Wl.bal[m.agentId] = 0; for (let i = 0; i < 4 && E.units[tenantU.id].occ; i++) ESTATE.weekly(w, ESTATE.households(w));
      const head = w.agents[Object.keys(E.homeless).find(h => tMembers.some(m => m.agentId === h))]; out.evicted = !!head && head.homeLocation === ESTATE.HOMELESS_AT;
      out.homelessThought = !!head && (head.thoughts || []).some(x => x.kind === 'homeless');
      for (const m of tMembers) Wl.bal[m.agentId] = 200; ESTATE.weekly(w, ESTATE.households(w)); out.rehoused = !!head && !E.homeless[head.agentId] && head.homeLocation !== ESTATE.HOMELESS_AT;
      // 4) 公有房舍標售給有錢人
      const rich = npcs()[0]; Wl.bal[rich.agentId] = 5000; const pubBefore = Object.values(E.units).filter(u => !u.owner).length; ESTATE.market(w, ESTATE.households(w));
      out.auction = Object.values(E.units).filter(u => !u.owner).length < pubBefore && ESTATE.ownsOf(w, rich.agentId).length > 0;
      // 5) 缺房時有錢人蓋出租屋
      const n0 = Object.keys(E.units).length; for (const u of Object.values(E.units)) if (!u.occ) u.occ = 'ghost_' + u.id; E.homeless.fakehh = 1; w.stockpile.add('wood', 100, 0, 't'); w.stockpile.add('stone', 100, 0, 't'); Wl.bal[rich.agentId] = 5000;
      ESTATE.market(w, ESTATE.households(w)); out.built = Object.keys(E.units).length > n0; for (const u of Object.values(E.units)) if (String(u.occ).startsWith('ghost_')) u.occ = null; delete E.homeless.fakehh;
      // 5b) 沒空屋時寄住別人家(付一半房租);真的有人睡街上、一間空屋都沒有,公庫出錢蓋公有房舍
      { const hh5 = ESTATE.households(w); const lhid = [...hh5.keys()].find(h => E.home[h] && E.units[E.home[h]] && E.units[E.home[h]].occ === h && !(hh5.get(h) || []).some(m => ESTATE.ownsOf(w, m.agentId).length));
        ESTATE.evict(w, lhid, 'rent'); for (const u of Object.values(E.units)) if (!u.occ) u.occ = 'ghost_' + u.id; for (const a of npcs()) Wl.bal[a.agentId] = 100; E.arrears = {}; for (const m of hh5.get(lhid)) Wl.bal[m.agentId] = 60; const sv = w.stockpile.get('silver'); w.stockpile.consume('silver', sv, 0, 't');
        ESTATE.weekly(w, ESTATE.households(w)); w.stockpile.add('silver', sv, 0, 't'); out.lodged = !!E.lodge[lhid] && !E.homeless[lhid] && !!E.home[lhid]; out.lodgeTxt = String(ESTATE.describe(w, w.agents[lhid]));
        const before = Object.keys(E.units).length; for (const u of Object.values(E.units)) { u.lodgers = u.lodgers || []; while (u.lodgers.length < 2) u.lodgers.push('ghostL_' + u.id + u.lodgers.length); }
        E.homeless.fakehh2 = 1; for (const u of Object.values(E.units)) if (u.built !== undefined) u.built -= 7; for (const a of npcs()) Wl.bal[a.agentId] = 0; w.stockpile.add('silver', 3000, 0, 't'); w.stockpile.add('wood', 100, 0, 't'); w.stockpile.add('stone', 100, 0, 't'); const tr0 = w.stockpile.get('silver');
        ESTATE.market(w, ESTATE.households(w)); const nu = Object.values(E.units).filter(u => u.pub && u.built === w._absDay()); out.pubBuilt = nu.length > 0 && Object.keys(E.units).length > before && w.stockpile.get('silver') < tr0; out.pubRentCheaper = nu[0] ? ESTATE.rentOf(w, nu[0]) < ESTATE.rentOf(w, Object.assign({}, nu[0], { owner: 'x' })) : false;
        delete E.homeless.fakehh2; for (const u of Object.values(E.units)) { if (String(u.occ).startsWith('ghost_')) u.occ = null; u.lodgers = (u.lodgers || []).filter(x => !String(x).startsWith('ghostL_')); } }
      // 6) 房屋抵押,還不出來被銀行收走
      const B = BANK.S(w); B.open = true; B.status = 'ok'; B.reserve = 2000; B.banker = rich.agentId; const debtor = npcs().find(a => a !== rich && a.age >= 20);
      const house = Object.values(E.units).find(u => !u.occ) || Object.values(E.units)[0]; house.owner = debtor.agentId; Wl.bal[debtor.agentId] = 0; delete B.loans[debtor.agentId];
      const rnd = Math.random; Math.random = () => 0.01; try { ESTATE.market(w, ESTATE.households(w)); } finally { Math.random = rnd; }
      out.mortgage = !!B.loans[debtor.agentId]?.collateral; const coll = B.loans[debtor.agentId]?.collateral; if (B.loans[debtor.agentId]) { B.loans[debtor.agentId].due = -100; Wl.bal[debtor.agentId] = 0; B.lastDay = null; try { BANK.daily(w); } catch (e) { out.bankErr = e.message; } }
      out.foreclosed = !!coll && E.units[coll].owner === rich.agentId;
      // 7) 存款利息只從放款利息付
      B.dep = { [rich.agentId]: 1000 }; B.earned = 0; B.loans = {}; B.reserve = 300; for (const a of npcs()) Wl.bal[a.agentId] = 50; /* 沒人存提款、也沒人要借錢,這輪沒有利息收入 */ Wl.bal[rich.agentId] = 50; /* 不讓他當天又存又提 */ const dep0 = B.dep[rich.agentId]; const base = w._absDay; let off = 0; w._absDay = () => base.call(w) + off;
      while ((w._absDay()) % 7 !== 0) off++; B.lastDay = null; B.status = 'ok'; try { BANK.daily(w); } catch (e) { out.bankErr = e.message; } out.noEarnNoInterest = B.dep[rich.agentId] === dep0; out.depDbg = [dep0, B.dep[rich.agentId], B.earned, B.status, w._absDay() % 7];
      B.earned = 50; B.loans = {}; Wl.bal[rich.agentId] = 50; off += 7; B.lastDay = null; B.status = 'ok'; try { BANK.daily(w); } catch (e) { out.bankErr = e.message; } out.interestFromEarn = B.dep[rich.agentId] > dep0; w._absDay = base;
      // 8) 傭人:有錢人請窮人,每天付工錢;主人沒錢就辭退
      const poor = npcs().filter(a => a !== rich && a.age >= 16 && !ESTATE.ownsOf(w, a.agentId).length); for (const p of poor) Wl.bal[p.agentId] = 2; Wl.bal[rich.agentId] = 1000; E.servants = {};
      ESTATE.servants(w); const sid = Object.keys(E.servants)[0]; out.hired = !!sid && E.servants[sid] === rich.agentId;
      if (sid) { const s0 = Wl.bal[sid]; ESTATE.payServants(w); out.servantPaid = Wl.bal[sid] - s0 === ESTATE.SERVANT_PAY; Wl.bal[rich.agentId] = 100; ESTATE.servants(w); out.fired = !E.servants[sid]; }
      // 9) 富人消費隨財富增加
      const spend = (b) => { Wl.bal[rich.agentId] = b; const rnd2 = Math.random; Math.random = () => 0.2; let after = b; try { Wl.lastDay = null; MARKET.S(w).lastDay = null; WALLET.daily(w); after = Wl.bal[rich.agentId]; } finally { Math.random = rnd2; } return b - after; };
      out.spendSmall = Math.round(spend(100)); out.spendBig = Math.round(spend(10000));
      // 10) 罷工:工資被壓到七成以下、心情差 → 罷工兩天、不上工也沒工資;結束後老闆讓步
      const M = MARKET.S(w); const farmers = npcs().filter(a => a.job?.key === 'farmer'); while (farmers.length < 5) { const x = npcs().find(a => a.job?.key !== 'farmer' && a !== rich); x.job = new Job('farmer'); farmers.push(x); }
      const boss = farmers[0]; M.owners.farm = boss.agentId; M.pay.farm = 0.6; boss.personality.traits = (boss.personality.traits || []).filter(x => x !== 'greedy'); for (const f of farmers.slice(1)) f.mood = 20;
      const d = w._absDay(); const rnd3 = Math.random; Math.random = () => 0.1; try { MARKET.unrest(w, npcs(), d); } finally { Math.random = rnd3; }
      out.strike = (M.strike?.farm || -1) >= d && MARKET.onStrike(w, farmers[1]); Wl.bal[boss.agentId] = 500; const b0 = Wl.bal[boss.agentId]; MARKET.payroll(w, Wl, npcs()); out.noWageOnStrike = Wl.bal[boss.agentId] === b0;
      MARKET.endStrikes(w, npcs(), M.strike.farm + 1); out.raised = M.pay.farm > 0.6;
      // 11) 經營風險
      const rnd4 = Math.random; Math.random = () => 0.01; const rb = Wl.bal[boss.agentId] = 400; try { MARKET.risk(w, npcs()); } finally { Math.random = rnd4; } out.riskLoss = Wl.bal[boss.agentId] < rb;
      // 12) 房子繼承
      const heir = npcs().find(a => a !== rich && a.age >= 16 && a !== boss); heir._parentNames = [rich.name, 'z']; const owned = ESTATE.ownsOf(w, rich.agentId).length;
      const ownedIds = ESTATE.ownsOf(w, rich.agentId).map(u => u.id); const richName = rich.name, richId = rich.agentId;
      const famIds = new Set(npcs().filter(o => o !== rich && ((o._parentNames || []).includes(richName) || o.relationships?.relationships?.[richId]?.status === 'married')).map(o => o.agentId));
      try { w.lifecycle._killNpc(w, rich); } catch (e) { out.killErr = e.message; }
      out.inheritHouse = owned > 0 && ownedIds.every(id => { const o = w.agents[E.units[id].owner]; return o && famIds.has(o.agentId); });
      out.inhDbg = ownedIds.map(id => { const o = w.agents[E.units[id].owner]; return [E.units[id].owner, o?.name, o?.age, (o?._parentNames || []).join('/'), o?.relationships?.relationships?.[richId]?.status]; }).slice(0, 4);
      // 13) AI 與詳情、經濟頁
      const ten = npcs().find(a => { const u = E.units[ESTATE.unitOf(w, a)]; return u && u.owner && u.owner !== a.agentId && !(ESTATE.households(w).get(u.occ) || []).some(m => m.agentId === u.owner); }) || npcs()[1];
      const CE = Object.create(ConversationEngine.prototype); out.brief = (CE._agentBrief(w, ten, null).mem || []).join(' | ');
      const save = app.world; app.world = w; app.state = w.getState(); app.selectedAgent = ten.agentId; const box = document.createElement('div'); box.style.width = (window.innerWidth < 500 ? 340 : 420) + 'px'; document.body.appendChild(box);
      try { app.renderAgentDetail(box); } catch (e) { out.detailErr = e.message; } const md = box.querySelector('.market-detail'); out.detail = md ? md.textContent.replace(/\s+/g, ' ') : ''; out.detailOverflow = md ? md.scrollWidth > md.clientWidth + 2 : null; box.innerHTML = '';
      app._economySubTab = 'resources'; try { app.renderEconomy(box); } catch (e) { out.econErr = e.message; } const ms = box.querySelector('.market-section'); out.econ = ms ? ms.textContent.replace(/\s+/g, ' ').slice(0, 400) : ''; out.econOverflow = ms ? ms.scrollWidth > ms.clientWidth + 2 : null; box.remove(); app.world = save; app.state = save.getState();
      // 14) 存讀檔、跑幾天沒錯
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.save = !!w2.estate && Object.keys(w2.estate.units).length === Object.keys(E.units).length;
      let err = null; const d0 = w._absDay(); for (let i = 0; i < 96 * 9 && w._absDay() - d0 < 8; i++) { w.paused = false; try { w.tick(); } catch (e) { err = e.message; break; } } out.err = err;
      return out;
    });
    const zh = lang === 'zh';
    ok(r.fam.couples >= 1 && r.fam.kids >= 1, '開局就有夫妻和有爸媽的小孩', r.fam);
    ok(r.hh.hh < r.hh.pop && r.hh.units >= r.hh.hh, '以「一戶」分房：一家人住一起，房子夠所有人家', r.hh);
    ok(r.kidWithParent, '小孩跟爸媽同一戶', r.kidWithParent);
    ok(r.townRent, '公有房舍的房租進公庫', r.townRent);
    ok(r.tenantPaid >= r.rent && Math.abs(r.landlordRent - r.rent) < 0.05, '租別人的房子，房租付給房東', { paid: r.tenantPaid, got: r.landlordRent, rent: r.rent, there: r.stillThere, d: r.llDbg });
    ok(r.evicted && r.homelessThought, '付不起房租欠太多 → 被趕出去、睡廣場、無家可歸', { e: r.evicted, t: r.homelessThought });
    ok(r.rehoused, '存到錢、有空屋，又租得回來', r.rehoused);
    ok(r.lodged && /寄住|Lodging/.test(r.lodgeTxt || ''), '沒空屋時寄住別人家，詳情寫出分租', { l: r.lodged, t: r.lodgeTxt });
    ok(r.pubBuilt, '有人睡街上又沒空屋 → 公庫出錢蓋公有房舍', r.pubBuilt);
    ok(r.pubRentCheaper, '公有房舍租金比私人房東便宜', r.pubRentCheaper);
    ok(r.auction, '公有房舍標售給有錢人，變成房東', r.auction);
    ok(r.built, '缺房時有錢人蓋出租屋', r.built);
    ok(r.mortgage && r.foreclosed && !r.bankErr, '缺錢拿房子抵押；還不出來房子被銀行收走', { m: r.mortgage, f: r.foreclosed, e: r.bankErr });
    ok(r.noEarnNoInterest && r.interestFromEarn, '存款利息只從放款賺到的利息裡付', { a: r.noEarnNoInterest, b: r.interestFromEarn, d: r.depDbg });
    ok(r.hired && r.servantPaid && r.fired, '有錢人請窮人當傭人、每天付工錢；請不起就辭退', { h: r.hired, p: r.servantPaid, f: r.fired });
    ok(r.spendBig > r.spendSmall * 3, '越有錢花得越多', { s: r.spendSmall, b: r.spendBig });
    ok(r.strike && r.noWageOnStrike && r.raised, '工資壓太低又心情差 → 罷工（不上工、不領薪），結束後老闆讓步', { s: r.strike, w: r.noWageOnStrike, r: r.raised });
    ok(r.riskLoss, '產業有經營風險（失火、倒帳、遭竊）', r.riskLoss);
    ok(r.inheritHouse && !r.killErr, '屋主過世，房子由子女繼承', { i: r.inheritHouse, e: r.killErr, o: r.inhDbg });
    ok(zh ? /房子|房租|無家可歸/.test(r.brief) : /house|rent|homeless/i.test(r.brief), 'AI 決策資料知道自己住哪、付多少房租', r.brief);
    ok(!r.detailErr && (zh ? /房子|無家可歸|房租/.test(r.detail) : /house|rent|Homeless/i.test(r.detail)), '村民詳情的「生計」寫出住處', { d: r.detail, e: r.detailErr });
    ok(r.detailOverflow === false, '生計那段在這個寬度不會橫向溢出', r.detailOverflow);
    ok(!r.econErr && (zh ? /房東/.test(r.econ) && /無家可歸/.test(r.econ) : /Landlords/.test(r.econ) && /Homeless/.test(r.econ)), '經濟頁有住宅市場（房東、空屋、週租、無家可歸、傭人）', { t: r.econ, e: r.econErr });
    ok(r.econOverflow === false, '經濟頁在這個寬度不會橫向溢出', r.econOverflow);
    ok(r.save, '存讀檔保留房產', r.save);
    ok(!r.err, '跑幾天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
