// v6.87.0 制度修正第一批:最低工資、救濟金發到人手上、公庫生活補助提案、政令真的生效(議會沒成立也會到期)、
// 銀行呆帳慢慢沖銷／重新開張歸零／擠兌後冷卻、過世的人的錢(含存款,先還貸款)由家人繼承、
// 出遠門的人錢包／頭銜／店／貸款／牢期都留著、國王出巡改攝政、存檔依人口精簡(家人關係一定留)、
// 繁榮加成最多 ±20 且慢慢消退、所有新生兒都記得爸媽(存讀檔、出遠門都保留)、訪客本機空間滿改存 IndexedDB;中英、桌機與 390px
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
      const runDay = (ww = w) => { const d0 = ww._absDay(); for (let i = 0; i < 200 && ww._absDay() === d0; i++) { ww.paused = false; ww.tick(); } ww.paused = true; };
      runDay();
      // 1) 最低工資
      const Wl = WALLET.S(w); const farmer = npcs().find(a => a.job?.key === 'farmer') || npcs().find(a => WALLET.WAGE[a.job?.key]);
      out.floor = WALLET.netOf({ tax: 0.6 }, farmer) >= WALLET.FLOOR && WALLET.FLOOR >= 4.5;
      // 2) 救濟金發到人手上、公庫生活補助
      const ps = w.proposals; const day = ps._abs(w); const all = npcs();
      const poorOnes = all.slice(0, Math.ceil(all.length * 0.4)); for (const a of poorOnes) Wl.bal[a.agentId] = 1;
      for (const a of all.slice(poorOnes.length)) Wl.bal[a.agentId] = 50;
      w.stockpile.add('silver', 3000, w.tickCount, 'test');
      const x = poorOnes[0]; const b0 = WALLET.get(w, x);
      ps._execute(w, { id: 'T1', status: 'approved', kind: 'relief', refKey: x.agentId, proposerId: all[all.length - 1].agentId, proposerName: all[all.length - 1].name, effects: {} }, day);
      out.relief = WALLET.get(w, x) - b0;
      ps.cooldown = {}; const cands = ps._candidates(w, day) || []; const st = cands.find(c => c.kind === 'stipend'); out.stipendCand = !!st;
      if (st) { const p = ps._create(w, day, st); const before = poorOnes.map(a => WALLET.get(w, a)); p.status = 'approved'; ps._execute(w, p, day); out.stipendGain = poorOnes.filter((a, i) => WALLET.get(w, a) > before[i]).length; out.stipendN = poorOnes.length; out.stipendTitle = ps.title(p); out.stipendResult = p.result || ''; }
      // 3) 政令真的生效、議會沒成立也會到期
      const C = w.council; const was = C._formed; C._formed = false; const cur = w._absDay();
      C.activeDecrees = [{ id: 'tst', title: 'x', effects: { farm_bonus: 0.3, defense_bonus: 2, raid_chance: -0.05, food_save: 0.5 }, expiresDay: cur + 2 }];
      C._aggregateDecrees(w); out.dFarm = w.news.getModifier('farm_bonus', 0); out.dDef = w.news.getModifier('defense_bonus', 0); out.dFood = w.news.getModifier('food_save', 0);
      runDay(); out.dFarm2 = w.news.getModifier('farm_bonus', 0);
      runDay(); runDay(); out.dExpired = !C.activeDecrees.some(d => d.id === 'tst') && Math.abs((w.news._decreeMods?.farm_bonus || 0) - C.activeDecrees.reduce((t2, d) => t2 + (d.effects?.farm_bonus || 0), 0)) < 1e-9; C._formed = was;
      // 4) 銀行:呆帳衰減、重新開張歸零、擠兌冷卻;過世的人的錢由家人繼承
      const B = BANK.S(w); B.open = true; B.status = 'ok'; B.banker = B.banker || all[0].agentId; B.bad = 100; B.lastRunEnd = null;
      for (let i = 0; i < 20; i++) { B.lastDay = null; B._dayFake = (B._dayFake || 0) + 1; const o = w._absDay; w._absDay = () => o.call(w) + B._dayFake; try { BANK.daily(w); } catch (e) { out.bankErr = e.message; } w._absDay = o; if (B.status === 'run') { B.status = 'ok'; B.run = null; } }
      out.bad20 = B.bad;
      const dying = all.find(a => a !== B.banker && a.age >= 25 && npcs().some(o => o !== a && (o._parentNames || []).includes(a.name))) || all[3];
      const kid = all.find(o => o !== dying && o.agentId !== B.banker && !(o._parentNames || []).length && o.age < 40) || all[4];
      kid._parentNames = [dying.name, 'someone']; Wl.bal[dying.agentId] = 30; B.dep[dying.agentId] = 40; B.reserve = Math.max(0, B.reserve || 0) + 40; out.resv = B.reserve; B.loans[dying.agentId] = { owed: 10, principal: 10, rate: 0.1, day: day, due: day + 20 };
      const kidHeirs = npcs().filter(a => a !== dying && (['married', 'dating'].includes(a.relationships?.relationships?.[dying.agentId]?.status) || (a._parentNames || []).includes(dying.name)));
      const k0 = WALLET.get(w, kid); try { w.lifecycle._killNpc(w, dying); } catch (e) { out.killErr = e.message; }
      out.inherit = Math.round((WALLET.get(w, kid) - k0) * kidHeirs.length); out.heirsN = kidHeirs.length; out.gain = WALLET.get(w, kid) - k0; out.depGone = !B.dep[dying.agentId] && !B.loans[dying.agentId];
      out.heirMem = (kid.memory.entries || []).slice(-6).map(m => (typeof m.text === 'function' ? m.text() : m.content) || '').join(' | ');
      // 5) 出遠門的人不被當成消失
      const tr = npcs().find(a => a.agentId !== B.banker && a !== kid && !a.isPlayer && a.job);
      Wl.bal[tr.agentId] = 77; const CL = CLASS.S(w); CL.titles[tr.agentId] = { k: 'knight', day: day }; const BZ = BIZ.S(w);
      BZ.shops.push({ id: 'BT', type: 'stall', owner: tr.agentId, partner: null, name: ['測試攤', 'Test stall'], price: 3, till: 0, profit: 0, week: 0, opened: day, lossDays: 0, closed: false });
      B.loans[tr.agentId] = { owed: 25, principal: 25, rate: 0.1, day: day - 40, due: day - 20 }; CIVIC.S(w).jail[tr.agentId] = w._absDay() + 30;
      kid._parentNames = [dying.name, 'someone'];
      w.events._sendAgentTravelling(w, tr, { k: '去外地看看', p: {} }, 3);
      out.away = w.isAway(tr.agentId) && !w.agents[tr.agentId];
      runDay(); runDay();
      out.keep = { bal: Wl.bal[tr.agentId], title: !!CL.titles[tr.agentId], shop: !BZ.shops.find(s => s.id === 'BT')?.closed, loan: !!B.loans[tr.agentId], jail: !!CIVIC.S(w).jail[tr.agentId] };
      // 回來
      for (const t2 of w.events._travellingAgents) if (t2.agentData.agentId === tr.agentId) t2.returnTick = w.tickCount;
      runDay(); const back = w.agents[tr.agentId]; out.back = !!back; out.backBal = back ? WALLET.get(w, back) : null;
      // 6) 新生兒記得爸媽:出生、存讀檔、出遠門
      const pa = npcs().find(a => a.age >= 22 && a.age < 45), pb = npcs().find(a => a !== pa && a.age >= 22 && a.age < 45);
      const nBefore = Object.keys(w.agents).length; w.lifecycle._birthChild(w, pa, pb, false);
      const baby = Object.values(w.agents).find(a => (a._parentNames || []).includes(pa.name) && (a._parentNames || []).includes(pb.name)); out.baby = !!baby && Object.keys(w.agents).length === nBefore + 1;
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data);
      out.babySave = !!baby && JSON.stringify(w2.agents[baby.agentId]?._parentNames || []) === JSON.stringify(baby._parentNames);
      out.decreeSave = true;
      w2.events._sendAgentTravelling(w2, w2.agents[baby.agentId], { k: '去外地看看', p: {} }, 3);
      const snap = w2.events._travellingAgents.find(t2 => t2.agentData.agentId === baby.agentId); out.babyTravel = !!snap && (snap.agentData._parentNames || []).includes(pa.name);
      w2.events._returnAgent(w2, snap); out.babyBack = (w2.agents[baby.agentId]?._parentNames || []).includes(pb.name);
      // 7) 繁榮加成 ±20、慢慢消退
      const P = w.prosperity; P.questBonus = 88; P.recalcTotal(); out.qbClamp = P.questBonus;
      for (let i = 0; i < 30; i++) { P._lastUpdateDay = -1; P.dailyUpdate(w); } out.qb30 = P.questBonus;
      // 8) 存檔精簡:人多時每人關係上限、家人一定留
      out.relCap = [CROWD.relCap(30), CROWD.relCap(80), CROWD.relCap(130)]; out.memCap = [CROWD.memCap(30), CROWD.memCap(130)];
      const big = new World(); big.townTheme = 'market'; big.townName = 'BigT'; big.rosterMode = 'scripted'; big.reset(); big.observerMode = true; ORIGIN.seed(big, 3, { seed: 11 });
      const bn = Object.values(big.agents).filter(a => !a.isPlayer); const me = bn[0], mom = bn[1];
      me._parentNames = [mom.name, 'x'];
      for (const o of bn.slice(2, 80)) { const rr = me.relationships.getOrCreate(o.agentId, o.name); rr.modifyAffinity(20 + Math.floor(Math.random() * 40)); rr.interactionCount = 5; }
      me.relationships.getOrCreate(mom.agentId, mom.name);
      const kept = CROWD.keepRels(big, me).map(([k]) => k); out.keptN = kept.length; out.momKept = kept.includes(mom.agentId); out.bigPop = bn.length;
      // 王都:國王出巡改攝政
      const KC = CROWN.S(big); for (let i = 0; i < 3 && !CROWN.king(big); i++) { KC.lastDay = null; CROWN.daily(big); }
      const king = CROWN.king(big); out.king = !!king;
      if (king) {
        const kid0 = king.agentId; big.events._sendAgentTravelling(big, king, { k: '去外地看看', p: {} }, 3); CROWN.daily(big);
        out.kingKept = KC.king === kid0 && !KC.crisis; out.regent = !!KC.regent && !!big.agents[KC.regent];
        const logs = (big.messageLog || []).map(m => big.logText ? big.logText(m) : m.content).slice(-8).join(' | '); out.regentLog = /攝政|regent/.test(logs); out.noDeath = !/駕崩|died/.test(logs);
        big.events._returnAgent(big, big.events._travellingAgents.find(t2 => t2.agentData.agentId === kid0)); big.events._travellingAgents = big.events._travellingAgents.filter(t2 => t2.agentData.agentId !== kid0);
        CROWN.daily(big); out.regentEnd = !KC.regent && CROWN.king(big)?.agentId === kid0;
      }
      // 9) 訪客本機空間滿 → 改存 IndexedDB
      const wasLogged = app.auth?.loggedIn; if (app.auth) app.auth.loggedIn = false; let alerted = false; app._gameAlert = () => { alerted = true; };
      const realSet = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('rimtown_town_') && k !== 'rimtown_town_list') throw new Error('QuotaExceededError'); return realSet.call(this, k, v); };
      const tid = app.currentTownId || ('town_' + Date.now()); app.currentTownId = tid;
      try { app._saveCurrentTown(); } catch (e) { out.saveErr = e.message; }
      if (app._quotaSpill) { try { await app._quotaSpill; } catch (e) {} }
      await new Promise(r => setTimeout(r, 600)); Storage.prototype.setItem = realSet;
      let idb = null; try { idb = await RTStore.get(tid); } catch (e) {} out.idb = !!idb && !!JSON.parse(idb).agents; out.alerted = alerted; out.idbHas = !!app._idbTowns?.has(tid);
      const card = document.querySelector('.corner-notice, #corner-notice, .corner-card'); out.notice = card ? card.textContent.replace(/\s+/g, ' ').slice(0, 120) : '';
      if (app.auth) app.auth.loggedIn = wasLogged;
      return out;
    });
    const zh = lang === 'zh';
    ok(r.floor, '最低工資：稅再高，扣稅後一天至少 4.5 銀幣', r.floor);
    ok(r.relief >= 20, '救濟金真的發到被救濟的人手上', r.relief);
    ok(r.stipendCand, '一堆人沒錢、公庫錢多時，會有人提「從公庫發放生活補助」', r.stipendCand);
    ok(r.stipendGain >= Math.ceil(r.stipendN * 0.8), '生活補助發給身上沒錢的人', { g: r.stipendGain, n: r.stipendN });
    ok(zh ? /生活補助/.test(r.stipendTitle) && /發給/.test(r.stipendResult) : /stipend/i.test(r.stipendTitle) && /Paid/.test(r.stipendResult), '生活補助的標題與結果文字有翻譯', { t: r.stipendTitle, res: r.stipendResult });
    ok(r.dFarm >= 0.3 && r.dDef >= 2 && r.dFood > 0 && r.dFood <= 0.3, '政令效果用真正的鍵生效（農作、防衛、糧食儲備有上限）', { f: r.dFarm, d: r.dDef, s: r.dFood });
    ok(r.dFarm2 >= 0.3, '隔天新聞重算後政令效果還在', r.dFarm2);
    ok(r.dExpired, '議會沒成立時，政令一樣會到期失效', r.dExpired);
    ok(r.bad20 < 60 && !r.bankErr, '銀行呆帳會慢慢沖銷（100 → 20 天後低於 60）', { b: r.bad20, e: r.bankErr });
    ok(/ 60 /.test(r.heirMem) && r.gain > 0 && r.depGone && !r.killErr, '過世的人的錢包 30＋存款 40 先還貸款 10，家人繼承 60', { i: r.inherit, g: r.depGone, e: r.killErr, n: r.heirsN, gain: r.gain, res: r.resv });
    ok(zh ? /繼承了/.test(r.heirMem) : /Inherited/.test(r.heirMem), '繼承人記得自己繼承了遺產', r.heirMem);
    ok(r.away, '出遠門的人標記成「不在鎮上」', r.away);
    ok(r.keep.bal === 77 && r.keep.title && r.keep.shop && r.keep.loan && r.keep.jail, '出遠門期間錢包、頭銜、店、貸款、牢期都留著', r.keep);
    ok(r.back && r.backBal >= 57, '回來後錢還在（只少了回來當天的開銷）', { b: r.back, bal: r.backBal });
    ok(r.baby, '新生兒記得爸媽是誰（不只玩家的孩子）', r.baby);
    ok(r.babySave, '存讀檔後爸媽還在', r.babySave);
    ok(r.babyTravel && r.babyBack, '出遠門再回來，爸媽還在', { t: r.babyTravel, b: r.babyBack });
    ok(r.qbClamp === 20, '舊存檔 +88 的繁榮加成會被壓回 +20', r.qbClamp);
    ok(r.qb30 >= 0 && r.qb30 < 10, '繁榮加成一個月內明顯消退（+20 → 30 天後不到 +10）', r.qb30);
    ok(r.relCap[0] === 40 && r.relCap[2] < r.relCap[1] && r.memCap[1] < r.memCap[0], '人越多，每人存的關係與記憶越少', { r: r.relCap, m: r.memCap });
    ok(r.bigPop >= 100 && r.keptN <= 24 && r.momKept, '大城裡關係超過上限也一定留住家人', { p: r.bigPop, n: r.keptN, m: r.momKept });
    ok(r.king, '王都有國王', r.king);
    if (r.king) {
      ok(r.kingKept && r.regent && r.regentLog && r.noDeath, '國王出巡：不算駕崩、不開始繼承，改由攝政', { k: r.kingKept, r: r.regent, l: r.regentLog, d: r.noDeath });
      ok(r.regentEnd, '國王回來後攝政結束', r.regentEnd);
    }
    ok(r.idb && r.idbHas && !r.alerted && !r.saveErr, '訪客本機空間滿：存檔改放 IndexedDB，不跳「空間已滿」', { i: r.idb, h: r.idbHas, a: r.alerted, e: r.saveErr });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
