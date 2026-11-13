// v6.58.0 社會階層:六階判定、城鎮以上相差兩階不隨機閒聊(熟人除外)、引薦、城市以上冊封與買爵位、AI 知道地位、存讀檔
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
  const r = await page.evaluate(() => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true); WALLET.S(w);
    const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const poor = all.find(a => !['mayor'].includes(a.job?.key)); const rich = all.find(a => a !== poor && a.job?.key !== 'mayor');
    poor.job = null; w.wallet.bal[poor.agentId] = 0; w.wallet.bal[rich.agentId] = 500;
    CLASS.daily(w);
    const out = { poorLv: CLASS.level(w, poor), richLv: CLASS.level(w, rich), village: CLASS.canMingle(w, poor, rich) };
    // 升到城鎮:不熟又差兩階 → 不閒聊;熟了就可以
    w.tierState.lv = 1;
    const rp = poor.relationships.getOrCreate(rich.agentId, rich.name); rp.affinity = 0; rp.status = null; const rr = rich.relationships.getOrCreate(poor.agentId, poor.name); rr.affinity = 0; rr.status = null;
    out.town = CLASS.canMingle(w, poor, rich); rp.affinity = 40; out.friends = CLASS.canMingle(w, poor, rich); rp.affinity = 0;
    // 實際閒聊篩選:同一地點只看得到能聊的人
    let seen = null; const orig = w.getAgentsAtLocation; w.getAgentsAtLocation = function (loc) { return [poor, rich]; };
    const AP = Object.getPrototypeOf(poor); const inner = AP.__proto__; // 不動原型,直接呼叫包過的版本
    poor._lastInteractionTick = -999; poor._interactionCooldown = 0; poor.activity = 'socializing'; rich.activity = 'socializing';
    const _spread = w.gossipNetwork.spreadGossip; let talked = false; w.gossipNetwork.spreadGossip = () => { talked = true; };
    const _r = Math.random; Math.random = () => 0.01; try { poor._trySocialInteraction(w); } finally { Math.random = _r; w.gossipNetwork.spreadGossip = _spread; w.getAgentsAtLocation = orig; }
    out.talkedAcross = talked;
    // 冊封(城市以上)與買爵位
    w.tierState.lv = 2; const C = CLASS.S(w); C.lastGrant = -99;
    const hero = all.find(a => a !== rich && a !== poor && a.job?.key !== 'mayor'); w.proposals.record = (id) => id === hero.agentId ? { done: 5, approved: 5 } : { done: 0, approved: 0 };
    const buyer = rich; w.wallet.bal[buyer.agentId] = 1000; const tr0 = w.stockpile.get('silver');
    const _r2 = Math.random; Math.random = () => 0.01; try { CLASS.daily(w); if (CLASS.byFun?.(w)) CLASS.titleBy(w, buyer); /* v9.25.0 買不買爵位交給本人決定：這裡替他拿主意 */ } finally { Math.random = _r2; }
    out.heroTitle = CLASS.titleOf(w, hero); out.heroLv = CLASS.level(w, hero); out.buyerTitle = CLASS.titleOf(w, buyer); out.bought = !!C.titles[buyer.agentId]?.bought; out.paid = w.stockpile.get('silver') - tr0;
    out.brief = JSON.stringify(w.conversationEngine._agentBrief(w, hero, null));
    const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = !!w2.classes?.titles?.[hero.agentId]; w2.reset(); out.reset = !w2.classes;
    app.state = w.getState(); app._showNpcCard(hero.agentId); out.card = document.getElementById('npc-quick-card')?.innerText || ''; app._hideNpcCard();
    return out;
  });
  ok(r.poorLv === 0 && r.richLv >= 3, '沒工作又沒錢是底層；有錢人是士紳以上', r);
  ok(r.village === true, '村莊裡大家都會碰面聊天', r);
  ok(r.town === false && r.friends === true, '城鎮以上不熟又差兩階不會隨機閒聊；熟人照聊', r);
  ok(r.talkedAcross === false, '實際閒聊時，底層的人找不到士紳說話', r);
  ok(/騎士|Knight/.test(r.heroTitle) && r.heroLv === 4, '城市以上首長冊封有功的人為騎士（貴族）', r);
  ok(r.bought && r.paid >= 300, '有錢人花錢買爵位，錢進公庫', r);
  ok(/社會地位|Social standing/.test(r.brief) && /騎士|Knight/.test(r.brief), 'AI 知道自己的社會地位與頭銜', r.brief.slice(0, 200));
  ok(r.rt && r.reset, '頭銜存讀檔保留、新城鎮重來', r);
  ok(/⚜️/.test(r.card), '角色卡顯示階層與頭銜', r.card.slice(0, 200));
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
