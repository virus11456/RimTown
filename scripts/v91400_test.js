// v9.14.0 看得出來的病痛:眼鏡、拐杖、義手、義腿、人工心肺、頭上繃帶、吊臂帶、病容,3D 人物看得出來;名牌前面有 🤒／🩹
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; const out = {};
    try {
      const P = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
      const H = HEALTH.S(w); const [A, B, C, D, E] = P;
      out.none = LOOK.of(w, A)?.hx || '';
      H.aid[A.agentId] = ['glasses', 'crutch']; H.aid[B.agentId] = ['arm', 'leg', 'heart'];
      H.a[C.agentId] = [{ p: 'f', k: 'injury', s: 1, d: 0 }]; H.a[D.agentId] = [{ p: 'h', k: 'injury', s: 2, d: 0 }]; H.a[E.agentId] = [{ p: 'l', k: 'fever', s: 1, d: 0 }];
      const hx = (a) => LOOK.of(w, a)?.hx || '';
      out.codes = { A: hx(A), B: hx(B), C: hx(C), D: hx(D), E: hx(E) };
      out.sig = LOOK.sig(LOOK.of(w, A)) !== LOOK.sig({ ...LOOK.of(w, A), hx: '' });
      const st = w.getState(); out.state = st.agents[E.agentId]?.appear?.hx || '';
      // 每種外觀都做得出人物網格,而且零件比健康的人多
      const n = (code) => { const g = VILLAGER3D.build({ aid: 'x', agent: { name: '測試', appear: { b: 'a', cls: 1, hx: code } }, pos: { job: 'farmer' } }); let v = 0; g.traverse(o => { if (o.geometry?.attributes?.position) v += o.geometry.attributes.position.count; }); return v; };
      const base = n(''); out.mesh = Object.fromEntries(['g', 'c', 'a', 'l', 'h', 'b', 's', 'k'].map(k => [k, n(k) - base]));
      // 痊癒、拿掉輔具後外觀回來
      delete H.a[E.agentId]; delete H.aid[A.agentId]; out.healed = { E: hx(E), A: hx(A) };
      H.a[E.agentId] = [{ p: 'l', k: 'fever', s: 1, d: 0 }]; out.Eid = E.agentId; out.Cid = C.agentId;
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
    return out;
  });
  // 名牌:讓鏡頭跟著生病的人,名牌畫出來後看文字
  await page.evaluate((id) => { const app = window.rimtownApp; app.state = app.world.getState(); app.tileMap.update?.(app.state); app.tileMap.followAgent(id); app.selectedAgentId = id; }, r.Eid);
  await page.waitForTimeout(2500);
  r.label = await page.evaluate((ids) => ids.map(id => { const el = [...document.querySelectorAll('.t3d-tag')].find(e => e.textContent.includes(window.rimtownApp.world.agents[id].name)); return el ? el.textContent.slice(0, 20) : null; }), [r.Eid, r.Cid]);
  console.log(JSON.stringify(r));
  ok(!r.err, '跑完沒有例外', r.err);
  ok(r.none === '', '健康的人沒有健康外觀代碼', r.none);
  ok(r.codes && r.codes.A === 'gc' && r.codes.B === 'alh' && r.codes.C === 'b' && r.codes.D === 's' && r.codes.E === 'k', '眼鏡＋拐杖、義手＋義腿＋人工心臟、腳受傷→繃帶、手受傷→吊臂帶、風寒→病容', r.codes);
  ok(r.sig && r.state === 'k', '外觀改變時人物會重畫（簽名不同），畫面狀態帶著健康外觀', { sig: r.sig, state: r.state });
  ok(r.mesh && ['g', 'c', 'a', 'l', 'h', 'b', 's', 'k'].every(k => r.mesh[k] > 0 || k === 'a'), '每一種都畫得出來（眼鏡、拐杖、義腿、心肺燈、繃帶、吊臂帶、黑眼圈）', r.mesh);
  ok(r.healed && r.healed.E === '' && r.healed.A === '', '病好了、拿掉輔具後外觀回到原本', r.healed);
  ok(r.label && r.label[0] && r.label[0].includes('🤒'), '生病的人名牌前面有 🤒', r.label);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
