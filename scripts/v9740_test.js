// v9.7.4 遺產稅、繼承人只算配偶子女、對面那家也能繼承、繼承後超過反壟斷上限要賣
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
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); }
    const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const T = () => Math.round(MONEY.total(w) * 100) / 100;
    const P = all().filter(a => (a.age ?? 30) >= 18); for (const a of all()) WALLET.get(w, a);
    const rel = (a, b, st) => { a.relationships.getOrCreate(b.agentId, b.name).status = st; b.relationships.getOrCreate(a.agentId, a.name).status = st; };
    const kill = (a) => w.lifecycle._killNpc(w, a, 'test');
    const out = {}; const M = MARKET.S(w);
    // 1. 老闆:有配偶、成年子女、交往對象;現金 1000、名下一家店
    const [boss, wife, kid, gf] = P;
    for (const a of [wife, kid, gf]) for (const o of [boss, wife, kid, gf]) if (a !== o) { const r = a.relationships.relationships[o.agentId]; if (r) r.status = 'friend'; }
    for (const a of all()) { const r = a.relationships.relationships[boss.agentId]; if (r && ['married', 'dating'].includes(r.status)) r.status = 'friend'; if ((a._parentNames || []).includes(boss.name)) a._parentNames = []; }
    rel(boss, wife, 'married'); rel(boss, gf, 'dating'); kid._parentNames = [boss.name]; kid.age = 25; wife.age = 50;
    WALLET.take(w, boss, WALLET.get(w, boss)); WALLET.add(w, boss, 1000); if (w.bank?.dep) delete w.bank.dep[boss.agentId]; if (w.bank?.loans) delete w.bank.loans[boss.agentId]; /* 只算錢包 1000 */ M.owners.kitchen = boss.agentId; if (M.shares) delete M.shares.kitchen; /* 隨機的鎮裡這家可能已經有別的股東：直接指定老闆卻沒清掉舊股份的話，老闆不在股東名單裡，過世後「股份最多的人當家」會把店判給舊股東，配偶就接不到（約三成機率） */ delete M.rival.kitchen;
    const wv = MARKET.firmsOf(w, boss.agentId).reduce((x, f) => x + MARKET.value(w, f.k) * (f.rival ? 0.6 : 1), 0) + ESTATE.ownsOf(w, boss.agentId).reduce((x, u) => x + ESTATE.valueOf(w, u), 0); /* 名下所有產業＋房子 */ const et0 = w.wallet.estateTax || 0, wife0 = WALLET.get(w, wife), kid0 = WALLET.get(w, kid), gf0 = WALLET.get(w, gf), t0 = T();
    kill(boss);
    const tax = Math.round(((w.wallet.estateTax || 0) - et0) * 100) / 100;
    out.tax = { tax, firmValue: Math.round(wv),  expect: Math.round(Math.max(0, 1000 + wv - 200 * (WALLET.wageIdx() || 1)) * 0.3), wife: Math.round(WALLET.get(w, wife) - wife0), kid: Math.round(WALLET.get(w, kid) - kid0), gf: Math.round(WALLET.get(w, gf) - gf0), owner: M.owners.kitchen === wife.agentId, total: Math.round((T() - t0) * 100) / 100, log: w.messageLog.slice(-12).some(m => /遺產稅/.test(m.k || '')) };
    // 2. 對面那家的老闆過世:成年子女接手
    const [o2, son] = P.slice(5, 7); son._parentNames = [o2.name]; son.age = 30;
    M.owners.forge = P[8].agentId; M.rival = M.rival || {}; M.rival.forge = { fid: 'Fx', owner: o2.agentId, since: 0, price: 0.9, pay: 1.1, emp: {}, rev: 0, cost: 0, hist: [], loss: 0 };
    const heirs2 = MARKET.heirsOf(w, o2).map(a => a.agentId); kill(o2); out.rival = { owner: !!M.rival.forge && heirs2.includes(M.rival.forge.owner), log: w.messageLog.slice(-12).some(m => /接手了/.test(m.k || '')) };
    // 3. 沒有家人:對面那家關門
    const o3 = P[9]; for (const a of all()) { const r = a.relationships.relationships[o3.agentId]; if (r && r.status === 'married') r.status = 'friend'; if ((a._parentNames || []).includes(o3.name)) a._parentNames = []; }
    M.owners.farm = P[10].agentId; M.rival.farm = { fid: 'Fy', owner: o3.agentId, since: 0, price: 0.9, pay: 1.1, emp: {}, rev: 0, cost: 0, hist: [], loss: 0 };
    kill(o3); out.closed = !M.rival.farm;
    // 4. 繼承後超過反壟斷上限:有提醒,每週檢查會賣掉多的
    const [o4, heir4] = P.slice(11, 13); for (const a of all()) { const r = a.relationships.relationships[o4.agentId]; if (r && r.status === 'married') r.status = 'friend'; if ((a._parentNames || []).includes(o4.name)) a._parentNames = []; } /* 只留一個繼承人(隨機的鎮裡他可能已婚) */ heir4._parentNames = [o4.name]; heir4.age = 30; w.cycle = w.cycle || {}; w.cycle.law = true; w.cycle.cap = 2;
    M.owners.textile = heir4.agentId; M.owners.timber = heir4.agentId; M.owners.mine = o4.agentId;
    kill(o4); out.cap = { n: MARKET.firmsOf(w, heir4.agentId).length, log: w.messageLog.slice(-12).some(m => /反壟斷法的上限/.test(m.k || '')) };
    return out;
  });
  ok(r.tax.tax > 0 && Math.abs(r.tax.tax - r.tax.expect) <= 1 && r.tax.total === 0 && r.tax.log, '遺產稅：（現金＋產業）超過免稅額的 30% 繳進公庫，錢一分不少', r.tax);
  ok(r.tax.gf === 0 && r.tax.wife > 0 && r.tax.kid > 0 && r.tax.owner, '交往對象不繼承；配偶接店，配偶和子女平分剩下的錢', r.tax);
  ok(r.rival.owner && r.rival.log, '對面那家的老闆過世，由子女接手', r.rival);
  ok(r.closed, '沒有家人就關門', r.closed);
  ok(r.cap.n > 2 && r.cap.log, '繼承後超過反壟斷上限會提醒（之後每週依法賣掉多的）', r.cap);
  ok(errs.length === 0, '沒有錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
