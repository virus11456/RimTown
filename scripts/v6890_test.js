// v6.89.0 產權、雇傭與市場:公營產業標售給有錢人、私人產業由老闆發薪(公庫只發公職)、三餐錢流向食堂與農莊老闆(扣營業稅)、
// 虧錢砍薪與吝嗇壓薪、欠薪與週轉不靈賣產業、家人接濟飯錢、沒人幫就挨餓(沒力氣、餓死或離鄉)、老闆過世由家人繼承、
// 公庫工程款付給承包商、葬禮費付給神職與食堂、AI 知道自己的生計、經濟頁與詳情、存讀檔;中英、桌機與 390px
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
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {}; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const runDay = () => { const d0 = w._absDay(); for (let i = 0; i < 200 && w._absDay() === d0; i++) { w.paused = false; w.tick(); } w.paused = true; };
      runDay(); const Wl = WALLET.S(w); const M = MARKET.S(w); const all = npcs(); const sp = w.stockpile;
      const treas = () => sp.get('silver'); const bal = (a) => Wl.bal[a.agentId] || 0;
      // 1) 公營產業標售:同行裡最有錢的人買下
      M.owners = {}; M.hist = {}; const farmers = all.filter(a => a.job?.key === 'farmer'); const rich = farmers[0]; Wl.bal[rich.agentId] = 500;
      const t0 = treas(); MARKET.assign(w, all, w._absDay()); out.bought = M.owners.farm === rich.agentId && bal(rich) < 500 && treas() > t0;
      // 2) 私人產業由老闆發薪,公庫只發公職
      const workers = farmers.filter(a => a !== rich); const bossBefore = bal(rich); const wBefore = workers.map(bal); const tBefore = treas();
      const guard = all.find(a => MARKET.PUBLIC.includes(a.job?.key));
      MARKET.payroll(w, Wl, all); out.bossPaid = bal(rich) < bossBefore && workers.every((a, i) => bal(a) > wBefore[i]); out.privatePaid = MARKET.privatePaid(w, workers[0] || rich) && (!guard || !MARKET.privatePaid(w, guard));
      out.taxIn = treas() > tBefore;
      // 3) 三餐錢流向老闆(扣營業稅)
      const b2 = bal(rich); MARKET.sale(w, 'meal', 100); out.mealToOwner = Math.round((bal(rich) - b2) * 100) / 100; out.hasKitchen = all.some(a => a.job?.key === 'cook');
      // 3b) 營所稅照利潤課;不老實的老闆少報
      { const honest = all.find(a => a !== rich && a.job?.key !== 'farmer'); const keep = { ...M.owners }; const saveHist = { ...M.hist };
        honest.personality.traits = (honest.personality.traits || []).filter(x => x !== 'greedy'); honest.personality.values = (honest.personality.values || []).filter(x => x !== '財富');
        M.owners = { farm: honest.agentId }; M.hist = { farm: Array.from({ length: 7 }, () => [100, 20]) }; Wl.bal[honest.agentId] = 1000; MARKET.corpTax(w, all); out.corpHonest = Math.round((1000 - bal(honest)) * 100) / 100;
        honest.personality.traits.push('greedy'); Wl.bal[honest.agentId] = 1000; MARKET.corpTax(w, all); out.corpShady = Math.round((1000 - bal(honest)) * 100) / 100;
        honest.personality.traits = honest.personality.traits.filter(x => x !== 'greedy'); M.owners = keep; M.hist = saveHist; }
      // 4) 虧錢就砍薪、吝嗇的老闆壓薪
      M.hist.farm = Array.from({ length: 7 }, () => [5, 60]); M.pay.farm = 1; MARKET.adjust(w, all); out.cut = M.pay.farm;
      M.hist.farm = Array.from({ length: 7 }, () => [300, 60]); M.pay.farm = 1; rich.personality.traits = [...new Set([...(rich.personality.traits || []), 'greedy'])]; MARKET.adjust(w, all); out.greedy = M.pay.farm;
      // 5) 欠薪與週轉不靈:老闆沒錢 → 工人沒拿到錢;連三天 → 賣給出得起錢的人
      M.pay.farm = 1; Wl.bal[rich.agentId] = 0; const buyer = all.find(a => a !== rich && a.job?.key !== 'farmer'); Wl.bal[buyer.agentId] = 2000;
      for (let i = 0; i < 3; i++) MARKET.payroll(w, Wl, all);
      out.unpaidThought = !!(workers[0]?.thoughts || []).some(x => x.kind === 'boss_unpaid');
      MARKET.assign(w, all, w._absDay()); out.sold = M.owners.farm === buyer.agentId && bal(rich) > 0;
      // 6) 家人接濟飯錢
      const kid = all.find(a => a !== rich && a !== buyer && a.age >= 16); const par = all.find(a => a !== kid && a !== rich && a !== buyer);
      kid._parentNames = [par.name, 'x']; Wl.bal[kid.agentId] = 0; Wl.bal[par.agentId] = 50;
      const fedBy = MARKET.feed(w, kid, 3); out.familyFed = fedBy === par && bal(par) === 47;
      // 7) 沒人幫就挨餓:沒力氣、餓死
      const lone = all.find(a => ![rich, buyer, kid, par].includes(a) && a.age >= 20 && a.age < 60); kid._parentNames = [];
      for (const o of all) { const rr = lone.relationships.relationships; for (const k in rr) { rr[k].status = null; } }
      lone._parentNames = []; for (const o of all) if ((o._parentNames || []).includes(lone.name)) o._parentNames = [];
      Wl.bal[lone.agentId] = 0; out.noHelp = MARKET.feed(w, lone, 3) === null;
      M.hungry[lone.agentId] = 7; const rnd = Math.random; Math.random = () => 0.001; const pop0 = npcs().length;
      try { MARKET.hunger(w, npcs()); } finally { Math.random = rnd; }
      const grave = (w.lifecycle.graveyard || []).find(g => g.name === lone.name); out.starved = !w.agents[lone.agentId] && !!grave; out.cause = grave?.cause || grave?.deathCause || '';
      const h3 = all.find(a => w.agents[a.agentId] && ![rich, buyer, kid, par, lone].includes(a)); M.hungry[h3.agentId] = 3; MARKET.hunger(w, npcs()); out.starvingThought = (h3.thoughts || []).some(x => x.kind === 'starving');
      // 8) 老闆過世,家人繼承
      const heir = all.find(a => w.agents[a.agentId] && ![buyer, kid, par, lone, h3].includes(a) && a.age >= 16); heir._parentNames = [buyer.name, 'y']; /* v6.90 開局有家族:先清掉老闆原本的配偶與子女,只留這個繼承人 */ for (const o of Object.values(w.agents)) { if (o === buyer || o === heir) continue; if ((o._parentNames || []).includes(buyer.name)) o._parentNames = o._parentNames.filter(n => n !== buyer.name); const rr = o.relationships?.relationships?.[buyer.agentId]; if (rr && ['married', 'dating'].includes(rr.status)) rr.status = 'ex'; } for (const rr of Object.values(buyer.relationships?.relationships || {})) if (['married', 'dating'].includes(rr.status)) rr.status = 'ex';
      try { w.lifecycle._killNpc(w, buyer); } catch (e) { out.killErr = e.message; } out.inherit = M.owners.farm === heir.agentId;
      // 9) 公庫工程款付給承包商
      const cs = npcs().find(a => a.job?.key === 'carpenter' || a.job?.key === 'miner' || a.job?.key === 'blacksmith');
      if (cs) { const k = MARKET.JOB2S[cs.job.key]; M.owners[k] = cs.agentId; for (const kk of ['timber', 'mine', 'forge']) if (kk !== k) M.owners[kk] = M.owners[kk] || null; const c0 = bal(cs); sp.add('silver', 500, w.tickCount, 'test'); sp.consume('silver', 100, w.tickCount, t('建築維護'), 'upkeep'); out.procure = Math.round((bal(cs) - c0) * 10) / 10; }
      // 10) AI 決策資料、詳情、經濟頁
      const CE = w.conversationEngine || Object.create(ConversationEngine.prototype);
      out.briefOwner = (CE._agentBrief(w, heir, null).mem || []).join(' | ');
      const fw = npcs().find(a => a.job?.key === 'farmer' && a !== heir); out.briefWorker = fw ? (CE._agentBrief(w, fw, null).mem || []).join(' | ') : 'none';
      app.state = w.getState(); app.selectedAgent = heir.agentId; const box = document.createElement('div'); box.style.width = (window.innerWidth < 500 ? 340 : 420) + 'px'; document.body.appendChild(box);
      app.renderAgentDetail(box); const md = box.querySelector('.market-detail'); out.detail = md ? md.textContent.replace(/\s+/g, ' ') : ''; out.detailOverflow = md ? md.scrollWidth > md.clientWidth + 2 : null; box.innerHTML = '';
      app._economySubTab = 'resources'; try { app.renderEconomy(box); } catch (e) { out.econErr = e.message; } const ms = box.querySelector('.market-section'); out.econ = ms ? ms.textContent.replace(/\s+/g, ' ').slice(0, 300) : ''; out.econRows = ms ? ms.querySelectorAll('.market-row').length : 0; out.econOverflow = ms ? ms.scrollWidth > ms.clientWidth + 2 : null; box.remove();
      // 11) 存讀檔、跑幾天沒錯、吉尼係數
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.save = !!w2.market && w2.market.owners.farm === M.owners.farm;
      let err = null; for (let i = 0; i < 5; i++) { try { runDay(); } catch (e) { err = e.message; break; } } out.err = err; out.gini = MARKET.gini(w);
      return out;
    });
    const zh = lang === 'zh';
    ok(r.bought, '公營產業標售：同行裡最有錢的人出錢買下，錢進公庫', r.bought);
    ok(r.bossPaid && r.privatePaid, '私人產業的工資由老闆自己付；公職才由公庫發', { b: r.bossPaid, p: r.privatePaid });
    ok(r.taxIn, '工資的所得稅進公庫', r.taxIn);
    ok(r.mealToOwner > 0 && r.mealToOwner <= 95.01, '三餐的錢流向產業老闆（先扣 5% 營業稅）', { got: r.mealToOwner, kitchen: r.hasKitchen });
    ok(Math.abs(r.corpHonest - (700 * 0.95 - 140) * 0.12) < 0.5, '老闆每週照利潤繳營利事業所得稅（12%）', r.corpHonest);
    ok(r.corpShady > 0 && r.corpShady < r.corpHonest * 0.7, '吝嗇的老闆少報利潤、稅繳得少；上班族的薪資稅是扣繳的', { h: r.corpHonest, s: r.corpShady });
    ok(r.cut < 1, '虧錢的老闆砍工資', r.cut);
    ok(r.greedy < 1, '吝嗇的老闆就算賺錢也壓工資', r.greedy);
    ok(r.unpaidThought, '老闆沒錢：工人領不到工資、心情變差', r.unpaidThought);
    ok(r.sold, '連欠三天、老闆身無分文 → 產業賣給出得起錢的人', r.sold);
    ok(r.familyFed, '自己沒錢，家人出飯錢', r.familyFed);
    ok(r.noHelp, '沒家人幫就吃不到', r.noHelp);
    ok(r.starvingThought, '餓三天：好幾天沒吃飽（心情差、沒力氣）', r.starvingThought);
    ok(r.starved && (zh ? /餓死/.test(r.cause) : /Starved/i.test(r.cause)), '餓太久會餓死，墓碑記死因', { s: r.starved, c: r.cause });
    ok(r.inherit && !r.killErr, '老闆過世，成年子女繼承產業', { i: r.inherit, e: r.killErr });
    ok(r.procure === undefined || r.procure > 0, '公庫的維護費、工程款大半付給承包商老闆', r.procure);
    ok(zh ? /老闆/.test(r.briefOwner) : /own/i.test(r.briefOwner), 'AI 決策資料：老闆知道自己有產業、僱了幾個人', r.briefOwner);
    ok(r.briefWorker === 'none' || (zh ? /做工/.test(r.briefWorker) : /work at/i.test(r.briefWorker)), 'AI 決策資料：工人知道自己替誰做工、工資幾成', r.briefWorker);
    ok(zh ? /老闆/.test(r.detail) : /Owner/.test(r.detail), '村民詳情有「生計」', r.detail);
    ok(r.detailOverflow === false, '生計那段在這個寬度不會橫向溢出', r.detailOverflow);
    ok(r.econRows >= 1 && (zh ? /吉尼/.test(r.econ) : /Gini/.test(r.econ)) && !r.econErr, '經濟頁有「產業與老闆」與貧富差距', { n: r.econRows, t: r.econ, e: r.econErr });
    ok(r.econOverflow === false, '產業表在這個寬度不會橫向溢出', r.econOverflow);
    ok(r.save, '存讀檔保留產業主', r.save);
    ok(!r.err && typeof r.gini === 'number', '跑幾天沒有錯誤', { e: r.err, g: r.gini });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
