// v6.65.0 探索四級城鎮＋分級商品:種子城鎮等級(越高越稀有)、標籤顯示等級、遠方城鎮升級、城市／王都商人帶珍品、有錢人收藏(地位)、公庫買地標、聖物獻給宗教、畫面、存讀檔
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); WALLET.S(w); CLASS.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-30).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const out = {};
      const cnt = [0, 0, 0, 0]; for (let s = 1; s <= 3000; s++) cnt[GOODS.tierOf(s * 7919)]++; out.cnt = cnt;
      const c = TownGen.card(12345); out.cardTier = typeof c.tier === 'number'; out.tag = TownGen.tags(c)[0];
      c.state = { pop: 30, prosperity: 90, era: 1, news: [], day: 0, tier: 1 }; c.wealth = 'rich'; fix(0.01, () => TownGen.drift(c, 5)); out.grew = c.state.tier === 2 && c.tier === 2;
      // 城市／王都商人
      TIDINGS.S(w); const rp = GOODS.richPlaces(w); out.rich = rp.length;
      fix(0.01, () => w.trade._spawnMerchant(w)); const G = GOODS.S(w); out.offers = G.offers.length; out.log = logHas(/珍品|rare goods/);
      // 有錢人收藏
      const rich = npcs()[0]; w.wallet.bal[rich.agentId] = 5000; const lv0 = CLASS.compute(w, rich);
      G.offers = [{ key: 'painting', from: '市集城', lv: 2, price: 100, day: w._absDay() }]; fix(0.01, () => { G.lastDay = null; GOODS.daily(w); });
      out.owned = (G.owned[rich.agentId] || []).length === 1; out.chip = GOODS.chip(w, rich); w.wallet.bal[rich.agentId] = 0; out.prestige = CLASS.compute(w, rich) >= 3;
      // 公庫買地標
      for (const a of npcs()) w.wallet.bal[a.agentId] = 0; w.stockpile.add('silver', 2000, w.tickCount, 'test');
      const lm0 = (w.proposals.landmarks || []).length; const m0 = npcs()[1].moodModifier || 0;
      G.offers = [{ key: 'statue', from: '市集城', lv: 2, price: 140, day: w._absDay() }]; fix(0.01, () => { G.lastDay = null; GOODS.daily(w); });
      out.landmark = (w.proposals.landmarks || []).length === lm0 + 1 && (npcs()[1].moodModifier || 0) > m0 && G.town.length >= 1;
      // 聖物
      const F = FAITH.S(w); const R = F.rels[0]; const b = FAITH.believers(w, R)[0]; const p0 = b ? FAITH.pietyOf(w, b) : 0; if (b) F.of[b.agentId].piety = Math.min(p0, 50);
      const p1 = b ? FAITH.pietyOf(w, b) : 0; const big = F.rels.slice().sort((x, y) => FAITH.believers(w, y).length - FAITH.believers(w, x).length)[0];
      G.offers = [{ key: 'relic', from: '王都', lv: 3, price: 320, day: w._absDay() }]; fix(0.01, () => { G.lastDay = null; GOODS.daily(w); });
      out.relic = big.relic === 'relic' && logHas(/聖物|relic/);
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-goods')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.goods?.town?.length === G.town.length; w2.reset(); out.reset = !w2.goods;
      return out;
    });
    ok(r.cnt[0] > r.cnt[1] && r.cnt[1] > r.cnt[2] && r.cnt[2] > r.cnt[3] && r.cnt[3] > 0 && r.cnt[3] < 200, '探索到的城鎮：村莊最常見、王都極稀有', r.cnt);
    ok(r.cardTier && /🏡|🏘️|🏙️|🏰/.test(r.tag), '城鎮卡有等級標籤', r.tag);
    ok(r.grew, '遠方城鎮繁榮又人多時會升級', r);
    ok(r.rich >= 1 && r.offers >= 1 && r.log, '城市與王都來的商人帶珍品', r);
    ok(r.owned && /收藏|Collects/.test(r.chip) && r.prestige, '有錢人買藝術品撐場面，算士紳', r);
    ok(r.landmark, '公庫買下的珍品擺在廣場當地標，全鎮心情變好', r);
    ok(r.relic, '聖物獻給信徒最多的宗教', r);
    ok(/🏺/.test(r.ui), '鎮況頁有珍品', r.ui);
    ok(r.rt && r.reset, '珍品存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
