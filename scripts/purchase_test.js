// 選跑:node scripts/purchase_test.js   v6.16.0 向鄰鎮採買回歸(有斷言,失敗 exit 1;需本機 8126 服務 wordpress/ 與 NODE_PATH 指到有 playwright 的 node_modules)
// 報價(盛產 vs 非盛產)、出發扣銀幣、對方不賣/銀幣不足/至少 10 份、到期運回(無劫/遇劫)、存讀檔中途、戰績、彈窗採買模式與點擊、經濟分頁顯示
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch((() => { const e = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined); return e ? { executablePath: e } : {}; })()); const errs = [];
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errs.push(lang + ':' + e.message));
    await page.route('**/api/**', (route) => { const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404); if (u.includes('/api/settings')) return json({ settings: {} }); return json({}); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
    const out = await page.evaluate(async () => {
      const app = window.rimtownApp; const w = app.world; app._visitorMailboxTick(); w.paused = true; const o = {}; const fails = []; const ck = (c, m) => { if (!c) fails.push(m); };
      w.otherTowns = [{ id: 'o1', name: '礦山鎮' }, { id: 'o2', name: '市集城' }]; w.playerCaravan = { active: null, history: [], pendingInjury: null };
      w.stockpile.add('silver', 2000);
      // 報價
      o.goods = w.purchaseGoods('mountain'); ck(JSON.stringify(o.goods) === '["stone","metal"]', 'mountain goods ' + JSON.stringify(o.goods));
      ck(!w.purchaseGoods('market').includes('silver'), 'market goods exclude silver');
      const q1 = w.playerPurchaseQuote('mountain', 'stone', 50, false, 'road'); const q2 = w.playerPurchaseQuote('mountain', 'food', 50, false, 'road'); const q3 = w.playerPurchaseQuote('mountain', 'stone', 50, true, 'mountain');
      const q4 = w.playerPurchaseQuote('harbor', 'food', 50, false, 'road'); // 海風鎮盛產食物:同一種貨,盛產的便宜
      o.quote = { q1, q2, q3, q4 }; ck(q1.offered && !q2.offered && q4.offered && q4.unit < q2.unit && q2.unit === 2 && q4.unit === 1.4 && q1.unit === 2.8 && q1.cost === 140 && q1.days === 2 && q1.fee === 0, 'quote offered vs not ' + JSON.stringify({ q1, q2, q4 }));
      ck(q3.days === 1 && q3.fee === 20 && q3.risk < 0.25 && q1.shopUnit === 5, 'quote guard/mountain ' + JSON.stringify(q3));
      // 驗證
      const base = { toTownId: 'o1', toTownName: '礦山鎮', toTheme: 'mountain', route: 'road', guardId: null };
      o.rej = { few: w.launchPlayerPurchase({ ...base, res: 'stone', amount: 5 }).ok, notSold: w.launchPlayerPurchase({ ...base, res: 'food', amount: 20 }).ok };
      const s0 = w.stockpile.get('silver'); w.stockpile.consume('silver', s0 - 100, 0, 'test'); o.rej.poor = w.launchPlayerPurchase({ ...base, res: 'stone', amount: 100 }); w.stockpile.add('silver', s0 - 100);
      ck(!o.rej.few && !o.rej.notSold && !o.rej.poor.ok, 'rejections ' + JSON.stringify(o.rej));
      // 出發
      const silver0 = w.stockpile.get('silver'); const stone0 = w.stockpile.get('stone') || 0;
      const r = w.launchPlayerPurchase({ ...base, res: 'stone', amount: 50 }); o.launch = { ok: r.ok, msg: r.msg, cost: r.cost, spent: silver0 - w.stockpile.get('silver'), active: w.playerCaravan.active?.mode, again: w.launchPlayerPurchase({ ...base, res: 'stone', amount: 50 }).ok };
      ck(o.launch.ok && o.launch.spent === 140 && o.launch.active === 'buy' && !o.launch.again, 'launch ' + JSON.stringify(o.launch));
      // 中途存讀檔
      const save = JSON.parse(JSON.stringify(w.serialize())); const W = new World(); W.loadSave(save); o.reload = W.playerCaravan.active; ck(o.reload && o.reload.mode === 'buy' && o.reload.cost === 140 && o.reload.res === 'stone', 'reload mid-trip');
      // 到期:無劫
      const rnd = Math.random; Math.random = () => 0.99; w.clock.day += 2; let notice = null; w.onPlayerCaravanReturn = (res, line) => { notice = { res, line }; };
      w._playerCaravanDaily(); Math.random = rnd;
      o.ret = { stone: (w.stockpile.get('stone') || 0) - stone0, active: w.playerCaravan.active, hist: w.playerCaravan.history.slice(-1)[0], notice, totals: w.playerCaravan.totals };
      ck(o.ret.stone === 50 && !o.ret.active && o.ret.hist?.mode === 'buy' && o.ret.hist.got === 50 && !o.ret.hist.raided && o.ret.notice && /140/.test(o.ret.notice.line) && o.ret.totals.buys === 1 && o.ret.totals.silver === 0, 'return ok ' + JSON.stringify(o.ret));
      // 到期:遇劫
      const r2 = w.launchPlayerPurchase({ ...base, res: 'metal', amount: 20 }); const metal0 = w.stockpile.get('metal') || 0; Math.random = () => 0.0; w.clock.day += 2; w._playerCaravanDaily(); Math.random = rnd;
      const h2 = w.playerCaravan.history.slice(-1)[0]; o.raid = { ok: r2.ok, raided: h2?.raided, lost: h2?.lost, got: h2?.got, metal: (w.stockpile.get('metal') || 0) - metal0, raids: w.playerCaravan.totals.raids };
      ck(o.raid.ok && o.raid.raided && o.raid.lost + o.raid.got === 20 && o.raid.metal === o.raid.got && o.raid.raids === 1, 'raid ' + JSON.stringify(o.raid));
      // 經濟分頁戰績
      app.state = w.getState(); app.activeTab = 'economy'; app._economySubTab = 'resources'; app.renderSidebar(); await new Promise(r => setTimeout(r, 100));
      const sc = document.getElementById('sidebar-content'); o.econ = sc.querySelector('.econ-section')?.textContent?.replace(/\s+/g, ' ') || ''; ck(/🧺/.test(o.econ) && /🏴/.test(o.econ) && sc.querySelector('[data-action="open-caravan"]'), 'economy history ' + o.econ);
      // 彈窗:採買模式
      app._showCaravanDialog(); await new Promise(r => setTimeout(r, 100)); const dlg = document.getElementById('caravan-dialog');
      o.dlg = { modeBtns: dlg.querySelectorAll('.pc-mode').length }; dlg.querySelector('.pc-mode[data-mode="buy"]').click(); await new Promise(r => setTimeout(r, 50));
      o.dlg.resOpts = [...dlg.querySelectorAll('#pc-res option')].map(x => x.value); o.dlg.quote = dlg.querySelector('#pc-quote').textContent; o.dlg.go = dlg.querySelector('.pc-go').textContent;
      dlg.querySelector('#pc-town').value = '1'; dlg.querySelector('#pc-town').dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 50)); o.dlg.resOpts2 = [...dlg.querySelectorAll('#pc-res option')].map(x => x.value);
      dlg.querySelector('#pc-town').value = '0'; dlg.querySelector('#pc-town').dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 50));
      const sBefore = w.stockpile.get('silver'); dlg.querySelector('.pc-go').click(); await new Promise(r => setTimeout(r, 150));
      o.dlg.launched = w.playerCaravan.active?.mode; o.dlg.spent = sBefore - w.stockpile.get('silver'); o.dlg.closed = !document.getElementById('caravan-dialog'); o.dlg.toast = !!document.querySelector('#achv-toast-host .rt-toast');
      ck(o.dlg.modeBtns === 2 && JSON.stringify(o.dlg.resOpts) === '["stone","metal"]' && JSON.stringify(o.dlg.resOpts2) === '["cloth"]' && /140|56/.test(o.dlg.quote) && o.dlg.launched === 'buy' && o.dlg.spent > 0 && o.dlg.closed && o.dlg.toast, 'dialog ' + JSON.stringify(o.dlg));
      // 活動中:經濟分頁與彈窗都顯示採買
      app.state = w.getState(); app.renderSidebar(); await new Promise(r => setTimeout(r, 100)); o.activeEcon = sc.querySelector('.econ-section')?.textContent?.replace(/\s+/g, ' ') || '';
      app._showCaravanDialog(); await new Promise(r => setTimeout(r, 50)); o.activeDlg = document.getElementById('caravan-dialog')?.textContent?.replace(/\s+/g, ' ') || ''; document.getElementById('caravan-dialog')?.remove();
      ck(/🧺/.test(o.activeEcon) && /礦山鎮|Mine Ridge/.test(o.activeDlg) && !/undefined|NaN/.test(o.activeEcon + o.activeDlg + o.econ), 'active display ' + o.activeEcon + ' | ' + o.activeDlg);
      ck(!/  /.test(o.ret.notice?.line || '') && !/  /.test(o.launch.msg || ''), 'no double spaces');
      o.fails = fails; return o;
    });
    console.log(lang, JSON.stringify(out).slice(0, 1800)); if (out.fails.length) { console.log('FAIL', lang, out.fails); process.exitCode = 1; }
    await page.close();
  }
  console.log('errors', errs); if (errs.length) process.exitCode = 1; await browser.close();
})();
