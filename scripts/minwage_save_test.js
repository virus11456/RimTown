// 回歸：表決通過的最低工資，存檔再讀檔之後還在
//   以前 World.prototype.serialize（sim-wallet.js）存錢包時漏了 minWage、minWageDay 兩欄：
//   讀檔之後最低工資變回沒有，發薪照市價走，「可以廢除的規定」裡也找不到這一條（sim-repeal.js 以為從來沒通過）。
//   檢查：1) 提案照正常流程通過（ProposalSystem._execute）→ 2) serialize → JSON 來回 → 新的 World loadSave →
//         3) 兩欄都在、廢除清單看得到、公庫發薪真的有照下限發 → 4) 廢除以後存讀檔也還是廢除 → 5) 舊存檔（沒有這兩欄）照常讀得進來
// 用法：BASE=http://localhost:8126/ node scripts/minwage_save_test.js（需要本機伺服器服務 chrome-extension/）
// /api/** 全部攔下來回假資料，不會真的呼叫 AI。
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  let apiHits = 0;
  await page.route('**/api/**', r => { apiHits++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);

  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 91 }); w.observerMode = true; w.fullAgentMode = false; const out = {};
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    tick1(); // 先跑過一天，讓錢包、物價這些每天結算的東西都就位
    const npcsOf = (x) => Object.values(x.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const r2 = (n) => Math.round(n * 100) / 100;
    const W = WALLET.S(w); const P = w.proposals; const day = w._absDay();
    W.tax = 0.6; W.minWage = 0; W.minWageDay = null; // 稅拉高：扣完稅的工資低於下限的人才會多，下限有沒有生效一看就知道
    out.before = { minWage: W.minWage, lawOn: REPEAL.LAWS.minwage.on(w) };

    // 1) 提案照正常流程通過：先拿遊戲自己產生的那一案，這一局剛好沒人會提的話，就用同樣的內容自己成案
    P.cooldown = {}; P.items = (P.items || []).filter(q => q.kind !== 'minwage');
    let cand = null; try { cand = (P._candidates(w, day) || []).find(c => c.kind === 'minwage') || null; } catch (e) {}
    out.fromGame = !!cand;
    if (!cand) cand = { kind: 'minwage', key: 'minwage', make: () => ({ kind: 'minwage', key: 'minwage', tk: '訂定最低工資', tp: {}, dk: '', dp: {}, cost: {}, effects: {}, category: 'welfare' }) };
    const proposer = npcsOf(w).find(a => (a.age ?? 30) >= 18);
    const p = P._createWith(w, day, cand, proposer); p.status = 'approved'; P._execute(w, p, day);
    out.passed = { status: p.status, minWage: W.minWage, minWageDay: W.minWageDay, day, lawOn: REPEAL.LAWS.minwage.on(w) };

    // 發一次公庫薪水，看「照市價扣完稅不到下限」的人實際領到多少（公庫先放夠錢，免得發不出來）
    const payLow = (x) => {
      const Wx = x.wallet; const all = npcsOf(x); const PR = (typeof FISCAL !== 'undefined') ? FISCAL.pubRate(x) : 1; const floor = out.passed.minWage;
      x.stockpile.add('silver', 100000, x.tickCount, 'test', 'test');
      const b0 = {}; for (const a of all) b0[a.agentId] = WALLET.get(x, a);
      WALLET.payday(x, Wx, all);
      const got = []; for (const a of all) { const d = r2(WALLET.get(x, a) - b0[a.agentId]); if (d > 0 && WALLET.wageOf(a) * PR * (1 - Wx.tax) < floor) got.push(d); }
      return { n: got.length, min: got.length ? Math.min(...got) : null, max: got.length ? Math.max(...got) : null };
    };

    // 2) 存檔 → JSON 來回 → 讀進一個全新的 World
    const sv = JSON.parse(JSON.stringify(w.serialize()));
    out.saved = { minWage: sv.wallet?.minWage, minWageDay: sv.wallet?.minWageDay, keys: Object.keys(sv.wallet || {}) };
    const w2 = new World(); out.loadRet = !!w2.loadSave(JSON.parse(JSON.stringify(sv)));
    let view = null; try { view = REPEAL.view(w2); } catch (e) { out.viewErr = e.message; }
    out.loaded = { minWage: w2.wallet?.minWage, minWageDay: w2.wallet?.minWageDay, tax: w2.wallet?.tax, bal: Object.keys(w2.wallet?.bal || {}).length, bal0: Object.keys(W.bal).length,
      lawOn: REPEAL.LAWS.minwage.on(w2), since: REPEAL.LAWS.minwage.since(w2), inLive: !!view?.live?.some(x => x.id === 'minwage'), inDone: !!view?.done?.some(x => x.id === 'minwage') };
    // 3) 讀檔後公庫發薪：低薪的人領到的就是下限
    out.payOn = payLow(w2);

    // 4) 表決廢除（跟 sim-repeal.js 的 off 一樣）→ 存讀檔 → 還是廢除，發薪照市價
    REPEAL.LAWS.minwage.off(w);
    const sv3 = JSON.parse(JSON.stringify(w.serialize())); const w3 = new World(); w3.loadSave(sv3);
    out.repealed = { minWage: w3.wallet?.minWage, minWageDay: w3.wallet?.minWageDay ?? null, lawOn: REPEAL.LAWS.minwage.on(w3) };
    out.payOff = payLow(w3);

    // 5) 舊存檔：錢包裡沒有這兩欄 → 照常讀得進來，當作沒通過過
    const old = JSON.parse(JSON.stringify(sv)); delete old.wallet.minWage; delete old.wallet.minWageDay;
    const w4 = new World(); let oldErr = null, oldRet = false; try { oldRet = !!w4.loadSave(old); } catch (e) { oldErr = e.message; }
    const a4 = npcsOf(w4).find(a => WALLET.WAGE[a.job?.key]); let net4 = null; try { net4 = a4 ? WALLET.netOf(w4.wallet, a4) : null; } catch (e) { oldErr = e.message; }
    out.old = { ret: oldRet, err: oldErr, minWage: w4.wallet?.minWage || 0, lawOn: REPEAL.LAWS.minwage.on(w4), tax: w4.wallet?.tax, bal: Object.keys(w4.wallet?.bal || {}).length, net: net4, market: a4 ? WALLET.wageOf(a4) * (1 - w4.wallet.tax) : null };
    let pay4 = null; try { pay4 = payLow(w4); } catch (e) { out.old.err = e.message; } out.old.pay = pay4;
    // 更舊的存檔：完全沒有錢包 → 跟以前一樣是 null，不出錯
    const older = JSON.parse(JSON.stringify(sv)); delete older.wallet; const w5 = new World(); let olderErr = null; try { w5.loadSave(older); } catch (e) { olderErr = e.message; }
    out.older = { err: olderErr, wallet: w5.wallet ?? null };
    return out;
  });

  const f = r.passed.minWage;
  ok(!(r.before.minWage > 0) && !r.before.lawOn, '一開始沒有最低工資', r.before);
  ok(r.passed.status !== 'failed' && f > 0 && r.passed.minWageDay === r.passed.day && r.passed.lawOn, `最低工資提案通過後生效（下限 ${f}；${r.fromGame ? '遊戲自己產生的提案' : '自己成案'}）`, r.passed);
  ok(r.saved.minWage === f && r.saved.minWageDay === r.passed.day, '存檔的錢包裡有 minWage、minWageDay', r.saved);
  ok(r.loadRet && r.loaded.minWage === f, '讀檔之後最低工資還在', r.loaded);
  ok(r.loaded.minWageDay === r.passed.day && r.loaded.since === r.passed.day, '讀檔之後通過的那一天也還在', r.loaded);
  ok(r.loaded.lawOn && r.loaded.inLive && !r.loaded.inDone && !r.viewErr, '讀檔之後「可以廢除的規定」裡看得到最低工資', { loaded: r.loaded, err: r.viewErr });
  ok(r.loaded.tax === 0.6 && r.loaded.bal === r.loaded.bal0 && r.loaded.bal > 0, '錢包其他欄位（稅率、每個人的錢）照舊', r.loaded);
  ok(r.payOn.n > 0 && r.payOn.min >= f - 0.011, `讀檔之後公庫發薪：低薪的 ${r.payOn.n} 人至少領到下限 ${f}`, r.payOn);
  ok(!(r.repealed.minWage > 0) && r.repealed.minWageDay === null && !r.repealed.lawOn, '表決廢除以後存讀檔，還是廢除的', r.repealed);
  ok(r.payOff.n > 0 && r.payOff.max < f, '廢除以後公庫發薪照市價（低薪的人領不到下限）', r.payOff);
  ok(r.old.ret && !r.old.err && r.old.minWage === 0 && !r.old.lawOn && r.old.tax === 0.6 && r.old.bal === r.loaded.bal0, '舊存檔（錢包沒有這兩欄）照常讀得進來，當作沒通過過', r.old);
  ok(Number.isFinite(r.old.net) && Math.abs(r.old.net - r.old.market) < 1e-9 && r.old.pay && r.old.pay.n > 0 && r.old.pay.max < f, '舊存檔讀進來以後，工資照市價算、發薪不出錯', r.old);
  ok(!r.older.err && r.older.wallet === null, '更舊的存檔（完全沒有錢包）也照常讀得進來', r.older);
  ok(apiHits > 0, `/api/** 都被攔下來了（${apiHits} 次），沒有真的連出去`, apiHits);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close(); await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
