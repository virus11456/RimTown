// v9.17.0 小鎮概況改成資訊卡:今天要注意、每張卡（標題＋狀態標籤、大數字、警示列、展開詳細、ⓘ說明）、收合／展開記得住、
// 舊的資料一項不少（就業、景氣、貿易、物價工資、花錢去處、賭場、工程、健康、神話基因、錢流、天氣）、英文沒有中文、手機不會橫向捲動
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(async (lang) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._showSeasonRecap = () => {};
    const w = app.world; w.observerMode = true; const out = {};
    const cjk = (s) => (String(s || '').match(/[一-鿿]{2,}/g) || []);
    try {
      for (let i = 0; i < 96 * 30; i++) { w.paused = false; w.tick(); }
      // 讓幾張卡一定有事:有人挨餓、柴很貴、有人生病
      const P = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      for (const a of P.slice(0, 6)) { const n = WALLET.get(w, a); if (n > 0) WALLET.take?.(w, a, n); }
      w.prices.idx.fuel = 2.2; HEALTH.S(w).a[P[7].agentId] = [{ p: 'l', k: 'fever', s: 2, d: 0 }];
      try { localStorage.removeItem('rimtown_ic'); } catch (e) {} app._icS = null;
      app.state = w.getState(); document.querySelectorAll('[data-kairo-tab="economy"]').forEach(e => { if (e.offsetParent) e.click(); }); await new Promise(r => setTimeout(r, 300));
      const box = document; const render = () => { app.state = w.getState(); app.renderSidebar(); return box; };
      render(); if (!box.querySelector('.ic-wrap')) { app.activeTab = 'economy'; render(); }
      const cards = [...box.querySelectorAll('.ic-card')].map(c => c.dataset.ic);
      out.cards = cards;
      const brief = [...box.querySelectorAll('.ic-brief-row')].map(b => ({ id: b.dataset.val, t: b.querySelector('.ic-brief-t').textContent }));
      out.brief = brief;
      const W = box.querySelector('#ic-wallet'), PR = box.querySelector('#ic-prices'), H = box.querySelector('#ic-health');
      out.wallet = { open: W?.classList.contains('open'), chip: W?.querySelector('.ic-chip')?.textContent, kpis: W?.querySelectorAll('.ic-kpi').length, alert: !!W?.querySelector('.ic-alert'), info: !!W?.querySelector('.ic-info') };
      out.prices = { tiles: PR?.querySelectorAll('.ic-pr').length, hi: !!PR?.querySelector('.ic-pr-hi'), chip: PR?.querySelector('.ic-chip')?.textContent, subs: [...(PR?.querySelectorAll('.ic-sub') || [])].map(s => s.className.replace('ic-sub', '').trim()), jobs: PR?.querySelectorAll('.labor-job').length, detailHidden: getComputedStyle(PR.querySelector('.ic-detail')).display === 'none' };
      out.health = { open: H?.classList.contains('open'), tags: H?.querySelectorAll('.hb-tag').length, chip: H?.querySelector('.ic-chip')?.textContent };
      out.legacy = ['.price-section', '.health-section', '.money-section', '.price-section .infl-meta'].map(s => !!box.querySelector(s));
      out.noDots = !/ · .* · .* · /.test(PR?.querySelector('.ic-main > .ic-body')?.textContent || ''); // 主要區塊不再是一長串「·」
      // 點擊:展開詳細、收合、ⓘ;重畫後記得
      const click = (sel) => { const el = box.querySelector(sel); el.click(); };
      click('#ic-prices [data-action="ic-more"]'); out.more = PR.classList.contains('more') && getComputedStyle(PR.querySelector('.ic-detail')).display !== 'none';
      click('#ic-wallet [data-action="ic-toggle"]'); out.closed = !box.querySelector('#ic-wallet').classList.contains('open') && getComputedStyle(box.querySelector('#ic-wallet .ic-main')).display === 'none' && getComputedStyle(box.querySelector('#ic-wallet .ic-sum')).display !== 'none';
      click('#ic-prices [data-action="ic-info"]'); out.info = getComputedStyle(box.querySelector('#ic-prices .ic-info')).display !== 'none';
      render(); out.remember = { prMore: box.querySelector('#ic-prices').classList.contains('more'), wClosed: !box.querySelector('#ic-wallet').classList.contains('open') };
      click('#ic-wallet [data-action="ic-toggle"]');
      // 今天要注意 → 跳到那張卡並展開
      box.querySelector('#ic-money')?.classList.remove('open'); const go = box.querySelector('.ic-brief-row'); const gid = go?.dataset.val; go?.click(); out.go = gid ? box.querySelector('#ic-' + gid).classList.contains('open') : null;
      // 手機寬度不會橫向捲動
      out.overflow = [...box.querySelectorAll('.ic-card')].filter(c => c.scrollWidth > c.clientWidth + 2).map(c => c.dataset.ic);
      if (lang === 'en') out.leak = [...box.querySelectorAll('.ic-hd, .ic-kpi span, .ic-brief-row, .ic-more, .ic-ibtn, .ic-sub-h, .ic-alert')].map(e => e.textContent).flatMap(cjk).filter(x => !/[邊境鎮]/.test(x)).slice(0, 8);
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  }, lang);
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.cards && ['pros', 'keyres', 'wallet', 'prices', 'health', 'money', 'env', 'auto'].every(k => r.cards.includes(k)), `${tag} 概況每一區都是資訊卡`, r.cards);
  ok(r.brief && r.brief.some(b => b.id === 'wallet') && r.brief.some(b => b.id === 'prices') && r.brief.some(b => b.id === 'health'), `${tag} 今天要注意抓到：有人挨餓、柴很貴、有人生病`, r.brief);
  ok(r.wallet && r.wallet.open && r.wallet.kpis === 3 && r.wallet.alert && r.wallet.info, `${tag} 荷包卡：三個大數字、挨餓警示、規則收進 ⓘ`, r.wallet);
  ok(r.prices && r.prices.tiles === 3 && r.prices.hi && r.prices.detailHidden && r.prices.jobs > 0, `${tag} 物價卡：三格紅綠燈（柴是紅的），詳細預設收起`, r.prices);
  ok(r.prices && ['labor-meta', 'cycle-meta', 'trade-meta', 'infl-meta'].every(c => r.prices.subs.includes(c)), `${tag} 物價卡詳細分成小節：就業、景氣、貿易、物價與工資（資料一項不少）`, r.prices?.subs);
  ok(r.health && r.health.open && r.health.tags >= 1, `${tag} 健康卡：有人生病時自動展開、看得到是誰`, r.health);
  ok(r.legacy && r.legacy.every(Boolean) && r.noDots, `${tag} 舊的區塊名稱都還在、主要區塊不再一長串「·」`, { legacy: r.legacy, noDots: r.noDots });
  ok(r.more && r.closed && r.info, `${tag} 展開詳細、收合卡片（收合後標題列顯示摘要）、ⓘ 說明都能點`, { more: r.more, closed: r.closed, info: r.info });
  ok(r.remember && r.remember.prMore && r.remember.wClosed, `${tag} 重畫後記得哪張收起、哪張展開`, r.remember);
  ok(r.go === true, `${tag} 點今天要注意的項目，跳到那張卡並展開`, r.go);
  ok(r.overflow && !r.overflow.length, `${tag} 手機寬度不會橫向捲動`, r.overflow);
  if (lang === 'en') ok(r.leak && !r.leak.length, `${tag} 英文介面卡片上沒有中文`, r.leak);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
