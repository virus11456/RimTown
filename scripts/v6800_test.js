// v6.80.0 精製品與吃得好:工坊做的工具／衣服／家具是精製品、耗損減半、其他用途先用普通的;倉庫顯示精製數量與實際耗損;
// 吃得好(飲食多樣／麵包糕點果醬／好酒好茶甜點湊齊兩樣)隔天少吃一成正餐、連續三天心情加;存讀檔;全工坊 40 天不出錯、成品不暴增;中英面板
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
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
    const r = await page.evaluate(async (full) => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const fresh = () => { w.townTheme = 'frontier'; w.townName = 'frontier'; w.rosterMode = 'scripted'; w.reset(); w.fullAgentMode = false; w.observerMode = true; };
      const sp = () => w.stockpile; const set = (k, n) => { sp().resources[k] = n; }; const get = (k) => sp().get(k);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const out = {};
      fresh();
      // 1) 只有對應的工坊做的才是精製品
      set('tools', 0); w.flow = null;
      out.add = [FLOW.addFine(w, 'sawmill', 'tools', 3), FLOW.addFine(w, 'steelworks', 'tools', 3)];
      set('tools', 3); out.fine1 = FLOW.fine(w, 'tools');
      // 工坊出貨走 collectProduct 也會記上
      w.processing.builtFactories.textile_mill = { key: 'textile_mill', status: 'active', workers: [], warehouse: { clothing: 4 }, recipe: null, productionProgress: 0 };
      set('clothing', 10); w.processing.collectProduct('textile_mill', 'clothing', 4, w); out.cloth = { total: get('clothing'), fine: FLOW.fine(w, 'clothing') };
      // 2) 耗損:全普通 10、全精製 5、一半一半 7.5
      const wearOf = (total, fineN) => { set('tools', total); w.flow.fine.tools = fineN; const n = FLOW.wear(w, 'tools', 10, 'test'); return { n, left: get('tools'), fine: Math.round(FLOW.fine(w, 'tools') * 100) / 100 }; };
      out.wear = [wearOf(100, 0), wearOf(100, 100), wearOf(100, 50)];
      // 3) 其他用途先用普通的
      set('tools', 20); w.flow.fine.tools = 5; sp().consume('tools', 10, 0, 'sell'); out.keep = FLOW.fine(w, 'tools');
      set('tools', 20); w.flow.fine.tools = 20; sp().consume('tools', 15, 0, 'sell'); out.clamp = FLOW.fine(w, 'tools');
      // 4) 每日生產裡的工具耗損真的走精製規則(全部精製 → 只壞一半)
      const wearDay = (allFine) => { set('tools', 200); w.flow.fine.tools = allFine ? 200 : 0; const h0 = sp().history.length; processDailyProduction(w); return Math.round(sp().history.slice(h0).filter(h => h.resource === 'tools' && h.reason === 'tool wear').reduce((a, h) => a - h.amount, 0) * 100) / 100; };
      out.dayWear = { normal: wearDay(false), fine: wearDay(true), pop: npcs().length };
      // 5) 吃得好:飲食多樣 + 麵包糕點果醬 → 算吃得好,隔天少吃一成正餐
      fresh(); w.flow = null; const pop = npcs().length;
      out.factor0 = FLOW.mealFactor(w);
      const econ = () => { if (!w.econ) { try { ECON.daily(w); } catch (e) {} } if (!w.econ) w.econ = {}; return w.econ; };
      const goodDay = () => { econ().variety = 3; set('pastry', pop); FLOW.eatSnacks(w, pop); w.flow.lastDay = -1; FLOW.daily(w); econ().variety = 3; };
      goodDay(); out.day1 = { good: FLOW.diet(w).good, streak: FLOW.diet(w).streak, factor: FLOW.mealFactor(w), score: FLOW.diet(w).score };
      const meals = (good) => { w.flow.diet.good = good; set('meals', 1000); set('pastry', 0); set('bread', 0); set('jam', 0); const h0 = sp().history.length; processDailyProduction(w); return Math.round(sp().history.slice(h0).filter(h => h.resource === 'meals' && h.reason === 'daily consumption').reduce((a, h) => a - h.amount, 0) * 10) / 10; };
      out.meals = { good: meals(true), plain: meals(false) };
      // 連續三天心情加、有公告
      fresh(); w.flow = null; const m0 = npcs().map(a => a.moodModifier || 0).reduce((a, b) => a + b, 0);
      const logN0 = (w.messageLog || []).length;
      for (let i = 0; i < 3; i++) goodDay();
      const m1 = npcs().map(a => a.moodModifier || 0).reduce((a, b) => a + b, 0);
      out.streak = { streak: FLOW.diet(w).streak, mood: Math.round(m1 - m0), log: (w.messageLog || []).slice(logN0).some(m => /🍰/.test(w.logText ? w.logText(m) : (m.content || m.text || ''))) };
      // 普通的一天中斷連續
      econ().variety = 1; w.flow.lastDay = -1; FLOW.daily(w); out.broken = { streak: FLOW.diet(w).streak, factor: FLOW.mealFactor(w) };
      app.state = w.getState(); app.activeTab = 'economy'; app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
      { const tx = document.querySelector('.ec-local')?.innerText || ''; out.plain = /(吃得普通|Eating plainly).*✗/.test(tx.replace(/\s+/g, ' ')); out.plainTx = (tx.match(/🍽️.*/) || [''])[0].slice(0, 90); }
      // 6) 面板:精製數量與吃得好
      goodDay(); set('tools', 30); w.flow.fine.tools = 12;
      app.state = w.getState(); app.activeTab = 'economy'; app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
      const panel = document.querySelector('#rimtown-app')?.innerText || document.body.innerText;
      out.panel = { fine: /✨\s*(精製|fine)\s*12/.test(panel), eat: /今天少吃一成正餐|10% fewer meals/.test(panel), wear: /(每日耗損|daily wear)\s*[\d.]+/.test(panel) };
      out.panelSnippet = (panel.match(/.{0,30}✨.{0,20}/) || [''])[0];
      // 7) 存讀檔
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data);
      out.saved = { fine: w2.flow?.fine?.tools, streak: w2.flow?.diet?.streak, good: w2.flow?.diet?.good };
      // 舊存檔沒有 fine/diet 也讀得開
      const old = JSON.parse(JSON.stringify(data)); if (old.flow) { delete old.flow.fine; delete old.flow.diet; } const w3 = new World(); let oldErr = null; try { w3.loadSave(old); FLOW.fine(w3, 'tools'); FLOW.mealFactor(w3); } catch (e) { oldErr = e.message; } out.oldOk = !oldErr;
      // 8) 全工坊開著跑 40 天:不出錯,精製品真的做得出來,工具衣服家具不暴增
      if (full) {
        fresh(); const I = w.industry; I.maxIndustries = 4; for (const k of Object.keys(INDUSTRIES)) { if (!I.industries[k]) I.chooseIndustry(k, w); I.industries[k].level = 4; }
        for (const pr of Object.values(w.research?.projects || {})) pr.status = 'complete'; w.buildings?.recomputeEffects?.(w);
        for (const k of Object.keys(FACTORIES)) w.processing.builtFactories[k] = { key: k, status: 'active', workers: [], warehouse: {}, recipe: null, productionProgress: 0, buildProgress: 100 };
        w.processing._autoStaff?.(w);
        let err = null; const d0 = w._absDay(); const peak = {}; let maxFine = {}; let goodDays = 0, lastD = d0;
        for (let i = 0; i < 42 * 96 && w._absDay() - d0 < 40; i++) { w.paused = false; try { w.tick(); } catch (e) { err = e.message; break; }
          if (w._absDay() !== lastD) { lastD = w._absDay(); if (FLOW.diet(w).good) goodDays++; for (const k of ['tools', 'clothing', 'furniture']) { peak[k] = Math.max(peak[k] || 0, get(k)); maxFine[k] = Math.max(maxFine[k] || 0, FLOW.fine(w, k)); } }
          if (i % 3000 === 0) await new Promise(r => setTimeout(r, 0)); }
        out.run = { err, peak, maxFine, goodDays, want: Object.fromEntries(['tools', 'clothing', 'furniture'].map(k => [k, Math.round(FLOW.want(w, k))])), fineLeq: ['tools', 'clothing', 'furniture'].every(k => FLOW.fine(w, k) <= get(k) + 1e-9) };
      }
      return out;
    }, lang === 'zh');
    if (lang === 'zh') {
      ok(r.add[0] === 0 && r.add[1] === 3 && r.fine1 === 3, '只有煉鋼坊做的工具算精製品', { add: r.add, fine: r.fine1 });
      ok(r.cloth.total === 14 && r.cloth.fine === 4, '紡織廠出貨的衣服記成精製品', r.cloth);
      ok(r.wear[0].n === 10 && r.wear[1].n === 5 && r.wear[2].n === 7.5 && r.wear[2].fine === 47.5, '耗損：全普通 10、全精製 5、一半一半 7.5(精製的只少 2.5)', r.wear);
      ok(r.keep === 5 && r.clamp === 5, '賣掉、蓋房子先用普通的；精製數量不會超過總數', { keep: r.keep, clamp: r.clamp });
      ok(r.dayWear.normal > 0 && Math.abs(r.dayWear.fine - r.dayWear.normal / 2) < 0.06, '每天的工具耗損：全部精製時只有一半', r.dayWear);
      ok(r.factor0 === 1 && r.day1.good && r.day1.streak === 1 && r.day1.factor === 0.9, '飲食多樣＋糕點 → 吃得好，隔天正餐少一成', { f0: r.factor0, d1: r.day1 });
      ok(r.meals.good > 0 && Math.abs(r.meals.good - r.meals.plain * 0.9) < 0.6, '實際每日正餐消耗少一成', r.meals);
      ok(r.streak.streak === 3 && r.streak.mood >= 20 && r.streak.log, '連續三天吃得好：全鎮心情加、有公告', r.streak);
      ok(r.broken.streak === 0 && r.broken.factor === 1, '吃得普通的一天中斷連續、隔天照常吃', r.broken);
      ok(r.saved.fine === 12 && r.saved.streak >= 1 && r.saved.good === true && r.oldOk, '存讀檔保留精製數量與連續天數；舊存檔照常讀', { saved: r.saved, old: r.oldOk });
      const capOk = r.run && !r.run.err && Object.entries(r.run.peak).every(([k, v]) => v <= r.run.want[k] * 3 + 30);
      ok(capOk && r.run.fineLeq && ['tools', 'clothing', 'furniture'].every(k => r.run.maxFine[k] > 0), '全工坊 40 天：精製工具、衣服、家具都做得出來，總數不暴增', r.run);
    }
    ok(r.plain, '吃得普通時面板逐項標出差哪幾樣(✓／✗)', r.plainTx);
    ok(r.panel.fine && r.panel.eat && r.panel.wear, '經濟面板顯示精製數量、每日耗損與吃得好', { panel: r.panel, s: r.panelSnippet });
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
