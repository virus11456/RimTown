// v6.66.0 外交:初始關係、派使節(魅力加分)、送珍品、貿易協定→同盟→聯姻、盟友送糧、貿易戰與禁運(經濟影響)、遠方消息影響關係、AI 決定、AI 知道盟友對頭、畫面、存讀檔
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w); CLASS.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      let D0 = 500; const _ad = w._absDay; w._absDay = () => D0;
      const out = {}; TIDINGS.S(w); const D = DIPLO.S(w); const ps = w.tidings.places; const nb = ps.find(p => p.id.startsWith('nb:')), realm = ps.find(p => p.id === 'realm'), cap = ps.find(p => p.id === 'capital');
      out.init = D.rel[nb.id] === 20 && D.rel[cap.id] === 30 && D.rel[realm.id] === 0;
      // 派使節:有魅力的人
      const env = npcs()[0]; env.personality.traits = [...env.personality.traits.filter(x => x !== 'abrasive'), 'charismatic'];
      const r0 = D.rel[nb.id]; fix(0.9, () => DIPLO.act(w, D, 'envoy', nb.id)); out.envoy = D.rel[nb.id] > r0 + 5 && logHas(/出使|envoy/);
      // 送珍品
      w.goods = null; const G = GOODS.S(w); G.town.push({ id: 'G1', key: 'statue', from: 'x', day: D0 }); const r1 = D.rel[realm.id];
      DIPLO.act(w, D, 'gift', realm.id); out.gift = D.rel[realm.id] >= r1 + 20 && G.town.length === 0 && logHas(/禮物|gift/);
      // 協定 → 同盟
      D.rel[nb.id] = 45; DIPLO.settle(w, D, nb.id); out.trade = D.status[nb.id] === 'trade' && logHas(/貿易協定|trade pact/);
      D.rel[nb.id] = 75; DIPLO.settle(w, D, nb.id); out.ally = D.status[nb.id] === 'ally' && logHas(/結盟|alliance/);
      const m0 = w.news.getModifier('merchant_chance', 0); DIPLO.effects(w, D); out.allyEffect = w.news.getModifier('merchant_chance', 0) > m0;
      // 聯姻
      const n0 = npcs().length; const bride = npcs().find(a => a.age >= 18 && a.age <= 40 && !a.relationships.getPartner()); const L = w.election.currentMayor(w); if (bride && L && bride !== L) bride._parentNames = [L.name, 'x'];
      DIPLO.act(w, D, 'wed', nb.id); out.wed = !!D.wed[nb.id] && logHas(/結為親家|married into/) && npcs().length === n0 - 1;
      // 盟友送糧
      const food0 = w.stockpile.get('food'); w.stockpile.consume('food', food0, w.tickCount, 't'); D.lastAct = D0; D.lastDay = null; fix(0.99, () => DIPLO.daily(w)); out.aid = w.stockpile.get('food') >= 60 && logHas(/送來了|sent 60/);
      // 貿易戰與禁運
      D.rel[realm.id] = -35; DIPLO.settle(w, D, realm.id); out.war = DIPLO.statusOf(D.rel[realm.id], D, realm.id) === 'war';
      D.rel[realm.id] = -70; DIPLO.settle(w, D, realm.id); out.embargo = DIPLO.statusOf(D.rel[realm.id], D, realm.id) === 'embargo' && logHas(/禁運|embargo/);
      D.rel[nb.id] = 0; D.status[nb.id] = 'none'; DIPLO.effects(w, D); out.embargoEffect = w.news.getModifier('merchant_chance', 0) < 0;
      // 遠方消息:加稅王令讓跟首都的關係變差
      const rc = D.rel[cap.id]; DIPLO.onTiding(w, { pid: cap.id, k: '{p}傳來王令：全國加稅' }); out.tiding = D.rel[cap.id] < rc;
      // AI 決定
      const _fa = w.fullAgentMode, _ok = CE.fullAgentOk, _aj = CE._askJson; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => ({ pid: cap.id, act: 'envoy', why: '跟王室打好關係' });
      const rc2 = D.rel[cap.id]; await DIPLO.decide(w, D); out.ai = D.rel[cap.id] > rc2 && D.why === '跟王室打好關係';
      w.fullAgentMode = _fa; CE.fullAgentOk = _ok; CE._askJson = _aj; w._absDay = _ad;
      D.rel[nb.id] = 75; D.status[nb.id] = 'ally'; out.brief = CE._townBrief(w);
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app.renderNews(box); /* v7.3.0 搬到日報 › 消息 */ out.ui = box.querySelector('.pp-diplo')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.diplo?.rel?.[realm.id] === D.rel[realm.id]; w2.reset(); out.reset = !w2.diplo;
      return out;
    });
    ok(r.init, '初始關係：鄰鎮友好、王國首都較好、異國中立', r);
    ok(r.envoy, '首長派使節，有魅力的人效果好', r);
    ok(r.gift, '把公庫珍品送去當外交禮物', r);
    ok(r.trade && r.ally && r.allyEffect, '關係好會簽貿易協定、再結盟，商人更常來', r);
    ok(r.wed, '跟同盟聯姻，鎮上的人嫁過去', r);
    ok(r.aid, '缺糧時盟友送糧', r);
    ok(r.war && r.embargo && r.embargoEffect, '關係差會打貿易戰、被禁運，商人不來', r);
    ok(r.tiding, '遠方消息（加稅王令）讓關係變差', r);
    ok(r.ai, '完整智能體模式由首長 AI 決定外交行動', r);
    ok(/盟友|Allies/.test(r.brief) && /對頭|Rivals/.test(r.brief), 'AI 知道鎮上的盟友與對頭', r.brief.slice(-160));
    ok(/🤝/.test(r.ui), '消息頁有外交', r.ui.slice(0, 200));
    ok(r.rt && r.reset, '外交存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
