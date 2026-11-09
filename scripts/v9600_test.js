// v9.6.0 閉環健檢修正＋新聞整合
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(lang) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  if (lang === 'en') await page.evaluate(() => new Promise(r => I18N.ensureDict(r)));
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; const out = {}; const r0 = Math.random;
    for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); }
    const P = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
    const M = MARKET.S(w), sp = w.stockpile;
    // 1. 外銷貨款一半給做貨的產業(扣營業稅),一半進公庫;全鎮總數不變
    { const boss = P[0]; M.owners.mine = boss.agentId; const b0 = WALLET.get(w, boss), t0 = sp.get('silver'), T0 = MONEY.total(w);
      MONEY.payGoods(w, 'stone', 100, 'test'); out.pay = { boss: Math.round((WALLET.get(w, boss) - b0) * 100) / 100, town: Math.round((sp.get('silver') - t0) * 100) / 100, total: Math.round((MONEY.total(w) - T0) * 100) / 100 };
      delete M.owners.mine; const t1 = sp.get('silver'); MONEY.payGoods(w, 'stone', 40, 'test'); out.pubPay = Math.round((sp.get('silver') - t1) * 100) / 100; }
    // 2. 石材有多的也賣得出去(以前不在外銷清單、預算又被貴的貨吃光)
    { const tr = P.find(a => a.job?.key === 'trader') || P[1]; const oj = tr.job; tr.job = new Job('trader'); tr.currentLocation = 'town_square';
      sp.add('stone', 500, w.tickCount, 'test'); sp.add('tools', 300, w.tickCount, 'test'); sp.add('clothing', 300, w.tickCount, 'test');
      out.inList = MONEY.surplusList(w).some(g => g.r === 'stone'); const s0 = sp.get('stone'); MONEY.exportDaily(w); out.stoneSold = Math.round(s0 - sp.get('stone')); tr.job = oj; }
    // 3. 提案「把多出來的貨賣掉」:賣給商店的錢一半轉給產業老闆
    { const boss = P[2]; M.owners.farm = boss.agentId; sp.add('food', 300, w.tickCount, 'test'); const b0 = WALLET.get(w, boss), T0 = MONEY.total(w); const res = w.shop.sell('food', 100, w);
      out.shop = { ok: !!res?.success, boss: Math.round((WALLET.get(w, boss) - b0) * 100) / 100, price: SHOP_ITEMS.food.sellPrice }; delete M.owners.farm; }
    // 4. 公庫見底、最近發不出薪水:就算很多人窮,也是提加稅
    { const C = CIVIC.S(w); C.lastTax = -99; w.wallet.tax = 0.02; const have = sp.get('silver'); sp.consume('silver', Math.max(0, have - 10), w.tickCount, 'test'); w.wallet.shortDay = w._absDay();
      for (const a of P.slice(0, Math.ceil(P.length * 0.4))) { const b = WALLET.get(w, a); if (b > 1) WALLET.take(w, a, b - 1); }
      w.proposals.items = (w.proposals.items || []).filter(p => p.kind !== 'tax'); const p = CIVIC.taxProposal(w, C, w._absDay()); out.tax = p ? { dir: p.dir, nt: p.newTax } : null;
      sp.add('silver', have, w.tickCount, 'test'); }
    // 5. 工資壓在七成以下三週以上,心情不差也會罷工
    { const k = 'forge'; const boss = P[3]; M.owners[k] = boss.agentId; const ws = P.slice(4, 9); const keep = ws.map(a => a.job); ws.forEach(a => { a.job = new Job('blacksmith'); a.mood = 70; });
      M.pay[k] = 0.6; M.low = M.low || {}; M.low[k] = w._absDay() - 30; M.strike = {}; Math.random = () => 0; const st0 = M.strikes || 0;
      try { MARKET.unrest(w, Object.values(w.agents).filter(a => !a.isDead && !a.isPlayer), w._absDay()); } finally { Math.random = r0; }
      out.strike = (M.strikes || 0) - st0; M.low[k] = w._absDay(); M.strike = {}; Math.random = () => 0; const st1 = M.strikes || 0;
      try { MARKET.unrest(w, Object.values(w.agents).filter(a => !a.isDead && !a.isPlayer), w._absDay()); } finally { Math.random = r0; }
      out.strikeFresh = (M.strikes || 0) - st1; ws.forEach((a, i) => { a.job = keep[i]; }); delete M.owners[k]; M.pay[k] = 1; M.strike = {}; }
    // 6. 勸架:兩邊都要好的人出面,這次不吵、氣消一點
    { const [a, b, m] = [P[9], P[10], P[11]]; const ra = a.relationships.getOrCreate(b.agentId, b.name), rb = b.relationships.getOrCreate(a.agentId, a.name); ra.affinity = -40; rb.affinity = -40;
      m.relationships.getOrCreate(a.agentId, a.name).affinity = 50; m.relationships.getOrCreate(b.agentId, b.name).affinity = 50;
      for (const x of P) if (x !== a && x !== b && x !== m) { const q = x.relationships.relationships; if (q[a.agentId]) q[a.agentId].affinity = Math.min(q[a.agentId].affinity, 0); }
      w._feudCooldown = {}; const n0 = w.messageLog.length; Math.random = () => 0;
      try { w._processFeuds(); } finally { Math.random = r0; }
      const ls = w.messageLog.slice(n0).filter(x => x.p && ((x.p.a === a.name && x.p.b === b.name) || (x.p.a === b.name && x.p.b === a.name))).map(x => x.k || x.content); out.peace = { log: ls.some(x => /打圓場/.test(String(x))), row: ls.some(x => /大吵一架/.test(String(x))), aff: ra.affinity }; }
    // 7. 報紙:報社的報導、外地消息各自一版,不再塞進民生經濟
    { const R = PRESS.S(w); const pp = R.papers[0]; PRESS.story(w, pp, 'test', '鎮上新開了一家{x}。', { x: '茶館' });
      w.logMessageT('news', EPISODE.AWAY_K, { via: '信差', p: '鄰鎮', n: '那邊下大雨了' });
      const v = EPISODE.view(w, EPISODE.today(w)); const sec = (k) => v.sections.find(s => s.key === k);
      out.paper = { press: !!sec('press') && sec('press').items.some(x => /茶館|tea/i.test(x)), away: !!sec('away'), lifeHasPress: !!sec('life') && sec('life').items.some(x => /茶館|tea/i.test(x)), pressLabel: sec('press')?.label }; }
    // 8. 每週感情線:觀察者模式刊在報紙,不跳大視窗
    { const A = P[12], B = P[13]; const rA = A.relationships.getOrCreate(B.agentId, B.name), rB = B.relationships.getOrCreate(A.agentId, A.name); rA.status = 'dating'; rB.status = 'dating'; rA.affinity = 70; rB.affinity = 70;
      w._lastDigestCouples = []; w._pendingWeeklyDigest = null; const dg = w.generateWeeklyDigest(); const v = EPISODE.view(w, EPISODE.today(w));
      out.weekly = { made: !!dg, popup: !!w._pendingWeeklyDigest, inPaper: !!v.sections.find(s => s.key === 'weekly') }; }
    // 9. AI 記者的稿子併進同一期報紙(換日時寫前一天,所以報上日期是隔天)
    { const d = w._absDay() + 1; const si = Math.floor((d - 1) / 15) % 4, yr = Math.floor((d - 1) / 60) + 1, dd = ((d - 1) % 15) + 1;
      w.dailyNews.newspapers.push({ id: 999, day: dd, season: ['春季', '夏季', '秋季', '冬季'][si], year: yr, reporter: P[0].name, reporterJob: '記者', content: '【頭條】測試專欄內容', events: [], crossTown: [] });
      app.state = w.getState(); const box = document.createElement('div'); app._epSel = 'today'; app.renderRecords(box);
      out.ai = { col: box.querySelectorAll('.np-ai').length, body: /測試專欄內容/.test(box.textContent), sepFold: box.querySelectorAll('.rec-ai').length, label: box.querySelector('.np-ai summary')?.textContent || '' }; w.dailyNews.newspapers.pop(); }
    // 10. 首頁今日頭條「完整日報」帶到日報分頁
    { w.dailyNews.newspapers.push({ id: 998, day: 1, season: '春季', year: 1, reporter: 'x', content: 'x', events: [{ category: 'event', content: 'x', agents: [] }] }); app.state = w.getState(); const h = app._renderTownHeadlines(); out.more = (h.match(/data-action="goto-tab" data-val="(\w+)"/) || [])[1]; w.dailyNews.newspapers.pop(); }
    // 11. 長跑:錢守恆、沒有錯誤
    { const d0 = w._absDay(); let other = 0; for (let d = 0; d < 20; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
      const D = MONEY.S(w).days || {}; for (const k of Object.keys(D)) if (+k > d0 + 1) other += +(D[k].other || 0); out.other = Math.round(other * 100) / 100; }
    out.cjk = /[一-鿿]/.test(out.paper.pressLabel || '') ; out.aiLabel = out.ai.label;
    return out;
  });
  console.log(`\n[${lang}]`);
  if (lang === 'zh') {
    ok(r.pay.boss === 47.5 && r.pay.town === 52.5 && r.pay.total === 100, '外銷貨款：老闆拿一半扣營業稅，其餘進公庫，總數不變', r.pay);
    ok(r.pubPay === 40, '公營產業的貨款全進公庫', r.pubPay);
    ok(r.inList && r.stoneSold > 0, '石材多的也能外銷', { inList: r.inList, sold: r.stoneSold });
    ok(r.shop.ok && Math.abs(r.shop.boss - r.shop.price * 100 * 0.5 * 0.95) < 0.02, '賣給商店的貨款一半轉給產業老闆', r.shop);
    ok(r.tax && r.tax.dir === 'up', '公庫見底又發不出薪水：提加稅，不是減稅', r.tax);
    ok(r.strike === 1 && r.strikeFresh === 0, '工資壓低三週以上就罷工，剛砍薪不會馬上罷工', { a: r.strike, b: r.strikeFresh });
    ok(r.peace.log && !r.peace.row && r.peace.aff > -40, '兩邊都要好的人出面勸架，這次沒吵起來', r.peace);
    ok(r.paper.press && r.paper.away && !r.paper.lifeHasPress, '報社報導、外地消息各自一版，不再混進民生經濟', r.paper);
    ok(r.weekly.made && !r.weekly.popup && r.weekly.inPaper, '每週感情線刊在報紙上，不跳視窗', r.weekly);
    ok(r.ai.col === 1 && r.ai.body && r.ai.sepFold === 0, 'AI 記者的稿子併進當天報紙，沒有另外一疊', r.ai);
    ok(r.more === 'records', '首頁「完整日報」帶到日報分頁', r.more);
    ok(r.other === 0, '20 天沒有來路不明的錢', r.other);
  } else {
    ok(!r.cjk && /papers say/i.test(r.paper.pressLabel || ''), '英文版面名稱', r.paper.pressLabel);
    ok(/Reporter/i.test(r.aiLabel), '英文記者專欄', r.aiLabel);
    ok(r.paper.press && r.weekly.inPaper, '英文報紙各版正常', { p: r.paper, wk: r.weekly });
  }
  ok(errs.length === 0, '沒有錯誤', errs.slice(0, 3));
  await browser.close();
}
(async () => { await run('zh'); await run('en'); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
