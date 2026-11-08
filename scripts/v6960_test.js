// v6.96.0 村民長相多樣化:同職業 40 人長相多半不同、同名每次一樣、自訂髮型優先、頂點數控制;中英、桌機與 390px
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
      const out = {}; const w = app.world; const T = app.tileMap;
      const sigOf = (m) => { const parts = []; m.traverse(o => { if (o.isMesh && !o.userData.isLod && o.geometry?.attributes?.color) { const c = o.geometry.attributes.color; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; parts.push(o.geometry.attributes.position.count + ':' + [bb.max.x, bb.max.y, bb.max.z, bb.min.z].map(v => v.toFixed(2)).join(',') + ':' + [0, 500, 1500, 3000].map(i => i < c.count ? Math.round(c.getX(i) * 9) + '' + Math.round(c.getY(i) * 9) + Math.round(c.getZ(i) * 9) : '').join('')); } }); return parts.join('|') + '|' + m.scale.x.toFixed(3); };
      const mk = (id, name, job, gender, look) => { const m = T._agentMesh(id, { name, job: { key: job }, appear: { b: 'a', cls: 1, king: false, hl: false }, look: look || null }, { job, gender }); const s = sigOf(m); T._agentGroup.remove(m); T._disposeAgent(m); delete T._agentMeshes[id]; return s; };
      const SUR = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊'], GIV = ['偉', '美', '豪', '麗', '俊', '霞', '鋒', '婷', '杰', '芳', '明'];
      const names = []; for (let i = 0; i < 40; i++) names.push(SUR[i % 10] + GIV[(i * 7) % 11] + (i >= 20 ? '二' : ''));
      // 1) 同一職業、同性別的 40 個人:長相大多不同
      const sigs = names.map((n, i) => mk('var' + i, n, 'trader', i % 2 ? 'female' : 'male')); out.distinct = new Set(sigs).size;
      // 2) 同一個名字每次都長一樣(存讀檔、重新整理也不會變臉)
      out.stable = mk('st1', '陳偉', 'trader', 'male') === mk('st2', '陳偉', 'trader', 'male');
      // 3) 有自訂外觀(髮型)的照自訂的:不同名字、同樣自訂髮型時,頭髮那部分一致
      const a1 = mk('cu1', '甲', 'trader', 'male', { hair: 0, acc: 0 }), a2 = mk('cu2', '甲', 'trader', 'male', { hair: 5, acc: 0 }); out.custom = a1 !== a2;
      // 4) 頂點數仍在控制內
      let maxV = 0; for (let i = 0; i < 20; i++) { const m = T._agentMesh('vv' + i, { name: names[i], job: { key: 'trader' }, appear: { b: 'a', cls: 1, king: false, hl: false } }, { job: 'trader', gender: i % 2 ? 'female' : 'male' }); let v = 0; m.traverse(o => { if (o.isMesh && !o.userData.isLod) v += o.geometry.attributes.position.count; }); maxV = Math.max(maxV, v); T._agentGroup.remove(m); T._disposeAgent(m); delete T._agentMeshes['vv' + i]; }
      out.maxV = maxV;
      try { const d0 = w._absDay(); for (let i = 0; i < 96 && w._absDay() - d0 < 1; i++) { w.paused = false; w.tick(); } w.paused = true; } catch (e) { out.err = e.message; }
      return out;
    });
    await page.waitForTimeout(400);
    ok(r.distinct >= 32, '同職業的 40 個人，長相大多不一樣（髮型、五官、鬍子、配件、衣服、身材）', r.distinct);
    ok(r.stable, '同一個人每次長得一樣（不會重新整理就變臉）', r.stable);
    ok(r.custom, '有自訂髮型的照自訂', r.custom);
    ok(r.maxV < 6500, '多了細節，每人頂點仍控制在 6500 以內', r.maxV);
    ok(!r.err, '跑一天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
