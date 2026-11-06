// v6.58.1 結局:觀察者沙盒沒有結局(衰敗只是低潮,不跳結局畫面)、結局畫面按鈕點得動、鎮志不再出現 undefined
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world, me = w.multiEnding; const out = { observer: !!w.observerMode };
    me.checkEnding(w, 'prosper'); out.finale = me.endingTriggered;
    me.triggerDecline(w); out.declined = me.endingTriggered; out.noData = !me.endingData;
    out.log = (w.messageLog || []).slice(-5).some(m => /復興|recover/.test(m.content || ''));
    app._setPaused?.(false); await new Promise(r => setTimeout(r, 2600)); app._setPaused?.(true);
    out.noOverlay = !document.getElementById('ending-overlay');
    // 復興後照常
    me.revive(w); out.revived = me.endingTriggered === null;
    // 結局畫面(舊的玩家模式路徑)按鈕要點得動
    w.questSystem.quests.__x = { status: 'completed' };
    me.endingData = { type: { icon: '🏆', title: 'T', subtitle: '', description: '', color: '#fc0' }, stats: me._collectStats(w), history: me._buildTownHistory(w) };
    out.noUndef = !JSON.stringify(me.endingData.history).includes('undefined');
    app._showEndingOverlay(); const btn = document.querySelector('#ending-overlay [data-action="close-ending"]'); out.hasBtn = !!btn; btn?.click();
    out.closed = !document.getElementById('ending-overlay'); me.endingData = null; delete w.questSystem.quests.__x;
    return out;
  });
  ok(r.observer, '預設是觀察者模式', r);
  ok(r.finale === null, '觀察者模式完成主線不會觸發結局', r);
  ok(r.declined === 'decline' && r.noData && r.log, '衰敗只是低潮狀態並提示可以復興，不產生結局畫面', r);
  ok(r.noOverlay, '模擬照常跑，不會跳出結局畫面', r);
  ok(r.revived, '撐過考驗仍可復興', r);
  ok(r.noUndef, '鎮志不會出現「完成任務：undefined」', r);
  ok(r.hasBtn && r.closed, '結局畫面的按鈕點得動', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
