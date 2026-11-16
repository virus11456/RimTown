// v10.4.1 罷免連署只算真的對首長不滿的人
// 線上唯讀檢查發現：首長被揭發一次醜聞（2 分），不認識他的人也全被算成願意連署（115 人的鎮顯示 100 人，實際討厭他的只有 21 人），投票也幾乎全體贊成。
//   1) 沒交情的人：不管有沒有醜聞都不算連署
//   2) 醜聞只會降低門檻：沒醜聞要好感低於 -20，一樁（2 分）低於 -12.5，纏身（3 分以上，算滿）低於 -8.75
//   3) 投票：不認識首長的人贊成罷免的機率，沒醜聞約三成、一樁約五成、纏身約六成；跟首長交情好的人不會贊成
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`);
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; w.clock.year = 6; const out = {}; const E = w.election;
    const L = E._officeHolder(w); const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && a.agentId !== L.agentId && a.currentLocation !== 'exploration');
    if (!w.power) w.power = {}; const setSc = (n) => { w.power.scandal = n ? { [L.agentId]: n } : {}; };
    const setAff = (list, v) => { for (const a of list) a.relationships.getOrCreate(L.agentId, L.name).affinity = v; };
    const sign = () => REPEAL.recallInfo(w, null).signers; const K = A.slice(0, 5), rest = A.slice(5);
    const reset = () => setAff(A, 0);
    // 1) 沒交情
    reset(); const s = {}; for (const n of [0, 2, 3, 6]) { setSc(n); s['sc' + n] = sign(); } out.strangers = s; out.N = A.length; out.need = REPEAL.recallInfo(w, null).need;
    // 2) 門檻
    const at = (sc, aff) => { reset(); setSc(sc); setAff(K, aff); return sign(); };
    out.th = { n0_15: at(0, -15), n0_19: at(0, -19), n0_21: at(0, -21), n2_12: at(2, -12), n2_13: at(2, -13), n2_10: at(2, -10), n3_8: at(3, -8), n3_9: at(3, -9), n6_8: at(6, -8), n6_9: at(6, -9), n19_13: at(1.9, -13), n19_12: at(1.9, -12) };
    // 3) 投票
    const rate = (sc, aff, n = 800) => { reset(); setSc(sc); setAff([K[0]], aff); let f = 0; for (let i = 0; i < n; i++) if (REPEAL.recallVote(w, { refKey: L.agentId }, K[0]).v === 'for') f++; return Math.round(f / n * 100) / 100; };
    out.vote = { s0: rate(0, 0), s2: rate(2, 0), s6: rate(6, 0), friend6: rate(6, 40), foe0: rate(0, -40), self: REPEAL.recallVote(w, { refKey: L.agentId }, L).v };
    reset(); setAff([K[0]], -60); /* 一定投贊成，才看得到贊成的理由 */ setSc(2); out.why = [REPEAL.recallVote(w, { refKey: L.agentId }, K[0]).why, (() => { setSc(0); return REPEAL.recallVote(w, { refKey: L.agentId }, K[0]).why; })()];
    // 4) 現況那樣的鎮：一樁醜聞（1.9 分）、兩成的人真的討厭他、其餘沒意見 → 連署不到四分之一，提不成
    reset(); setSc(1.9); const haters = A.slice(0, Math.floor(A.length * 0.2)); setAff(haters, -30); E.lastElectionDay = w._absDay() - 40; const I = REPEAL.recallInfo(w, rest[rest.length - 1]);
    out.town = { signers: I.signers, haters: haters.length, need: I.need, ok: I.ok, why: I.why, ui: REPEAL.view(w).recall ? JSON.stringify(REPEAL.view(w).recall).slice(0, 300) : null };
    // 真的夠多人討厭（三成）→ 成案
    setAff(A.slice(0, Math.ceil(A.length * 0.3)), -30); const I2 = REPEAL.recallInfo(w, rest[rest.length - 1]); out.town2 = { signers: I2.signers, need: I2.need, ok: I2.ok, why: I2.why };
    out.ver = RIMTOWN_APP_VERSION; return out;
  });
  const S = r.strangers;
  ok(S.sc0 === 0 && S.sc2 === 0 && S.sc3 === 0 && S.sc6 === 0, '跟首長沒交情的人，不管有沒有醜聞都不算連署', { S, N: r.N });
  const T = r.th;
  ok(T.n0_15 === 0 && T.n0_19 === 0 && T.n0_21 === 5, '沒醜聞：好感低於 -20 才算', T);
  ok(T.n2_10 === 0 && T.n2_12 === 0 && T.n2_13 === 5 && T.n19_12 === 0 && T.n19_13 === 5, '一樁醜聞（2 分上下）：好感低於 -12.5 才算', T);
  ok(T.n3_8 === 0 && T.n3_9 === 5 && T.n6_8 === 0 && T.n6_9 === 5, '醜聞纏身：好感低於 -8.75 才算，3 分以上不再往下降', T);
  const V = r.vote;
  ok(V.s0 > 0.2 && V.s0 < 0.4 && V.s2 > 0.4 && V.s2 < 0.6 && V.s6 > 0.5 && V.s6 < 0.7, '不認識首長的人投贊成的機率：沒醜聞約三成、一樁約五成、纏身約六成', V);
  ok(V.friend6 === 0 && V.foe0 === 1 && V.self === 'against', '交情好的人不贊成、真的討厭的人贊成、首長自己反對', V);
  ok(r.why[0] === 'recall_scandal' && r.why[1] === 'recall_bad', '贊成的理由：有醜聞寫醜聞，沒醜聞寫做得不好', r.why);
  ok(r.town.signers === r.town.haters && r.town.signers < r.town.need && !r.town.ok && r.town.why === 'sign', '一樁醜聞、兩成的人討厭他：連署只算那兩成，不到四分之一，提不成', r.town);
  ok(r.town2.ok && r.town2.signers >= r.town2.need, '三成的人真的討厭他：連署夠了，可以提', r.town2);
  ok(r.ver === '10.4.1', '版本 10.4.1', r.ver);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await run(browser, 'desktop', 'zh'); await run(browser, 'mobile', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
