// v6.82.3 突發狀況不再要觀察者選:盜匪來襲、壞事件、災害預警防災、搬家提案在觀察者模式由首長當場決定(看付不付得起、效果與個性)，
// 不跳視窗、日誌與日報寫「鎮長某某決定」、首長記得自己的決定;中英
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; w.observerMode = true;
      const out = {}; const logs = () => (w.messageLog || []).map(m => w.logText ? w.logText(m) : (m.content || '')).join('\n');
      const mayor = w.proposals._mayor(w); out.mayor = mayor?.name || null;
      let shown = 0; const orig = app._showEventChoiceCard; app._showEventChoiceCard = () => { shown++; };
      // 1) 盜匪來襲(有威脅等級)
      w.eventChoice.offerChoice({ name: '盜匪來襲', description: 'x', severity: 'major', threat_level: 2, effects: {} }, w);
      app._shownEventChoiceId = null; app._checkV4Notifications(); out.popup = shown;
      out.pendingBefore = !!w.eventChoice.pendingEvent;
      w.paused = false; w.tick(); w.paused = true;
      out.raidResolved = !w.eventChoice.pendingEvent;
      const L = logs(); out.raidLog = /面對.*盜匪來襲.*決定|Facing .*decided/.test(L);
      out.mayorMem = mayor ? (mayor.memory?.entries || []).some(e => /我決定|I decided/.test((typeof Memory !== 'undefined' && Memory.render) ? Memory.render(e.key || e.k || e.content, e.params || e.p) : (e.content || '')) || /我決定/.test(e.key || '')) : null;
      // 2) 壞事件(團結面對／祈禱平安)
      w.eventChoice.offerChoice({ name: '饑荒', description: 'x', severity: 'major', effects: { mood_all: -8 } }, w);
      w.paused = false; w.tick(); w.paused = true; out.badResolved = !w.eventChoice.pendingEvent;
      // 3) 災害預警:木材不夠時不選全面防災(要 30 木 20 食)
      w.stockpile.resources.wood = 5; w.stockpile.resources.food = 500;
      w.weather._offerPrepChoice(w, '洪水');
      const choices = w.eventChoice.pendingEvent?.choices?.map(c => c.label) || [];
      w.paused = false; w.tick(); w.paused = true;
      out.prepResolved = !w.eventChoice.pendingEvent; out.prepLevel = w.weather._prepLevel; out.prepChoices = choices.length;
      out.woodAfter = Math.round(w.stockpile.get('wood'));
      // 4) 帶 autoResolve 的(搬家提案)照兩人意思
      w.eventChoice.pendingEvent = { eventName: '搬家提案', description: 'x', severity: 'minor', timestamp: w.tickCount, choices: [{ label: 'A', effects: {} }, { label: 'B', effects: {} }, { label: 'C', effects: {} }], autoResolve: { absDay: w._absDay() + 3, choice: 1 } };
      const before = w.eventChoice.eventLog.length; w.paused = false; w.tick(); w.paused = true;
      out.autoPick = w.eventChoice.eventLog.slice(before).map(x => x.choice)[0];
      app._showEventChoiceCard = orig;
      out.noYou = !/你選擇了|You chose/.test(logs().split('\n').slice(-40).join('\n'));
      return out;
    });
    ok(r.mayor, '有首長可以拍板', r.mayor);
    ok(r.popup === 0, '觀察者模式不跳「要你選」的視窗', r.popup);
    ok(r.pendingBefore && r.raidResolved && r.raidLog, '盜匪來襲：下一刻就由首長決定，日誌寫「面對…決定」', r);
    ok(r.mayorMem !== false, '首長記得自己做的決定', r.mayorMem);
    ok(r.badResolved, '壞事件（團結面對／祈禱平安）也由首長決定', r.badResolved);
    ok(r.prepResolved && r.prepChoices === 3 && r.prepLevel !== 2 && r.woodAfter >= 0, '災害預警：木材不夠時不會選付不起的「全面防災」', { lv: r.prepLevel, wood: r.woodAfter });
    ok(r.autoPick === 'B', '搬家提案照兩人的意思決定', r.autoPick);
    ok(r.noYou, '日誌不再寫「你選擇了」', r.noYou);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
