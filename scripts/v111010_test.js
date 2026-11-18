// v11.10.1 讀檔後第一次結帳不再冒出「其他」（sim-wallet.js 的 loadSave）
//   錢包的「已開局」記號（W.started）以前沒存進檔：讀檔前剛出生（16 歲，還沒建錢包）的孩子，讀檔後第一次有人查錢包時拿到初始存款，
//   卻因為記號不見了而沒記進「移民帶來」，當天結帳整筆變成「其他」（重現腳本大約八次出現一次，19～34 銀幣）
//   A) 讀檔前剛出生、還沒有錢包的孩子：讀檔後第一次查錢包，全鎮的錢變化等於記進月報的流量，記在「移民帶來」
//   B) 跑到下一次每日結帳：那一天的「其他」是 0
//   D) 投票通過的最低工資跟著存檔（以前沒存，重新整理就不見了）
//   C) 對照：不存讀檔時同一件事也照樣記帳（行為跟讀檔前一樣）；剛開局（還沒有錢包）的讀檔照舊不記
// 用法：BASE=http://localhost:8194/ node scripts/v111010_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8181/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {}; app._fullAgentOn = () => false;
    const w = app.world; const r2 = (n) => Math.round(n * 100) / 100; const out = {};
    const fresh = () => { w.reset(); w.observerMode = true; ORIGIN.seed(w, 1, { seed: 9202 }); w.observerMode = true; w.fullAgentMode = false; };
    const tickTo = (h) => { for (let g = 0; g < 200 && w.clock.hour !== h; g++) { w.paused = false; w.tick(); } w.paused = true; };
    const toNextDay = () => { const d0 = w._absDay(); for (let g = 0; g < 200 && w._absDay() === d0; g++) { w.paused = false; w.tick(); } w.paused = true; };
    const saveLoad = () => { const data = JSON.parse(JSON.stringify(w.serialize())); const ok = w.loadSave(data); w.observerMode = true; w.fullAgentMode = false; return ok; };
    // 還沒記帳的錢：全鎮的錢減掉上次結帳時的總數與之後記進月報的流量
    const unrec = () => { const M = MONEY.S(w); return r2(MONEY.total(w) - M.lastT - M.pend); };
    const imm = () => (MONEY.S(w).days[w._absDay()] || {}).immigrant || 0;
    const parents = () => { const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18); return A.length >= 2 ? [A[0], A[1]] : null; };
    // 讓一對父母在這一刻生下孩子（跟遊戲裡出生走同一條路），出生後還沒有人查過他的錢包
    const birth = () => { const P = parents(); const before = new Set(Object.keys(w.agents)); w.lifecycle._birthChild(w, P[0], P[1]); return Object.keys(w.agents).find(id => !before.has(id)); };
    const firstLook = () => { const T0 = MONEY.total(w), P0 = MONEY.S(w).pend, I0 = imm(); WALLET.S(w); /* 每天結算與總覽都會把全鎮的錢包補一遍；讀檔後第一次查任何人的錢包也會走到這裡 */ return { leak: r2((MONEY.total(w) - T0) - (MONEY.S(w).pend - P0)), imm: r2(imm() - I0) }; };

    // ---------- A／B 讀檔前剛出生的孩子 ----------
    fresh(); for (let i = 0; i < 3; i++) toNextDay(); tickTo(6); WALLET.get(w, parents()[0]); // 開局的全鎮補錢包已經做過
    out.armed = typeof MONEY.S(w).lastT === 'number' && w.wallet?.started === true;
    { const id = birth(); out.kidAge = w.agents[id]?.age; out.kidNoWallet = typeof w.wallet.bal[id] !== 'number';
      const u0 = unrec(); out.loadOk = saveLoad(); out.kidStillNoWallet = typeof w.wallet.bal[id] !== 'number'; out.uLoad = r2(unrec() - u0);
      const f = firstLook(); out.A = f; out.kidBal = w.wallet.bal[id]; out.uAfterLook = r2(unrec() - u0);
      const d = w._absDay(); toNextDay(); out.B = { day: d + 1, other: (MONEY.S(w).days[d + 1] || {}).other || 0, closed: MONEY.S(w).lastClose === d + 1 }; }

    // ---------- C 對照 ----------
    fresh(); for (let i = 0; i < 3; i++) toNextDay(); tickTo(6); WALLET.get(w, parents()[0]);
    { const id = birth(); const f = firstLook(); out.C1 = { ...f, bal: w.wallet.bal[id] }; }
    // 剛開局、還沒有錢包時存讀檔：開局那次補錢包是起始的錢，照舊不記進月報
    fresh(); w.wallet = null; out.loadOk2 = saveLoad(); out.noWalletAfterLoad = w.wallet == null; WALLET.get(w, parents()[0]); out.C2 = { started: w.wallet?.started === true, imm: imm() };
    // D) 投票通過的最低工資跟著存檔（以前沒存，重新整理就不見了，要再提案一次）
    fresh(); for (let g = 0; g < 96; g++) { w.paused = false; w.tick(); } w.paused = true; WALLET.get(w, parents()[0]);
    { const d = w._absDay(); w.wallet.minWage = 4.73; w.wallet.minWageDay = d; const okL = saveLoad();
      out.D = { okL, minWage: w.wallet?.minWage, day: w.wallet?.minWageDay === d };
      w.wallet.minWage = 0; w.wallet.minWageDay = null; saveLoad(); out.D.off = (w.wallet?.minWage || 0) === 0 && w.wallet?.minWageDay == null; }
    return out;
  });
  console.log('A 讀檔前剛出生、還沒有錢包的孩子');
  ok(r.armed, '帳本與錢包都已開局', r);
  ok(r.kidAge === 16 && r.kidNoWallet && r.kidStillNoWallet, '孩子 16 歲出生，存讀檔時還沒有錢包', [r.kidAge, r.kidNoWallet, r.kidStillNoWallet]);
  ok(r.loadOk && Math.abs(r.uLoad) < 0.01, '存讀檔前後帳上一樣', [r.loadOk, r.uLoad]);
  ok(r.kidBal > 0, '讀檔後第一次查錢包，孩子拿到初始存款', r.kidBal);
  ok(Math.abs(r.A.leak) < 0.01, '全鎮的錢變化等於記進月報的流量（沒有漏記）', r.A);
  ok(Math.abs(r.A.imm - r.kidBal) < 0.01, '初始存款記在「移民帶來」', [r.A.imm, r.kidBal]);
  ok(Math.abs(r.uAfterLook) < 0.01, '還沒記帳的錢仍是 0', r.uAfterLook);
  console.log('B 下一次每日結帳');
  ok(r.B.closed && Math.abs(r.B.other) < 0.01, `第 ${r.B.day} 天結帳「其他」是 0`, r.B);
  console.log('C 對照');
  ok(Math.abs(r.C1.leak) < 0.01 && r.C1.bal > 0 && Math.abs(r.C1.imm - r.C1.bal) < 0.01, '不存讀檔時同樣記在「移民帶來」', r.C1);
  ok(r.loadOk2 && r.noWalletAfterLoad && r.C2.started && Math.abs(r.C2.imm) < 0.01, '還沒有錢包的存檔讀回來：開局補錢包照舊不記進月報', r);
  console.log('D 最低工資跟著存檔');
  ok(r.D.okL && r.D.minWage === 4.73 && r.D.day, '投票通過的最低工資與生效日，存讀檔後還在', r.D);
  ok(r.D.off, '沒有最低工資的鎮，存讀檔後照樣沒有', r.D);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} 通過，${fail} 失敗`); await browser.close(); process.exit(fail ? 1 : 0);
})();
