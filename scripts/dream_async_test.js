// 等 AI 回覆的時候村民過世或搬走:原諒的理由、禱詞不會丟錯(以前長局偶爾出現 Cannot read properties of undefined (reading 'name'))
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true;
    for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); }
    // 假的 AI:回覆由測試決定什麼時候到
    const ce = w.conversationEngine; let reply = null; w.fullAgentMode = true; ce.fullAgentOk = () => true; ce._askJson = () => new Promise(res => { reply = res; });
    const P = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18); const d = w._absDay(); const out = {};
    const run = async (fn, gone) => { reply = null; let err = null; const p = fn().catch(e => { err = e.message; }); for (let i = 0; i < 20 && !reply; i++) await new Promise(r => setTimeout(r, 0)); const asked = !!reply; w.removeAgent(gone.agentId); reply?.(['我想好了', '保佑大家', '再一句']); await p; return { asked, err }; };
    // 1. 原諒的理由:道歉的人和被道歉的人都在,AI 回覆前被道歉的人搬走了
    { const D = DARK.S(w); D.wrongs.push({ by: P[0].agentId, to: P[1].agentId, w: 5, day: d, last: d, tries: 1, forgiven: true });
      D.wrongs.push({ by: P[2].agentId, to: P[3].agentId, w: 5, day: d, last: d, tries: 1, forgiven: false });
      out.forgive = await run(() => DREAM.forgiveness(w, d), P[1]);
      const W = D.wrongs.filter(x => x.last === d); out.goneWhy = !!W.find(x => x.to === P[1].agentId)?.why; out.stayWhy = !!W.find(x => x.to === P[3].agentId)?.why; }
    // 2. 禱詞:AI 回覆前第一個祈禱的人過世了,其他人的禱詞照樣寫進去
    { const F = w.faith; const R = F?.rels?.[0]; out.prayer = null;
      if (R) { F.prayers = F.prayers || {}; for (const a of [P[4], P[5]]) F.prayers[a.agentId] = { day: d, rel: R.id, wish: '豐收' };
        out.prayer = await run(() => DREAM.prayers(w, d), P[4]); out.otherText = !!F.prayers[P[5].agentId]?.text; } }
    return out;
  });
  console.log('等 AI 回覆時村民不在了');
  ok(r.forgive.asked && !r.forgive.err, '原諒的理由:被道歉的人搬走,不會丟錯', r.forgive);
  ok(!r.goneWhy && r.stayWhy, '原諒的理由:不在的人略過,還在的人照樣寫進去', r);
  ok(r.prayer && r.prayer.asked && !r.prayer.err, '禱詞:祈禱的人過世,不會丟錯', r.prayer);
  ok(r.otherText, '禱詞:其他人的禱詞照樣寫進去', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 5));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
