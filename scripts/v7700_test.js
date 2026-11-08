// v7.7.0 錢從哪來、往哪去:商人與鎮長不再憑空產錢、商人真的出口(守恆:外地付錢,本錢進公庫、加價歸商人)、
// 加銀幣的效果改成賣多餘的貨、銀行利息由銀行賺到的利息支付、小孩從 0 開始由爸媽付飯錢、外地包商的工程款記進月報、
// 月報總帳對得上、外地同名用「出生地・本名」(前綴不疊加、英文名、存讀檔)、概況卡(中英、桌機與 390px)
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
      const w = app.world; w.observerMode = true; const out = {}; const sp = w.stockpile; WALLET.S(w); MARKET.S(w); const R0 = Math.random;
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const all = npcs(); const adults = all.filter(a => (a.age ?? 30) >= 18);
      const T = () => MONEY.total(w); const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      // 1) 商人、鎮長不再憑空產出銀幣
      out.noMint = { trader: Object.keys(JOB_PRODUCTION.trader.outputs || {}).length, mayor: Object.keys(JOB_PRODUCTION.mayor.outputs || {}).length };
      // 2) 商人出口:多的貨運去外地,外地付的錢 = 本錢進公庫＋加價是商行營收(有老闆給老闆、扣營業稅;公營進公庫)
      for (const a of all) if (a.job?.key === 'trader') a.job = new Job('farmer');
      const tr = adults[0]; tr.job = new Job('trader'); const fl = MONEY.floors(w); const boss = adults[1]; MARKET.S(w).owners.trade = boss.agentId; const b0 = WALLET.get(w, boss);
      for (const r of Object.keys(fl)) sp.resources[r] = Math.min(sp.get(r) || 0, fl[r]); sp.resources.tools = fl.tools + 5;
      const M = MONEY.S(w); M.pend = 0; const t0 = T(), s0 = sp.get('silver'), w0 = WALLET.get(w, tr), tools0 = sp.get('tools'); const e0 = M.st.exportSale;
      fix(0.9, () => MONEY.exportDaily(w)); const sale = Math.round((M.st.exportSale - e0) * 100) / 100;
      out.exp = { sold: tools0 - sp.get('tools'), sale, tre: Math.round((sp.get('silver') - s0) * 100) / 100, trader: Math.round((WALLET.get(w, tr) - w0) * 10) / 10, boss: Math.round((WALLET.get(w, boss) - b0) * 100) / 100, gain: Math.round((T() - t0) * 100) / 100, flow: Math.round(M.pend * 100) / 100 };
      for (const r of Object.keys(fl)) sp.resources[r] = Math.min(sp.get(r) || 0, fl[r]); const tN = T(); fix(0.9, () => MONEY.exportDaily(w)); out.exp.noneWhenNoSurplus = Math.round((T() - tN) * 100) / 100;
      MARKET.S(w).owners.trade = null; sp.resources.tools = fl.tools + 5; const q0 = sp.get('silver'), pw0 = WALLET.get(w, tr), pT = T(); fix(0.9, () => MONEY.exportDaily(w)); out.exp.pub = { tre: Math.round((sp.get('silver') - q0) * 100) / 100, gain: Math.round((T() - pT) * 100) / 100, trader: Math.round((WALLET.get(w, tr) - pw0) * 100) / 100 }; for (const r of Object.keys(fl)) sp.resources[r] = Math.min(sp.get(r) || 0, fl[r]);
      // 3) 加銀幣的效果:真的把多餘的貨賣掉;沒有多的貨就沒錢
      sp.resources.food = fl.food + 30; const f0 = sp.get('food'), s1 = sp.get('silver'); const got = MONEY.sellSurplus(w, 20, 'test'); const foodUsed = f0 - sp.get('food'), silverGot = Math.round((sp.get('silver') - s1) * 100) / 100;
      sp.resources.food = fl.food; const got0 = MONEY.sellSurplus(w, 20, 'test');
      const p0 = sp.get('silver'); sp.resources.food = fl.food + 40; w.proposals._applyPolicy(w, { effects: { silver: 15 }, kind: 'policy', id: 'T', title: 'x' }); const pol = Math.round((sp.get('silver') - p0) * 100) / 100;
      out.surplus = { got, food: foodUsed, silver: silverGot, none: got0, pol };
      // 4) 銀行利息:由銀行賺到的利息支付;沒銀行就沒有
      const ge = w.buildings.getEffect.bind(w.buildings); w.buildings.getEffect = (k, d) => (k === 'interest' ? 0.02 : ge(k, d));
      sp.resources.silver = 1000; const B = BANK.S(w); B.open = false; B.earned = 0; const i0 = sp.get('silver'); processDailyProduction(w); const noBank = sp.get('silver') - i0;
      B.open = true; B.reserve = 200; B.dep = {}; B.earned = 30; const t2 = T(), i1 = sp.get('silver'), r1 = B.reserve; const sp_c = sp.consume.bind(sp); let upk = 0; sp.consume = (r, n, ...x) => { const ok = sp_c(r, n, ...x); if (ok && r === 'silver') upk += n; return ok; };
      processDailyProduction(w); sp.consume = sp_c; w.buildings.getEffect = ge;
      out.bank = { noBankInterest: noBank <= 0, paid: Math.round((B.reserve - r1) * -1), earnedLeft: B.earned };
      // 5) 小孩的錢包從 0 開始;開局以後才出現的大人帶著積蓄(記進月報)
      const kid = all.find(a => (a.age ?? 30) < 16) || all[all.length - 1]; const kidWasAge = kid.age; kid.age = 6; delete w.wallet.bal[kid.agentId]; const kb = WALLET.get(w, kid);
      const newbie = adults[5]; delete w.wallet.bal[newbie.agentId]; M.pend = 0; const nb = WALLET.get(w, newbie); const immFlow = M.pend;
      // 6) 小孩的飯錢先由家人出
      const par = adults[6]; kid._parentNames = [par.name]; w.wallet.bal[par.agentId] = 100; w.wallet.bal[kid.agentId] = 20; const payer = MARKET.feed(w, kid, 3);
      out.kid = { start: kb, payer: payer === par, parPaid: Math.round((100 - WALLET.get(w, par)) * 10) / 10, kidKept: WALLET.get(w, kid), newbie: nb > 0, immFlow: Math.round(immFlow * 10) / 10 === Math.round(nb * 10) / 10 };
      kid.age = kidWasAge;
      // 7) 外地包商的工程款記進月報
      M.pend = 0; const paid = MARKET.procure(w, 100); out.works = { paid: Math.round(paid * 10) / 10, flow: Math.round(M.pend * 10) / 10 };
      // 8) 月報總帳:跑幾天,每天的流入流出＋其他 = 總數變化
      M.lastClose = null; MONEY.close(w); const allSum = () => Object.values(M.days).reduce((s, D) => s + Object.values(D).reduce((x, v) => x + v, 0), 0); const T0 = T(), S0 = allSum(), d0 = w._absDay(); let err = null; w.paused = false; try { for (let i = 0; i < 96 * 6; i++) w.tick(); } catch (e) { err = String(e); } w.paused = true; M.lastClose = null; MONEY.close(w); // 強制結帳(當天可能已經結過一次,之後的變化還沒入帳)
      const sum = allSum() - S0;
      const view = MONEY.view(w); out.ledger = { err, diff: Math.round((T() - T0 - sum) * 100) / 100, days: view.days, cats: view.ins.length + view.outs.length, net: view.net };
      // 9) 外地同名:出生地・本名;同一個出生地也撞名就重新取名;搬到沒人同名的鎮就用本名
      const base = all[1].name; const n1 = uniqueVillagerName(w, base, { birthplace: '河谷鎮', gender: 'female' }); w.agents.__tmp = { agentId: '__tmp', name: n1, isDead: false };
      const n2 = uniqueVillagerName(w, base, { birthplace: '河谷鎮', gender: 'female' }); delete w.agents.__tmp; const n3 = uniqueVillagerName(w, '某鎮・測試的名', {});
      out.names = { n1, prefixed: n1 === '河谷・' + base, en: I18N.localizeName(n1), fresh: n2 !== n1 && !n2.includes('・') && !n2.startsWith(base), strip: n3 === '測試的名', one: (n1.match(/・/g) || []).length === 1 };
      // 10) 存讀檔
      const data = w.serialize(); const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(data))); out.save = { money: !!w2.money?.days, prefix: !!w2.namePrefix?.[n1] };
      out.brief = MONEY.townBrief(w);
      app.state = w.getState(); return out;
    });
    ok(r.noMint.trader === 0 && r.noMint.mayor === 0, '商人、鎮長不再每天憑空產出銀幣', r.noMint);
    ok(r.exp.sold >= 1 && r.exp.sale > 0 && Math.abs(r.exp.gain - r.exp.sale) < 0.2 && Math.abs(r.exp.flow - r.exp.sale) < 0.01 && r.exp.tre > 0 && r.exp.trader === 0 && Math.abs(r.exp.boss - (r.exp.sale - r.exp.sale / 1.3) * 0.95) < 0.1 && r.exp.noneWhenNoSurplus === 0 && r.exp.pub.gain > 0 && Math.abs(r.exp.pub.tre - r.exp.pub.gain) < 0.01 && r.exp.pub.trader === 0, '商人把多的貨運去外地賣：外地付的錢＝本錢進公庫＋加價是商行營收（給老闆、扣營業稅；公營進公庫）；沒有多的貨就沒收入', r.exp);
    ok(r.surplus.got > 0 && r.surplus.got <= 21 && r.surplus.food > 0 && Math.abs(r.surplus.silver - r.surplus.got) < 0.01 && r.surplus.none === 0 && r.surplus.pol > 0 && r.surplus.pol <= 16.5, '加銀幣的效果改成把多餘的貨賣給外地；沒有多的貨就沒錢', r.surplus);
    ok(r.bank.noBankInterest && r.bank.paid > 0 && r.bank.earnedLeft < 30, '銀行利息由銀行賺到的利息支付；沒銀行就沒有', r.bank);
    ok(r.kid.start === 0 && r.kid.payer && r.kid.parPaid === 3 && r.kid.kidKept === 20 && r.kid.newbie && r.kid.immFlow, '小孩從 0 開始、飯錢由家人出；新搬來的大人帶著積蓄（記進月報）', r.kid);
    ok(r.works.flow < 0 && Math.abs(r.works.paid - r.works.flow - 100) < 0.2, '公共工程款付給外地包商的部分記進月報', r.works);
    ok(!r.ledger.err && Math.abs(r.ledger.diff) < 0.05 && r.ledger.days >= 2, '月報總帳對得上（流入＋流出＋其他＝全鎮的錢的變化）', r.ledger);
    ok(r.names.prefixed && /of /.test(r.names.en) && r.names.fresh && r.names.strip && r.names.one, '外地同名用「出生地・本名」，英文是「名字 of 城鎮」；前綴不會疊加', r.names);
    ok(r.save.money && r.save.prefix, '月報與名字前綴存讀檔', r.save);
    await page.evaluate(() => { const app = window.rimtownApp; if (window.innerWidth <= 768) app._openKairoTab('economy'); else { app.activeTab = 'economy'; app.renderSidebar(); } }); await page.waitForTimeout(500);
    const ui = await page.evaluate(() => { const s = document.querySelector('.money-section'); return s ? { rows: s.querySelectorAll('.mf-row').length, txt: s.textContent.slice(0, 160), cjk: (s.textContent.match(/[一-鿿]{2,}/g) || []), over: s.scrollWidth > s.clientWidth + 2 } : null; });
    ok(!!ui && ui.rows >= 2 && !ui.over, '小鎮概況有「錢從哪來、往哪去」卡', ui);
    if (lang === 'en') ok(ui && !ui.cjk.length, '英文沒有中文', ui?.cjk);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
