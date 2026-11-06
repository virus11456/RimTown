// v6.81.0 人口與升格:人口目標跟城鎮等級走(38/72/115/140)、移民一天最多一兩個、出生不再卡 20 人、新居民不重名(含出遠門的人)、
// 雜貨商賣木材石材、升格要提案(投票＋首長批准;缺料先提進貨;60 天保底)、議員出缺遞補(出遠門保留席次)、
// 廚師裁縫分成平均分且有上限、做生意的收入繳 15% 營業稅、作物不標紅、AI 鎮況寫出糧倉狀態;存讀檔;中英面板
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch();
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const fresh = () => { w.townTheme = 'frontier'; w.townName = 'frontier'; w.rosterMode = 'scripted'; w.reset(); w.fullAgentMode = false; w.observerMode = true; };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const out = {}; fresh();
      // 1) 人口目標
      const T = TIERS.S(w); const tg = (lv, p) => { T.lv = lv; return popTargetFor(w, p); };
      out.targets = [tg(0, 50), tg(0, 100), tg(1, 100), tg(2, 100), tg(3, 100), tg(0, 0)]; T.lv = 0;
      // 2) 移民一天最多兩個(差很多也一樣)
      { const E = w.events; const n0 = npcs().length; E.TARGET_POPULATION = n0 + 30; w.stockpile.resources.food = 5000; let maxDay = 0; for (let i = 0; i < 20; i++) { const b = npcs().length; E._managePopulation(w); maxDay = Math.max(maxDay, npcs().length - b); } out.imm = { maxDay, gained: npcs().length - n0 }; }
      // 3) 出生不再卡 20 人
      { const all = npcs(); const [x, y] = all.filter(a => a.age >= 20 && a.age <= 40).slice(0, 2); if (x && y) { for (const a of all) { const p = a.relationships.getPartner?.(); if (p) p.status = 'friend'; } const rx = x.relationships.getOrCreate(y.agentId, y.name), ry = y.relationships.getOrCreate(x.agentId, x.name); rx.status = 'married'; ry.status = 'married'; rx.affinity = 80; ry.affinity = 80; }
        w.events.TARGET_POPULATION = npcs().length + 20; const rs = Math.random; Math.random = () => 0; const b = npcs().length; try { w.lifecycle._checkBirths(w); } finally { Math.random = rs; } out.birth = { pop: b, after: npcs().length }; }
      // 4) 不重名(含出遠門的人)
      { const a = npcs()[0]; out.uniq1 = uniqueVillagerName(w, a.name) !== a.name; w.events._travellingAgents.push({ agentData: { agentId: 'zz', name: '測試旅人' }, returnTick: 1e12 }); out.uniq2 = uniqueVillagerName(w, '測試旅人') !== '測試旅人'; w.events._travellingAgents.pop();
        const names = npcs().map(a => a.name); out.dupNow = names.length - new Set(names).size; }
      // 5) 雜貨商賣木材石材
      out.wood = MERCHANT_TYPES.find(m => m.specialty === 'general').sells.filter(x => x === 'wood' || x === 'stone').length;
      // 6) 升格要提案
      fresh(); const T2 = TIERS.S(w); const _met = TIERS.met; TIERS.met = () => 1;
      try {
        for (const k of ['wood', 'stone', 'furniture']) w.stockpile.resources[k] = 0; ['plank', 'hardwood', 'brick', 'marble', 'luxury_furniture'].forEach(k => { w.stockpile.resources[k] = 0; });
        w.stockpile.resources.silver = 3000;
        for (let i = 0; i < 4; i++) TIERS.daily(w);
        const PS = w.proposals; PS.cooldown = {}; PS.items = [];
        const c1 = PS._candidates(w, w._absDay() + 200);
        out.lackMat = { lv: T2.lv, buy: c1.some(c => c.key && c.key.startsWith('market:buy:tier:')), tierProp: c1.some(c => c.kind === 'tier_up') };
        w.stockpile.resources.wood = 200; w.stockpile.resources.stone = 200; w.stockpile.resources.furniture = 20;
        TIERS.daily(w); out.noAuto = T2.lv;
        PS.cooldown = {}; const c2 = PS._candidates(w, w._absDay() + 300); const tc = c2.find(c => c.kind === 'tier_up');
        out.tierCand = !!tc; out.tierText = tc ? tc.make(npcs()[0]).dk : '';
        if (tc) { const p = { ...tc.make(npcs()[0]), status: 'approved', votes: {}, id: 'Ltest', proposerId: npcs()[0].agentId }; PS.items.push(p); PS._execute(w, p, w._absDay()); out.exec = { status: p.status, result: p.result, lv: T2.lv, wood: Math.round(w.stockpile.get('wood')) }; }
        // 60 天保底
        TIERS.met = () => 2; T2.up = 0; T2.readySince = null; w.stockpile.resources.metal = 500; w.stockpile.resources.wood = 500; w.stockpile.resources.stone = 500; w.stockpile.resources.furniture = 50;
        const d0 = w._absDay(); const _ad = w._absDay.bind(w); let off = 0; w._absDay = () => _ad() + off;
        for (let i = 0; i < 5; i++) { off = i; TIERS.daily(w); } const mid = T2.lv; off = 70; TIERS.daily(w); out.fallback = { mid, after: T2.lv }; w._absDay = _ad;
      } finally { TIERS.met = _met; }
      // 7) 議員出缺遞補、出遠門保留席次
      fresh(); { const C = w.council; C._formCouncil(w); const m0 = C.members.slice(); const gone = m0[0], away = m0[1];
        w.removeAgent(gone); const ag = w.agents[away]; w.events._travellingAgents.push({ agentData: { agentId: away, name: ag.name }, returnTick: 1e12 }); delete w.agents[away];
        C.dailyUpdate(w); out.council = { before: m0.length, after: C.members.length, keepAway: C.members.includes(away), goneOut: !C.members.includes(gone), want: Math.min(TIERS.seats(w), Math.max(3, Math.floor(npcs().length / 3))) };
        w.agents[away] = ag; w.events._travellingAgents = []; }
      // 8) 分成平均分＋上限＋營業稅(用 add 的紀錄量:每位廚師從分成拿到多少)
      fresh(); { const all = npcs(); const cooks = all.slice(0, 3); cooks.forEach(c => { c.job = new Job('cook'); }); for (const a of all) WALLET.S(w).bal[a.agentId] = 50; const tax0 = WALLET.S(w).stats.bizTax || 0;
        const got = {}; const _add = w.stockpile.add.bind(w.stockpile);
        const ids = new Set(cooks.map(c => c.agentId)); const before = Object.fromEntries(cooks.map(c => [c.agentId, WALLET.get(w, c)]));
        // 只算分成:把每位廚師自己的開銷先算出來(三餐 3、衣服日 6、冬天柴 1.5)
        const d = (w._absDay ? w._absDay() : 0); const winter = w.clock?.season === '冬季';
        WALLET.S(w).lastDay = -1; try { WALLET.daily(w); } catch (e) { out.walletErr = e.message; }
        const gain = cooks.map(c => { const own = 3 + (((d + (c.agentId.length * 7)) % 10 === 0) ? 6 : 0) + (winter ? 1.5 : 0); return Math.round((WALLET.get(w, c) - before[c.agentId] + own) * 100) / 100; });
        out.tips = { gain, paidCooks: gain.filter(g => g > 0.2).length, max: Math.max(...gain), bizTax: Math.round(((WALLET.S(w).stats.bizTax || 0) - tax0) * 100) / 100, rate: WALLET.BIZ_TAX };
        // 開店的進帳繳 15%
        const o = all[5]; const s1 = w.stockpile.get('silver'); const b1 = WALLET.get(w, o); WALLET.bizIncome(w, o, 100); out.shop = { got: Math.round((WALLET.get(w, o) - b1) * 10) / 10, toTown: Math.round((w.stockpile.get('silver') - s1) * 10) / 10 }; }
      // 9) 作物不標紅、AI 鎮況寫出糧倉
      w.stockpile.resources.wheat = 5; w.stockpile.resources.food = 1900;
      app.state = w.getState(); app.activeTab = 'economy'; app._economySubTab = 'resources'; app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
      const items = [...document.querySelectorAll('.resource-item')]; const wheat = items.find(el => /小麥|Wheat/i.test(el.textContent));
      out.crop = { found: !!wheat, red: wheat ? wheat.classList.contains('res-low') : null, note: /田裡收成的作物會直接存進糧倉|Harvested crops go straight into the granary/.test(document.getElementById('rimtown-app')?.textContent || document.body.textContent) };
      out.brief = w.conversationEngine?._townBrief ? w.conversationEngine._townBrief(w) : '';
      // 議員名單顯示
      w.council._formCouncil(w);
      app.activeTab = 'proposals'; app._ppTab = 'town'; app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
      out.councilLine = ([...document.querySelectorAll('.pp-tier-line')].map(e => e.textContent).find(x => x.includes('🏛️')) || '').replace(/\s+/g, ' ');
      // 10) 存讀檔
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); let loadErr = null; try { w2.loadSave(data); } catch (e) { loadErr = e.message; } out.load = !loadErr && w2.council?.members?.length > 0;
      return out;
    });
    if (lang === 'zh') {
      ok(r.targets[0] >= 30 && r.targets[0] <= 34 && r.targets[1] === 38 && r.targets[2] === 72 && r.targets[3] === 115 && r.targets[4] === 140 && r.targets[5] <= 12, '人口上限：村莊 38、城鎮 72、城市 115、王都 140；繁榮 50 的村莊約 30～34 人', r.targets);
      ok(r.imm.maxDay <= 2 && r.imm.gained >= 3, '移民一天最多一兩個，不會一次補滿', r.imm);
      ok(r.birth.after === r.birth.pop + 1, '人口超過 20 也能生小孩(只要還沒到上限)', r.birth);
      ok(r.uniq1 && r.uniq2 && r.dupNow === 0, '新來的人不會跟鎮上或出遠門的人同名', { u1: r.uniq1, u2: r.uniq2, dup: r.dupNow });
      ok(r.wood === 2, '雜貨商賣木材和石材', r.wood);
      ok(r.lackMat.lv === 0 && r.lackMat.buy && !r.lackMat.tierProp, '夠格但缺建材：不升格、先提「為升格進一批…」', r.lackMat);
      ok(r.noAuto === 0 && r.tierCand && /升格為/.test(r.tierText), '建材備好也不會自動升格，而是提「申請升格」提案', { lv: r.noAuto, cand: r.tierCand, text: r.tierText.slice(0, 60) });
      ok(r.exec && r.exec.status === 'done' && r.exec.lv === 1 && r.exec.wood < 200, '提案通過後才正式升格並付建材', r.exec);
      ok(r.fallback.mid === 1 && r.fallback.after === 2, '夠格 60 天都沒升格就直接升(不會卡死)', r.fallback);
      ok(r.council.after >= r.council.want && r.council.keepAway && r.council.goneOut, '議員搬走就遞補、出遠門的保留席次', r.council);
      ok(!r.walletErr && r.tips.paidCooks >= 2 && r.tips.max <= 6 && Math.abs(r.tips.rate - 0.15) < 1e-9 && r.tips.bizTax > 0, '廚師分成平均給每位廚師、每人每天最多 6、要繳營業稅', r.tips);
      ok(r.shop.got === 85 && r.shop.toTown === 15, '開店進帳 100：自己拿 85、15 繳給公庫', r.shop);
      ok(r.crop.found && r.crop.red === false && r.crop.note, '小麥少不標紅，並說明作物收成直接進糧倉', r.crop);
      ok(/糧倉 1900\/\d+（糧倉滿了）/.test(r.brief) && /小麥等作物存量少是正常的/.test(r.brief), 'AI 看到的鎮況寫出糧倉狀態', r.brief.slice(-80));
      ok(r.load, '存讀檔正常', r.load);
    }
    ok(/🏛️/.test(r.councilLine) && /、|,/.test(r.councilLine), '鎮況卡列出現任議員', r.councilLine);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
