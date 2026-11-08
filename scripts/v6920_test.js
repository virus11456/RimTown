// v6.92.0 3D 人物依年齡與貧富換外觀:年齡段、小孩不穿披風、身高、補丁、士紳／貴族／王族服飾、王冠、白髮、外觀變了才重建、遠處簡化網格;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
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
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {}; const w = app.world; const T = app.tileMap; const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      // 1) getState 每個村民帶 appear(年齡段、階層、國王、無家可歸)
      const st = w.getState(); const a0 = all[0]; out.appear = st.agents[a0.agentId]?.appear || null;
      out.bands = [5, 12, 13, 17, 30, 60, 74, 75, 90].map(LOOK.band).join('');
      const kid = all.find(a => a.age <= 12) || all[1]; const kidAge = kid.age; kid.age = 9; w.classes = w.classes || { lv: {}, titles: {}, day: -1 }; w.classes.lv[kid.agentId] = 5; out.kidCls = LOOK.of(w, kid).cls; kid.age = kidAge;
      // 2) 3D 人物:依外觀建出不同網格(同一個人換外觀才重建)
      const verts = (m) => { let n = 0; m.traverse(o => { if (o.isMesh && !o.userData.isLod) n += o.geometry.attributes.position.count; }); return n; };
      const mk = (ap, id, job) => { const aid = 'look_' + id; const m = T._agentMesh(aid, { name: '測試同一人', job: { key: job || 'farmer' }, appear: ap }, { job: job || 'farmer', gender: 'male' }); /* v6.96 長相依名字變化:比較外觀時用同一個名字 */ const o = { scale: m.scale.x, v: verts(m), sig: m.userData.sig, m }; return o; };
      const base = mk({ b: 'a', cls: 1, king: false, hl: false }, 'base', 'trader');
      const child = mk({ b: 'c', cls: 1, king: false, hl: false }, 'child', 'trader');
      const teen = mk({ b: 't', cls: 1, king: false, hl: false }, 'teen', 'trader');
      const poor = mk({ b: 'a', cls: 0, king: false, hl: true }, 'poor', 'trader');
      const gent = mk({ b: 'a', cls: 3, king: false, hl: false }, 'gent', 'trader');
      const noble = mk({ b: 'a', cls: 4, king: false, hl: false }, 'noble', 'trader');
      const king = mk({ b: 'e', cls: 5, king: true, hl: false }, 'king', 'mayor');
      const old = mk({ b: 'o', cls: 1, king: false, hl: false }, 'old', 'trader');
      out.scale = [child.scale, teen.scale, base.scale];
      out.v = { base: base.v, poor: poor.v, gent: gent.v, noble: noble.v, king: king.v, child: child.v };
      const hairOf = (m) => { let best = null; m.traverse(o => { if (o.isMesh && !best && o.geometry.attributes.color) best = o; }); const c = best.geometry.attributes.color; const ys = best.geometry.attributes.position; let top = -1, col = null; for (let i = 0; i < ys.count; i++) if (ys.getY(i) > top) { top = ys.getY(i); col = [c.getX(i), c.getY(i), c.getZ(i)]; } return col; };
      const ho = hairOf(old.m); out.oldHair = ho; out.oldGray = Math.abs(ho[0] - ho[1]) < 0.05 && Math.abs(ho[1] - ho[2]) < 0.05 && ho[0] > 0.8;
      // 換外觀 → 重建
      const m1 = T._agentMesh('look_base', { name: '測試同一人', job: { key: 'trader' }, appear: { b: 'a', cls: 1, king: false, hl: false } }, { job: 'trader', gender: 'male' });
      const m2 = T._agentMesh('look_base', { name: '測試同一人', job: { key: 'trader' }, appear: { b: 'a', cls: 1, king: false, hl: false } }, { job: 'trader', gender: 'male' });
      const m3 = T._agentMesh('look_base', { name: '測試同一人', job: { key: 'trader' }, appear: { b: 'a', cls: 4, king: false, hl: false } }, { job: 'trader', gender: 'male' });
      out.reuse = m1 === m2; out.rebuild = m3 !== m2;
      // 遠處簡化網格(人多時)也照樣建得出來
      try { const lod = T._agentLod(king.m); out.lod = lod.geometry.attributes.position.count > 0; } catch (e) { out.lodErr = e.message; }
      for (const id of ['base', 'child', 'teen', 'poor', 'gent', 'noble', 'king', 'old']) { const m = T._agentMeshes['look_' + id]; if (m) { T._agentGroup.remove(m); T._disposeAgent(m); delete T._agentMeshes['look_' + id]; } }
      // 3) 存讀檔不受影響、跑幾天沒錯
      try { const d0 = w._absDay(); for (let i = 0; i < 96 * 2 && w._absDay() - d0 < 2; i++) { w.paused = false; w.tick(); } w.paused = true; app.state = w.getState(); } catch (e) { out.err = e.message; }
      return out;
    });
    await page.waitForTimeout(600);
    ok(r.appear && 'b' in r.appear && 'cls' in r.appear, '每個村民的狀態都帶外觀資訊（年齡段、階層、國王、無家可歸）', r.appear);
    ok(r.bands === 'ccttaeeoo', '年齡段：12 歲以下小孩、13～17 青少年、60 以上老人、75 以上更老', r.bands);
    ok(r.kidCls <= 3, '小孩就算家裡是貴族也不穿披風', r.kidCls);
    ok(r.scale[0] < r.scale[1] && r.scale[1] < r.scale[2], '小孩最矮、青少年次之、大人正常', r.scale);
    ok(r.v.poor > r.v.base, '窮人衣服有補丁', r.v);
    ok(r.v.gent > r.v.base && r.v.noble > r.v.gent, '士紳有白領金扣、貴族再加披風與項鍊', r.v);
    ok(r.v.king > r.v.noble, '國王戴王冠、紅披風白毛邊', r.v);
    ok(r.oldGray, '75 歲以上頭髮全白', r.oldHair);
    ok(r.reuse && r.rebuild, '外觀沒變不重建，換了外觀（例如變窮、受封）才重建', { reuse: r.reuse, rebuild: r.rebuild });
    ok(r.lod && !r.lodErr, '人多時遠處的簡化網格也照樣建得出來', { lod: r.lod, e: r.lodErr });
    ok(!r.err, '跑幾天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
