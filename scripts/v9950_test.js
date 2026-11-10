// v9.9.5 小修正:出遠門的配偶也能繼承、回來不再是已婚;銀行付不出的存款轉給繼承人;出遠門欠租不歸零;託夢按鈕按到圖示也有反應、成功有提示;事件卡手牌不再跟世界級災厄疊在一起
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang, mobile) {
  const ctx = await browser.newContext(mobile ? { serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('去圖書館看看'));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const out = {}; const adults = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 20);
    const [X, Y, Z] = adults();
    for (const a of adults()) { if (a === X || a === Y) continue; const r0 = a.relationships.relationships[X.agentId]; if (r0 && ['married', 'dating'].includes(r0.status)) r0.status = 'friend'; if ((a._parentNames || []).includes(X.name)) a._parentNames = a._parentNames.filter(n => n !== X.name); }
    const rel = (a, b, st) => { a.relationships.getOrCreate(b.agentId, b.name).status = st; b.relationships.getOrCreate(a.agentId, a.name).status = st; }; rel(X, Y, 'married');
    // A. 配偶出遠門時另一半過世:分得到遺產、回來改成前任、記得這件事
    WALLET.take(w, X, WALLET.get(w, X)); WALLET.add(w, X, 200); const y0 = WALLET.get(w, Y); const Yid = Y.agentId;
    w.events._sendAgentTravelling(w, Y, 'test', 5); out.away = !w.agents[Yid] && w.isAway(Yid);
    X._deathCause = 'test'; w.lifecycle._killNpc(w, X);
    const tr = w.events._travellingAgents.find(t2 => t2.agentData.agentId === Yid); tr.returnTick = w.tickCount; w.events._checkReturningTravellers(w);
    const Y2 = w.agents[Yid]; out.heir = { back: !!Y2, gain: Y2 ? Math.round(WALLET.get(w, Y2) - y0) : null, st: Y2?.relationships?.relationships?.[X.agentId]?.status, mem: (Y2?.memory?.entries || []).slice(-40).some(m => /出遠門的時候|while I was travelling/.test(m.content || '')) };
    // B. 過世時銀行準備金不夠付存款:付不出的部分轉成繼承人的存款
    { const [P, Q] = adults().filter(a => a.agentId !== Yid); for (const a of adults()) { const r0 = a.relationships.relationships[P.agentId]; if (r0 && ['married', 'dating'].includes(r0.status)) r0.status = 'friend'; if ((a._parentNames || []).includes(P.name)) a._parentNames = a._parentNames.filter(n => n !== P.name); } rel(P, Q, 'married');
      const B = BANK.S(w); B.dep = B.dep || {}; B.dep[P.agentId] = 100; B.reserve = 30; const q0 = B.dep[Q.agentId] || 0; P._deathCause = 'test'; w.lifecycle._killNpc(w, P);
      out.dep = { moved: Math.round((B.dep[Q.agentId] || 0) - q0), reserve: Math.round(B.reserve) }; }
    // C. 出遠門回來欠租不歸零
    { const E = w.estate; const all2 = adults().filter(a => a.agentId !== Yid && !Object.values(a.relationships?.relationships || {}).some(r0 => r0.status === 'married')); const A = all2.find(a => E && E.home?.[a.agentId]); if (A && E) { E.arrears[A.agentId] = 12; w.events._sendAgentTravelling(w, A, 'test', 3); for (let i = 0; i < 2; i++) { ESTATE.daily?.(w); } const tr2 = w.events._travellingAgents.find(t2 => t2.agentData.agentId === A.agentId); if (tr2) tr2.returnTick = w.tickCount; w.events._checkReturningTravellers(w); out.rent = { back: !!w.agents[A.agentId], arrears: E.arrears[A.agentId] || 0 }; } else out.rent = { skip: true }; }
    // D. 託夢按鈕:按到裡面的圖示也有反應,成功有提示
    const target = adults()[3]; const n0 = (w.dream?.dreams || []).length; try { if (typeof GODBOOK !== 'undefined' && GODBOOK.S) { const G = GODBOOK.S(w); G.power = Math.max(G.power || 0, 20); } } catch (e) {} if (w.dream) w.dream.lastDream = -99;
    app._showNpcCard(target.agentId); const btn = document.querySelector('#npc-quick-card [data-nqc="dream"]'); out.btn = !!btn; const ic = btn?.querySelector('.nqc-ic') || btn;
    ic?.click(); out.dreamTarget = target.agentId;
    return out;
  });
  await page.waitForFunction((id) => { const D = window.rimtownApp.world.dream?.dreams || []; return D[D.length - 1]?.to === id && /夢已經送到|dream has been sent|今天已託夢|Dream sent today/i.test(document.body.innerText); }, r.dreamTarget, { timeout: 15000 }).catch(() => {});
  const d = await page.evaluate((id) => { const w = window.rimtownApp.world; const D = (w.dream?.dreams || []); return { n: D.length, last: D[D.length - 1]?.to === id, notice: /夢已經送到|dream has been sent|今天已託夢|Dream sent today/i.test(document.body.innerText), cardDone: !!document.querySelector('#npc-quick-card [data-nqc="dream"][disabled]') }; }, r.dreamTarget);
  console.log(lang, mobile ? 'mobile' : 'desktop', JSON.stringify(r), JSON.stringify(d));
  const tag = `[${lang}${mobile ? ' 手機' : ''}]`;
  if (!mobile) {
    ok(r.away && r.heir.back && r.heir.gain >= 100, `${tag} 配偶出遠門時另一半過世：回來分得到遺產`, r.heir);
    ok(r.heir.st === 'ex' && r.heir.mem, `${tag} 回來不再是「已婚」，也記得出遠門時家人走了`, r.heir);
    ok(r.dep.moved === 70, `${tag} 銀行一時付不出的存款（70）轉成繼承人的存款，不會消失`, r.dep);
    ok(r.rent.skip || (r.rent.back && r.rent.arrears === 12), `${tag} 出遠門回來，欠的房租還在（不會歸零）`, r.rent);
  }
  ok(r.btn && d.last, `${tag} 按託夢按鈕裡的圖示也會託夢（以前按到圖示或文字沒反應）`, d);
  ok(d.notice && d.cardDone, `${tag} 託夢後有提示（村民卡上的按鈕變成「今天已託夢」）`, d);
  // E. 事件卡手牌:視窗矮的時候手牌不被壓扁、不跟世界級災厄疊在一起
  if (!mobile) await page.setViewportSize({ width: 1000, height: 560 });
  const g = await page.evaluate(async () => { const app = window.rimtownApp; app._uiOn = () => true; app._ghIntro = false; app._ghIntroSeen?.(); app._ghShow(); app._ghRender(); await new Promise(r => setTimeout(r, 400));
    const R = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
    return { hand: R('#gh-tray .gh-col > .gh-hand'), card: R('#gh-tray .gh-col > .gh-hand .gh-card'), wc: R('#gh-tray .gh-wc') }; });
  ok(g.hand && g.card && g.hand.h >= g.card.h && (!g.wc || g.wc.top >= g.hand.bottom - 1), `${tag} 事件卡手牌不會被壓扁、不跟世界級災厄疊在一起`, g);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [lang, mobile] of [['zh', false], ['en', false], ['zh', true]]) await run(browser, lang, mobile);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
