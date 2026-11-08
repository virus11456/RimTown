// v7.2.1 提案材料:等材料時公庫自動採買(商人在→照商人開價、不在→外地訂貨貴六成 2～3 天到)、已批准提案保留材料(先批准的優先)、
// 失敗寫出缺什麼、買不到的材料不提案、學者先選了同一項研究算達成、提案卡顯示訂貨狀態(中英)
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
      const w = app.world; w.observerMode = true; const out = {}; const sp = w.stockpile; const P = w.proposals;
      const H = BUILDING_TEMPLATES.hospital.costs; const day = P._abs(w); let n = 900;
      const mk = (key, extra) => { const tm = BUILDING_TEMPLATES[key]; const p = { id: 'L' + (++n), n, kind: 'build', key: 'build:' + key, refKey: key, tk: '在鎮上蓋{name}', tp: { name: tm.name }, dk: '{desc}', dp: { desc: tm.description }, cost: { ...tm.costs }, status: 'approved', approvedDay: day, createdDay: day, votes: {}, why: {}, proposerId: Object.keys(w.agents).find(k => k !== 'player'), proposerName: 'x', ...extra }; P.items.push(p); return p; };
      const clearB = () => { w.buildings.projects = []; w.buildings.completed = (w.buildings.completed || []).filter(b => !['hospital', 'garden', 'granary'].includes(b.buildingKey)); };
      const setRes = (o) => { for (const [k, v] of Object.entries(o)) sp.resources[k] = v; };
      // 1) 商人在鎮上而且有賣:照商人開價買齊,當天就動工;銀幣付給商人(流出鎮外)
      clearB(); P.items = []; setRes({ wood: 10, brick: 12, cloth: 15, silver: 2000 });
      w.trade.merchant = { name: '測試商人', specialty: 'general', offers: [{ resource: 'wood', amount: 50, price: 2, isBuying: false }], daysRemaining: 3 };
      let p = mk('hospital'); const s0 = sp.get('silver'); P._execute(w, p, day);
      out.buy = { status: p.status, paid: s0 - sp.get('silver') - H.silver, left: w.trade.merchant.offers[0]?.amount, wood: sp.get('wood') };
      // 2) 沒有商人:向外地訂貨(貴六成、木材多訂一點),先付錢;到貨那天動工
      clearB(); P.items = []; setRes({ wood: 10, brick: 0, cloth: 15, silver: 2000 }); w.trade.merchant = null;
      p = mk('hospital'); const s1 = sp.get('silver'); P._execute(w, p, day);
      out.order = { status: p.status, order: p.order ? { ...p.order } : null, paid: s1 - sp.get('silver'), card: P.toItem(w, p).order };
      P._execute(w, p, day + 1); out.order.mid = p.status;
      P._execute(w, p, day + 3); out.order.after = p.status; out.order.result = p.result;
      // 3) 公庫的錢不夠買:不訂;等滿一週失敗,失敗原因寫出缺什麼
      clearB(); P.items = []; setRes({ wood: 0, brick: 0, cloth: 15, silver: 155 });
      p = mk('hospital'); for (let i = 0; i <= 8; i++) P._execute(w, p, day + i);
      out.poor = { status: p.status, order: !!p.order, result: P.toItem(w, p).result, spent: 155 - sp.get('silver') };
      // 4) 保留材料:已批准的提案在等,其他工程不能動它要的材料;提案作罷後就放開
      clearB(); P.items = []; setRes({ wood: 60, stone: 200, brick: 0, cloth: 15, silver: 160 });
      p = mk('hospital'); P._reserveAll(w); const gc = BUILDING_TEMPLATES.garden.costs;
      out.reserve = { reserved: { ...sp.reserved }, garden: sp.canAfford(gc), gardenCost: gc };
      p.status = 'failed'; P._reserveAll(w); out.reserve.after = sp.canAfford(gc);
      // 5) 先批准的優先:材料只夠一件時,先批准的先做
      clearB(); P.items = []; setRes({ wood: 45, brick: 12, cloth: 15, silver: 160 }); w.trade.merchant = null;
      const A = mk('hospital', { approvedDay: day - 2 }); const B = mk('granary', { approvedDay: day - 1 });
      out.prio = { bAff: P._affordable(w, B), aAff: P._affordable(w, A), short: P._shortfall(w, B) };
      // 6) 買不到的材料(沒有行情)不會被提
      out.obt = { brick: P._obtainable(w, { brick: 999 }), rp: P._obtainable(w, { research_points: 999 }), silver: P._obtainable(w, { silver: 99999 }) };
      // 7) 學者已經在研究同一項:提案算達成
      const R = w.research; const av = R.getAvailable?.()[0]; let rs = null;
      if (av) { R.startResearch(av.key); P.items = []; const q = { id: 'L999', n: 999, kind: 'research', refKey: av.key, tk: '研究「{name}」', tp: { name: av.name }, cost: {}, status: 'approved', approvedDay: day, votes: {}, why: {}, proposerId: A.proposerId, proposerName: 'x' }; P.items.push(q); P._execute(w, q, day); rs = { status: q.status, result: q.result }; }
      out.research = rs;
      // 8) 提案卡:已批准在等貨,寫出訂了什麼、幾天到
      clearB(); P.items = []; setRes({ wood: 10, brick: 0, cloth: 15, silver: 2000 }); w.trade.merchant = null;
      p = mk('hospital'); P._execute(w, p, day); app.state = w.getState ? w.getState() : app.state;
      return out;
    });
    ok(r.buy.status === 'done' && r.buy.paid === 60 && r.buy.left === 20, '商人在而且有賣：照商人開價買齊缺的木材，當天動工（付給商人）', r.buy);
    ok(r.order.status === 'approved' && r.order.order && r.order.order.items.wood >= 38 && r.order.order.items.brick === 12 && r.order.paid === r.order.order.paid && r.order.paid > 0 && r.order.order.day - 0 > 0, '沒有商人：向外地訂貨（木材多訂一點）、先付錢', r.order);
    ok(r.order.mid === 'approved' && r.order.after === 'done', '訂的貨到了那天動工', r.order);
    ok(!!r.order.card && r.order.card.days >= 2, '提案資料有訂貨內容與到貨天數', r.order.card);
    ok(r.poor.status === 'failed' && !r.poor.order && r.poor.spent === 0 && /木材|wood/i.test(r.poor.result) && /磚|brick/i.test(r.poor.result), '公庫的錢不夠買：不訂貨，等滿一週失敗並寫出缺木材、磚塊', r.poor);
    ok(r.reserve.reserved.wood === 40 && r.reserve.garden === false && r.reserve.after === true, '已批准的提案保留材料，別的工程不能動；作罷後放開', r.reserve);
    ok(r.prio.aAff === true && r.prio.bAff === false && r.prio.short.wood > 0, '材料只夠一件：先批准的先做', r.prio);
    ok(r.obt.brick && !r.obt.rp && r.obt.silver, '買不到的材料（研究點）不會被提；磚塊外地買得到', r.obt);
    ok(!r.research || r.research.status === 'done', '學者已經在研究同一項：研究提案算達成', r.research);
    await page.evaluate(() => { const app = window.rimtownApp; app._ppTab = 'props'; if (window.innerWidth <= 768) app._openKairoTab('proposals'); else { app.activeTab = 'proposals'; app.renderSidebar(); } }); await page.waitForTimeout(600);
    const ui = await page.evaluate(() => { const c = [...document.querySelectorAll('.pp-card.pp-approved')].find(x => x.textContent.includes('L')); if (!c) return null; const tx = c.textContent; return { order: /外地訂購|Ordered/.test(tx), tx: tx.slice(0, 300), cjk: (tx.match(/[一-鿿]{2,}/g) || []) }; });
    ok(!!ui && ui.order, '提案卡寫出已向外地訂購什麼、幾天到', ui);
    if (lang === 'en' && ui) ok(!ui.cjk.filter(x => !/醫院|測試/.test(x)).length, '英文沒有中文', ui.cjk.slice(0, 5));
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
