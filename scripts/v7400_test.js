// v7.4.0 身體與醫療＋生技時代:五部位影響工作／走路／睡眠／壽命、病痛來源、看診吃藥、手術(成功／失敗／死亡)、移植(捐贈、排斥)、輔具、
// 醫療費金流守恆(自己／家人／工會／公費／湊不齊原路退回)、公費醫療補助提案、生技時代門檻(城市＋研究院)、研究院研究上限、存讀檔、畫面(中英、桌機與 390px)
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const sp = w.stockpile; WALLET.S(w); const H = HEALTH.S(w); const R0 = Math.random;
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const all = npcs(); const [A, B, C, D] = all; const doc = all.find(a => a.job?.key === 'doctor') || D; if (doc.job?.key !== 'doctor') doc.job = new Job('doctor');
      const inTown = () => (sp.get('silver') || 0) + Object.values(w.wallet.bal).reduce((s, v) => s + (v || 0), 0) + (w.union?.fund || 0) + (w.bank ? (BANK.S(w).reserve || 0) : 0);
      // 1) 部位影響:手→工作、眼→研究員、腳→走路、肺→睡眠、心→壽命
      A.job = new Job('researcher'); HEALTH.setPart(w, A, 'h', 50); HEALTH.setPart(w, A, 'e', 40); HEALTH.setPart(w, A, 'f', 0); HEALTH.setPart(w, A, 'l', 30); HEALTH.setPart(w, A, 'c', 25);
      out.fx = { work: HEALTH.workMult(w, A), speed: HEALTH.speed(A.agentId), sleep: HEALTH.sleepMult(w, A), death: HEALTH.deathMult(w, A), fresh: HEALTH.workMult(w, B), stored: !!H.b[A.agentId], clean: !H.b[B.agentId] };
      for (const p of HEALTH.PARTS) HEALTH.setPart(w, A, p, 100); out.fx.cleared = !H.b[A.agentId];
      // 2) 病痛最多記兩樣
      HEALTH.addAil(w, B, { p: 'h', k: 'injury', s: 1, dmg: 10 }, '打架'); HEALTH.addAil(w, B, { p: 'l', k: 'fever', s: 1 }, '風寒'); HEALTH.addAil(w, B, { p: 'c', k: 'disease', s: 2 }, '心臟病');
      out.ail = { n: HEALTH.ails(w, B).length, hand: HEALTH.body(w, B).h };
      // 3) 付錢守恆:自己付;家人幫;工會互助;公費補助;湊不齊原路退回
      const set = (a, n) => { w.wallet.bal[a.agentId] = n; };
      set(A, 100); set(doc, 0); let t0 = inTown(); let s0 = sp.get('silver'); let res = HEALTH.pay(w, A, 50, '手術', doc);
      out.pay1 = { ok: res.ok, doc: WALLET.get(w, doc), self: WALLET.get(w, A), tre: Math.round((sp.get('silver') - s0) * 100) / 100, drift: Math.round((inTown() - t0) * 100) / 100 };
      set(A, 5); set(B, 200); A._parentNames = [B.name]; t0 = inTown(); res = HEALTH.pay(w, A, 60, '手術', doc); out.pay2 = { ok: res.ok, by: res.by, fam: WALLET.get(w, B), drift: Math.round((inTown() - t0) * 100) / 100 };
      set(A, 0); set(B, 0); HEALTH.family(w, A).forEach(f => set(f, 0)); w.union = w.union || {}; Object.assign(w.union, { on: true, members: { [A.agentId]: 1 }, fund: 100 }); H.medaid = true; sp.resources.silver = 1000; if (w.bank) BANK.S(w).open = false;
      t0 = inTown(); res = HEALTH.pay(w, A, 80, '手術', doc); out.pay3 = { ok: res.ok, by: res.by, fund: w.union.fund, drift: Math.round((inTown() - t0) * 100) / 100 };
      w.union.fund = 0; H.medaid = false; set(A, 10); set(B, 10); t0 = inTown(); const a0 = WALLET.get(w, A), b0 = WALLET.get(w, B);
      res = HEALTH.pay(w, A, 500, '手術', doc); out.pay4 = { ok: res.ok, back: WALLET.get(w, A) === a0 && WALLET.get(w, B) === b0, drift: Math.round((inTown() - t0) * 100) / 100 };
      w.union.on = false;
      // 4) 開刀:沒有醫院＋外科醫學不能開;有了以後成功、失敗都會發生
      out.noOp = HEALTH.canSurgery(w);
      const P = w.research.projects; for (const k of ['surgery', 'anatomy', 'chemistry']) if (P[k]) P[k].status = 'complete';
      w.buildings.completed = w.buildings.completed || []; if (!w.buildings.completed.some(b => b.buildingKey === 'hospital')) w.buildings.completed.push({ buildingKey: 'hospital', name: BUILDING_TEMPLATES.hospital.name, level: 1 });
      out.canOp = HEALTH.canSurgery(w); out.rate = { young: HEALTH.successRate(w, { age: 30 }, doc, 2), old: HEALTH.successRate(w, { age: 80 }, doc, 3) };
      H.a[C.agentId] = [{ p: 'h', k: 'injury', s: 2, d: 0 }]; HEALTH.setPart(w, C, 'h', 30); Math.random = () => 0.5; const rt = HEALTH.successRate(w, C, doc, 2);
      Math.random = (() => { let i = 0; return () => (i++ === 0 ? 0.99 : 0.01); })(); HEALTH.surgery(w, C, H.a[C.agentId][0], doc, H, 60); out.opOk = { hand: HEALTH.body(w, C).h, ails: HEALTH.ails(w, C).length };
      H.a[C.agentId] = [{ p: 'f', k: 'injury', s: 2, d: 0 }]; HEALTH.setPart(w, C, 'f', 40); Math.random = (() => { let i = 0; return () => (i++ === 0 ? 0.99 : 0.999); })(); HEALTH.surgery(w, C, H.a[C.agentId][0], doc, H, 60); out.opBad = { foot: HEALTH.body(w, C).f, ails: HEALTH.ails(w, C).length };
      Math.random = R0;
      // 5) 移植:心肺要免疫學;過世村民捐贈 → 排隊的人換上
      HEALTH.setPart(w, B, 'c', 20); H.a[B.agentId] = []; out.txHeartBefore = HEALTH.transplantable(w, 'c');
      if (P.immunology) P.immunology.status = 'complete'; out.txHeartAfter = HEALTH.transplantable(w, 'c');
      const donor = C; Math.random = () => 0.01; HEALTH.onDeath(w, donor); Math.random = R0; out.bank = H.bank.map(o => o.p);
      set(B, 500); let d0 = sp.get('silver'); Math.random = () => 0.99; HEALTH.daily.call ? null : null;
      // 直接呼叫排隊配對(同一天的 daily 只跑一次,這裡手動跑一遍)
      H.lastDay = -1; const keepTreat = HEALTH.view; Math.random = (() => { let i = 0; return () => (i++ < 400 ? 0.5 : 0.99); })();
      HEALTH.daily(w); Math.random = R0;
      out.tx = { heart: HEALTH.body(w, B).c, q: H.q.length, st: H.st.tx };
      // 6) 輔具:眼睛差配眼鏡(錢付給鐵舖老闆或公庫),有效視力提高
      HEALTH.setPart(w, D, 'e', 50); set(D, 100); t0 = inTown(); H.lastDay = -1; Math.random = () => 0.99; HEALTH.daily(w); Math.random = R0;
      out.glasses = { aid: (H.aid[D.agentId] || []).includes('glasses'), eff: HEALTH.eff(w, D, 'e'), raw: HEALTH.body(w, D).e, drift: Math.round((inTown() - t0) * 100) / 100 };
      // 7) 公費醫療補助提案
      H.medaid = false; H.lastProp = -99; H.ob = { [A.agentId]: w._absDay(), [B.agentId]: w._absDay(), [D.agentId]: w._absDay() }; sp.resources.silver = 800; w.proposals.items = w.proposals.items.filter(p => p.kind !== 'medaid');
      const mp = HEALTH.proposal(w, H, w._absDay()); out.medaid = mp ? mp.kind : null; out.setAid = !!HEALTH.setAid(w) && H.medaid;
      // 8) 生技時代:要城市＋研究院;研究院讓每天研究點上限多 40
      for (const k of Object.keys(P)) if (P[k].era === 4) P[k].status = 'complete'; w.research.refreshLocks();
      const T = TIERS.S ? TIERS.S(w) : null; const lv0 = TIERS.level; TIERS.level = () => 1;
      out.bio = { exists: ['microbiology', 'antibiotics', 'immunology', 'prosthetics', 'genetics', 'regen_medicine'].every(k => P[k]?.era === 5), era: !!RESEARCH_ERAS[5], gatedSmall: !w.research.getAvailable().some(p => p.era === 5), canBuildSmall: HEALTH.canBuild(w, 'institute') };
      TIERS.level = () => 2; out.bio.canBuildCity = HEALTH.canBuild(w, 'institute'); out.bio.gatedNoInst = !w.research.getAvailable().some(p => p.era === 5 && TECH.onPath(p.key, 'bio')); for (const k of Object.keys(P)) if (P[k].era === 4) P[k].status = 'complete'; /* v7.9.0 生技屬於基因生物路線(育種時代研究完才開) */
      w.buildings.completed.push({ buildingKey: 'institute', name: BUILDING_TEMPLATES.institute.name, level: 1 }); w.buildings.activeEffects = w.buildings.activeEffects || {}; w.buildings.activeEffects.research_cap = (w.buildings.activeEffects.research_cap || 0) + 40;
      out.bio.open = w.research.getAvailable().some(p => p.key === 'microbiology'); out.bio.cap = w.buildings.getEffect('research_cap', 0); TIERS.level = lv0;
      // 9) 存讀檔
      HEALTH.setPart(w, A, 'h', 33); H.a[A.agentId] = [{ p: 'l', k: 'disease', s: 2, d: 1 }]; const data = w.serialize(); const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(data)));
      out.save = { hand: w2.health?.b?.[A.agentId]?.[1], ail: w2.health?.a?.[A.agentId]?.[0]?.s, medaid: w2.health?.medaid };
      out.brief = HEALTH.brief(w, A); out.town = HEALTH.townBrief(w);
      // 10) 打架:互相討厭到極點的人會動手,輸的受傷
      const adl = all.slice(4).filter(a => (a.age ?? 30) >= 16 && !w.isAway?.(a.agentId) && a !== doc); const E = adl[0] || all[4], F = adl[1] || all[5]; /* 要大人:不到 14 歲不會打架 */ for (const x of [E, F]) { HEALTH.setPart(w, x, 'c', 90); HEALTH.setPart(w, x, 'l', 90); } /* 隨機數壓到 0.001 時心肺差的人會當場病死,先讓兩人身體健康 */ const re = E.relationships.getOrCreate(F.agentId, F.name); re.affinity = -95; F.relationships.getOrCreate(E.agentId, E.name).affinity = -95; /* 兩邊都設:冷靜又善良的人自己不會先動手 */ H.lastDay = -1; const f0 = H.st.fights; Math.random = () => 0.001; HEALTH.daily(w); Math.random = R0;
      out.fight = { n: H.st.fights - f0, hurt: HEALTH.ails(w, E).length + HEALTH.ails(w, F).length };
      // 11) AI 知道自己的身體
      const sel = npcs()[0]; HEALTH.setPart(w, sel, 'f', 45);
      app.state = w.getState(); app.selectedAgent = sel.agentId;
      return out;
    });
    ok(r.fx.work < 0.6 && r.fx.fresh > 0.95 && Math.abs(r.fx.speed - 0.4) < 0.01 && r.fx.sleep < 0.7 && r.fx.death > 3.5 && r.fx.stored && r.fx.clean && r.fx.cleared, '五個部位：手眼影響工作、腳影響走路、肺影響睡眠、心臟影響壽命；健康的人不存資料', r.fx);
    ok(r.ail.n === 2 && r.ail.hand <= 90, '病痛最多記兩樣、受傷會扣部位', r.ail);
    ok(r.pay1.ok && r.pay1.doc === 30 && r.pay1.tre === 20 && r.pay1.self === 50 && r.pay1.drift === 0, '醫療費：醫生拿六成、公庫四成，鎮上的錢總數不變', r.pay1);
    ok(r.pay2.ok && r.pay2.by.includes('family') && r.pay2.drift === 0, '自己不夠時家人幫忙出（守恆）', r.pay2);
    ok(r.pay3.ok && r.pay3.by.includes('union') && r.pay3.by.includes('aid') && r.pay3.fund < 100 && r.pay3.drift === 0, '工會互助金與公費補助幫付（守恆）', r.pay3);
    ok(!r.pay4.ok && r.pay4.back && r.pay4.drift === 0, '湊不齊：已收的錢原路退回', r.pay4);
    ok(!r.noOp && r.canOp && r.rate.young > r.rate.old, '要醫院＋外科醫學才能開刀；年輕、輕症成功率較高', { noOp: r.noOp, canOp: r.canOp, rate: r.rate });
    ok(r.opOk.hand >= 85 && r.opOk.ails === 0 && r.opBad.foot <= 26 && r.opBad.ails === 1, '手術成功恢復；失敗留下後遺症', { ok: r.opOk, bad: r.opBad });
    ok(!r.txHeartBefore && r.txHeartAfter && r.bank.includes('c'), '心臟移植要免疫學；過世村民同意捐贈後有器官', { b: r.txHeartBefore, a: r.txHeartAfter, bank: r.bank });
    ok(r.tx.heart >= 90 && r.tx.st >= 1, '排隊等移植的人換上捐贈的心臟', r.tx);
    ok(r.glasses.aid && r.glasses.eff > r.glasses.raw && Math.abs(r.glasses.drift) <= 0.05, '眼睛差的人配眼鏡，有效視力提高（錢付給鎮上的人，守恆）', r.glasses);
    ok(r.medaid === 'medaid' && r.setAid, '近 30 天三個人以上付不起醫藥費：有人提案公費醫療補助', { m: r.medaid, s: r.setAid });
    ok(r.bio.exists && r.bio.era && r.bio.gatedSmall && !r.bio.canBuildSmall && r.bio.canBuildCity && r.bio.gatedNoInst && r.bio.open && r.bio.cap >= 40, '生技時代 6 項：要城市才蓋得了研究院，有研究院才研究得了；研究院多 40 研究上限', r.bio);
    ok(r.save.hand === 33 && r.save.ail === 2 && r.save.medaid === true, '身體與醫療存讀檔', r.save);
    ok(r.fight.n >= 1 && r.fight.hurt >= 1, '仇人會打架，輸的受傷', r.fight);
    ok(/身體|Body/.test(r.brief) && !!r.town, 'AI 知道自己的身體、鎮上的病人', { b: r.brief, t: r.town });
    // 畫面:村民卡的身體、小鎮概況的健康卡
    await page.evaluate(() => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab('detail'); else { app.activeTab = 'detail'; app.renderSidebar(); } }); await page.waitForTimeout(500);
    const ui1 = await page.evaluate(() => { const s = document.querySelector('.body-section'); return s ? { rows: s.querySelectorAll('.hb-row').length, txt: s.textContent, cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []) } : null; });
    ok(!!ui1 && ui1.rows === 5, '村民卡顯示五個部位與病痛', ui1 && { rows: ui1.rows });
    await page.evaluate(() => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab('economy'); else { app.activeTab = 'economy'; app.renderSidebar(); } }); await page.waitForTimeout(500);
    const ui2 = await page.evaluate(() => { const s = document.querySelector('.health-section'); return s ? { txt: s.textContent.slice(0, 200), cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []), over: s.scrollWidth > s.clientWidth + 2 } : null; });
    ok(!!ui2 && !ui2.over, '小鎮概況有健康卡（不橫向溢出）', ui2);
    if (lang === 'en') ok(ui1 && ui2 && !ui1.cjk.length && !ui2.cjk.filter(x => !/醫院|測試/.test(x)).length, '英文沒有中文', { a: ui1?.cjk, b: ui2?.cjk });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
