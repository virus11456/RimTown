// v6.67.0 治安與民生:偷竊(衛兵抓到坐牢、沒抓到成祕密)、出獄、貧民區、稅率提案與投票執行、房租、王都壽宴與皇家婚禮、依等級吸引移民、畫面、存讀檔
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
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const seq = (vals, f) => { let i = 0; Math.random = () => (i < vals.length ? vals[i++] : 0.5); try { return f(); } finally { Math.random = _r; } };
      let D = 700; const _ad = w._absDay; w._absDay = () => D; const out = {}; const C = CIVIC.S(w);
      const all = npcs(); for (const a of all) w.wallet.bal[a.agentId] = 30; // 沒人是窮人、也沒人是有錢人
      const thief = all[0], vic = all[1]; thief.personality.traits = [...thief.personality.traits, 'lazy']; w.wallet.bal[thief.agentId] = 0; w.wallet.bal[vic.agentId] = 200;
      for (const a of all) if (a.job?.key === 'guard') a.job.key = 'farmer'; all[2].job.key = 'guard'; all[3].job.key = 'guard';
      // 抓到
      seq([0.01, 0.01], () => CIVIC.crime(w, C, D)); out.caught = C.jail[thief.agentId] > D && WALLET.get(w, vic) === 200 && logHas(/衛兵抓到|guards caught/);
      // 出獄
      D = C.jail[thief.agentId]; CIVIC.crime(w, C, D); out.released = !C.jail[thief.agentId] && logHas(/出獄|released/);
      // 沒抓到 → 祕密
      all[2].job.key = 'farmer'; all[3].job.key = 'farmer'; w.wallet.bal[thief.agentId] = 0; D++;
      const ns = (w.dark?.secrets || []).length; seq([0.01, 0.99], () => CIVIC.crime(w, C, D)); out.secret = (w.dark?.secrets || []).length > ns && WALLET.get(w, vic) < 200;
      // 貧民區
      for (const a of all) w.wallet.bal[a.agentId] = 0; C.poorDays = 9; D++; fix(0.99, () => CIVIC.crime(w, C, D)); out.slum = C.slum && logHas(/貧民區|slum/);
      // 稅率提案
      for (const a of all) w.wallet.bal[a.agentId] = 30; const silver = w.stockpile.get('silver'); w.stockpile.consume('silver', silver, w.tickCount, 't'); w.stockpile.add('silver', 20, w.tickCount, 't'); C.lastTax = -99;
      const tax0 = w.wallet.tax; const P = w.proposals; P.items = (P.items || []).filter(p => p.kind !== 'tax'); const p = CIVIC.taxProposal(w, C, D);
      out.taxProp = !!p && p.kind === 'tax' && p.dir === 'up';
      if (p) { const rich = all[5]; w.wallet.bal[rich.agentId] = 500; out.voteRichDown = CIVIC.taxVote(w, { dir: 'down' }, rich) === 'for'; p.status = 'approved'; w.stockpile.add('silver', 10, w.tickCount, 't'); P._execute(w, p, D); out.taxApplied = w.wallet.tax > tax0; }
      // 房租
      const [A, B] = [all[6], all[7]]; const _ho = HOUSING.houseOf; HOUSING.houseOf = (ww, a) => (a === A || a === B) ? 'H1' : _ho(ww, a); A._parentNames = []; B._parentNames = []; const ra = A.relationships.relationships[B.agentId]; if (ra) ra.status = null; const rb = B.relationships.relationships[A.agentId]; if (rb) rb.status = null;
      w.wallet.bal[A.agentId] = 300; w.wallet.bal[B.agentId] = 50; D = 707; C.rentDay = null; CIVIC.rent(w, C, D); HOUSING.houseOf = _ho; out.rent = WALLET.get(w, B) < 50 && WALLET.get(w, A) > 300;
      // 王都:壽宴與皇家婚禮
      w.tierState.lv = 3; w.crown = null; w.council._formCouncil(w); for (const id of w.council.members) { const m = w.agents[id]; for (const o of npcs()) m.relationships.getOrCreate(o.agentId, o.name).affinity = 10; }
      fix(0.5, () => CROWN.daily(w)); const k = CROWN.king(w); const part = k.relationships.getPartner?.(); if (part) { const pr = k.relationships.relationships[part.targetId || part.agentId]; if (pr) pr.status = null; }
      w.stockpile.add('silver', 300, w.tickCount, 't'); const cs = w.clock.season, cd = w.clock.day; w.clock.season = '夏季'; w.clock.day = 8; C.feastYear = null;
      fix(0.01, () => CIVIC.grand(w, C, D)); w.clock.season = cs; w.clock.day = cd;
      out.feast = logHas(/壽宴|birthday feast/); out.wedding = logHas(/皇家婚禮|royal wedding/i);
      // 移民
      CIVIC.migration(w); out.immig = w.news.getModifier('immigration_chance', 0) >= 0.15;
      w._absDay = _ad;
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-civic')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.civic?.thefts === C.thefts; w2.reset(); out.reset = !w2.civic;
      return out;
    });
    ok(r.caught, '衛兵抓到小偷：坐牢、錢還回去', r);
    ok(r.released, '刑期滿出獄', r);
    ok(r.secret, '沒抓到就成了真相頁的祕密', r);
    ok(r.slum, '窮人太多太久會形成貧民區', r);
    ok(r.taxProp && r.voteRichDown && r.taxApplied, '公庫見底時有人提加稅，依荷包投票，通過就改稅率', r);
    ok(r.rent, '同住的房客付房租給房東', r);
    ok(r.feast && r.wedding, '王都大事件：國王壽宴、皇家婚禮', r);
    ok(r.immig, '城鎮等級越高越吸引移民', r);
    ok(/👮/.test(r.ui) && /稅率|Tax rate/.test(r.ui), '鎮況頁有治安與民生', r.ui);
    ok(r.rt && r.reset, '治安存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
