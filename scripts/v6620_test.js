// v6.62.0 消息傳遞:遠方地點(鄰鎮、王國首都、異國)、事件有時差(信差較快)、管道不準會走樣、帶消息的人先知道再沿交情擴散、AI 只知道自己聽過的、到了才生效(新聞修正值)、升格、外地消息頁、存讀檔
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-30).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const out = {}; const T = TIDINGS.S(w);
      out.places = T.places.map(p => p.kind); out.nNb = T.places.filter(p => p.id.startsWith('nb:')).length;
      const V0 = TIDINGS.view(w); out.names = V0.places.map(p => p.name).join(' / ');
      // 遠方發生事 → 進信箱(還沒到)
      let D = 100; const _ad = w._absDay; w._absDay = () => D; T.lastDay = null; T.inbox = []; T.items = [];
      fix(0.01, () => TIDINGS.daily(w)); out.inbox = T.inbox.length; out.notYet = T.items.length === 0;
      const cap = T.inbox.find(x => x.pid === 'capital'), realm = T.inbox.find(x => x.pid === 'realm');
      out.lagCourier = cap && cap.ch === 'courier' ? cap.arrive - cap.made : null; out.lagRealm = realm ? realm.arrive - realm.made : null;
      // 指定一則旅人消息:不準 → 走樣
      T.inbox = [{ pid: 'realm', k: '{p}跟鄰國開戰了', ch: 'traveler', m: { raid_chance: 0.05, immigration_chance: 0.2, mood_modifier: -3, sell_bonus: 0.1 }, made: D, arrive: D }];
      const sell0 = w.news.getModifier('sell_bonus', 0);
      fix(0.99, () => { T.lastDay = null; TIDINGS.daily(w); });
      const it = T.items[T.items.length - 1]; out.arrived = !!it; out.dist = !!it?.dist; out.text = it ? TIDINGS.render(it) : '';
      out.effect = w.news.getModifier('sell_bonus', 0) > sell0 && w.news.bulletins.some(b => b.remote);
      out.log = logHas(/📨/);
      const carrier = npcs().find(a => a.name === it.by); out.carrierKnows = !!carrier && TIDINGS.heardBy(w, carrier).length >= 1;
      const others = npcs().filter(a => a !== carrier); const knowers0 = others.filter(a => TIDINGS.heardBy(w, a).some(x => x.id === it.id)).length; out.onlyCarrier = knowers0 === 0;
      // AI 只知道自己聽過的
      const stranger = others[0]; out.strangerBrief = JSON.stringify(CE._agentBrief(w, stranger, null)); out.carrierBrief = JSON.stringify(CE._agentBrief(w, carrier, null));
      // 沿交情擴散
      const friend = others[1]; carrier.relationships.getOrCreate(friend.agentId, friend.name).affinity = 60;
      for (const o of others) if (o !== friend) { const rr = carrier.relationships.relationships[o.agentId]; if (rr) rr.affinity = 0; }
      fix(0.01, () => TIDINGS.spread(w, T, D)); out.spread = TIDINGS.heardBy(w, friend).some(x => x.id === it.id);
      // 信差的消息準
      T.inbox = [{ pid: 'capital', k: '{p}傳來王令：全國加稅', ch: 'courier', m: { mood_modifier: -4 }, made: D, arrive: D }];
      fix(0.99, () => { T.lastDay = null; D++; TIDINGS.daily(w); }); const it2 = T.items[T.items.length - 1]; out.courierAcc = it2 && !it2.dist && it2.ch === 'courier';
      // 升格
      const nb = T.places.find(p => p.kind === 'town' && p.lv < 3); const lv0 = nb?.lv;
      if (nb) { T.inbox = [{ pid: nb.id, k: '{p}升格了', ch: 'traveler', m: {}, up: true, made: D, arrive: D }]; fix(0.01, () => { T.lastDay = null; D++; TIDINGS.daily(w); }); }
      out.up = !nb || nb.lv === lv0 + 1; out.upText = T.items.length ? TIDINGS.render(T.items[T.items.length - 1]) : '';
      w._absDay = _ad;
      // 畫面
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-tidings')?.innerText || ''; box.remove();
      // 存讀檔
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.tidings?.items?.length === T.items.length; w2.reset(); out.reset = !w2.tidings;
      return out;
    });
    ok(r.places.includes('capital') && r.places.includes('realm') && r.nNb >= 3, '遠方地點：鄰鎮、王國首都、異國', r);
    ok(lang === 'zh' ? /京/.test(r.names) : !/[一-鿿]/.test(r.names), '地名依語言顯示', r.names);
    ok(r.inbox >= 3 && r.notYet, '遠方的事不會馬上傳到', r);
    ok(r.lagRealm >= 12 && (r.lagCourier === null || r.lagCourier < r.lagRealm), '越遠越晚到；信差比較快', r);
    ok(r.arrived && r.log && r.effect, '消息到了才生效（物價、移民、盜匪…），動態看得到', r);
    ok(r.dist && /誇張|keeps growing/.test(r.text), '旅人帶來的消息會走樣誇大', r.text);
    ok(r.carrierKnows && r.onlyCarrier, '一開始只有帶消息的人知道', r);
    ok(!/外地消息|News from afar/.test(r.strangerBrief) && /外地消息|News from afar/.test(r.carrierBrief), 'AI 只知道自己聽過的消息', { s: r.strangerBrief.slice(-120), c: r.carrierBrief.slice(-160) });
    ok(r.spread, '消息沿著交情一個傳一個', r);
    ok(r.courierAcc, '信差帶來的王令最準', r);
    ok(r.up && /升格|grown|become/.test(r.upText), '遠方城鎮也會自己升格', r);
    ok(/📨/.test(r.ui) && /天|day|rumor|傳聞|可靠|reliable/.test(r.ui), '鎮況頁有外地消息（地點、幾天前、誰帶回、可信度）', r.ui.slice(0, 300));
    ok(r.rt && r.reset, '消息存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
