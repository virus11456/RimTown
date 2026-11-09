// v9.7.0 同業競爭、管理成本、反壟斷政治
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(lang) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  if (lang === 'en') await page.evaluate(() => new Promise(r => I18N.ensureDict(r)));
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; const out = {}; const r0 = Math.random;
    for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); }
    const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const P = all().filter(a => (a.age ?? 30) >= 18); const M = COMPETE.S(w); const k = 'kitchen'; const d = w._absDay();
    const T = () => Math.round(MONEY.total(w) * 100) / 100;
    // 準備:P0 是食堂老闆,P1~P5 是廚師,P6 很有錢又貪心
    const boss = P[0], cooks = P.slice(1, 6), ent = P[6]; const jobs0 = new Map(P.map(a => [a, a.job]));
    M.owners[k] = boss.agentId; M.pay[k] = 1; delete M.rival[k]; for (const c of cooks) c.job = new Job('cook'); if (ent.job?.key === 'cook') ent.job = new Job('farmer');
    ent.personality.traits = ['greedy', 'hardworking']; WALLET.add(w, ent, 500); ent.relationships.getOrCreate(boss.agentId, boss.name).affinity = 0; // 交情普通(好朋友不太會跟你搶生意) WALLET.add(w, boss, 200);
    M.hist[k] = Array.from({ length: 7 }, () => [120, 10]); M.good[k] = 1; delete w.cycle?.cap;
    // 1. 有人在對面開店
    { const t0 = T(), b0 = WALLET.get(w, ent); Math.random = () => 0; try { COMPETE.entry(w, all(), d); } finally { Math.random = r0; }
      const R = MARKET.rivalOf(w, k); out.entry = { open: !!R, owner: R?.owner === ent.agentId, emp: R ? Object.keys(R.emp).length : 0, paid: Math.round(b0 - WALLET.get(w, ent)), total: Math.round((T() - t0) * 100) / 100, price: R?.price, pay: R?.pay }; }
    // 2. 兩家分客人,打折省下的錢回到村民手上,總數不變
    { const R = MARKET.rivalOf(w, k); const bi = WALLET.get(w, boss), br = WALLET.get(w, ent), t0 = T(), sv0 = M.saved || 0; MARKET.sell(w, k, 100, 'test');
      out.split = { share: MARKET.shareOf(w, k), inc: Math.round((WALLET.get(w, boss) - bi) * 100) / 100, riv: Math.round((WALLET.get(w, ent) - br) * 100) / 100, rebate: Math.round(((M.saved || 0) - sv0) * 100) / 100, total: Math.round((T() - t0) * 100) / 100 }; }
    // 3. 對手店的工人由對手老闆發薪
    { const R = MARKET.rivalOf(w, k); const e1 = Object.keys(R.emp)[0]; const ea = w.agents[e1]; const bi = WALLET.get(w, boss), br = WALLET.get(w, ent), be = WALLET.get(w, ea); MARKET.payroll(w, WALLET.S(w), all());
      out.pay = { riv: Math.round((br - WALLET.get(w, ent)) * 100) / 100, emp: Math.round((WALLET.get(w, ea) - be) * 100) / 100, rcost: R.cost }; }
    // 4. 搶工人:對面工資高兩成,工人跳槽;被挖的老闆有賺錢就加薪
    { const R = MARKET.rivalOf(w, k); R.pay = 1.3; M.pay[k] = 1; const n0 = Object.keys(R.emp).length; R.hist = Array.from({ length: 7 }, () => [60, 10]); Math.random = () => 0; try { COMPETE.weekly(w, all(), d); } finally { Math.random = r0; }
      out.poach = { before: n0, after: Object.keys(MARKET.rivalOf(w, k)?.emp || {}).length, incPay: M.pay[k], incPrice: M.price[k] }; }
    // 5. 對手連虧三週又沒錢就收攤,工人回去
    { const R = MARKET.rivalOf(w, k); R.loss = 2; R.hist = Array.from({ length: 7 }, () => [0, 30]); WALLET.take(w, ent, Math.max(0, WALLET.get(w, ent) - 10)); M.hist[k] = Array.from({ length: 7 }, () => [80, 10]);
      COMPETE.weekly(w, all(), d); out.close = { gone: !MARKET.rivalOf(w, k), log: w.messageLog.slice(-8).some(m => /收攤/.test(m.k || '')) }; }
    // 6. 原本那家撐不住:被對手低價併購
    { WALLET.add(w, ent, 600); M.rival[k] = { fid: 'Ft', owner: ent.agentId, since: d, price: 0.9, pay: 1.1, emp: { [cooks[0].agentId]: d }, rev: 0, cost: 0, hist: Array.from({ length: 7 }, () => [80, 10]), loss: 0 };
      M.hist[k] = Array.from({ length: 7 }, () => [0, 40]); M.loss[k] = 2; WALLET.take(w, boss, Math.max(0, WALLET.get(w, boss) - 5)); const t0 = T();
      COMPETE.weekly(w, all(), d); out.merge = { owner: M.owners[k] === ent.agentId, noRival: !M.rival[k], total: Math.round((T() - t0) * 100) / 100 }; }
    // 7. 管理成本:名下第三家起要請掌櫃,服務變差
    { M.owners.farm = ent.agentId; M.owners.textile = ent.agentId; for (const s of ['farm', 'textile']) M.hist[s] = Array.from({ length: 7 }, () => [10, 1]);
      const f = P.slice(7, 10); f.forEach(a => { a.job = new Job('tailor'); }); const q3 = MARKET.quality(w, 'textile', ent.agentId, 3);
      const b0 = WALLET.get(w, ent), t0 = T(); M.compDay = -1; COMPETE.manage(w, all(), d + 1); const mg = Object.entries(M.mgr);
      out.mgr = { n: MARKET.firmsOf(w, ent.agentId).length, hired: mg.length, fee: Math.round((b0 - WALLET.get(w, ent)) * 100) / 100, total: Math.round((T() - t0) * 100) / 100, q3, q2: MARKET.quality(w, 'textile', boss.agentId, 3) }; }
    // 8. 反壟斷政治:有法之後提案收緊、通過後超過的要賣掉、被針對的大老闆遊說
    { w.cycle = w.cycle || {}; w.cycle.law = true; delete w.cycle.cap; w.cycle.lastCap = -999; WALLET.add(w, ent, 3000);
      w.proposals.items = (w.proposals.items || []).filter(p => !['antitrust', 'antitrust_cap'].includes(p.kind));
      const p = COMPETE.capProposal(w, d); out.capProp = p ? { kind: p.kind, ref: p.refKey === ent.agentId } : null;
      if (p) { p.status = 'open'; const t0 = T(); const PW = POWER.S(w); Math.random = () => 0.6; try { COMPETE.lobby(w, d + 3); } finally { Math.random = r0; }
        out.lobby = { inf: Object.values(PW.inf || {}).filter(m => m[ent.agentId]).length, total: Math.round((T() - t0) * 100) / 100 }; }
      out.canBuyBefore = MARKET.canBuy(w, ent.agentId); COMPETE.enactCap(w, p || {}); out.cap = w.cycle.cap; out.canBuyAfter = MARKET.canBuy(w, ent.agentId);
      const n0 = MARKET.firmsOf(w, ent.agentId).length; const t0 = T(); COMPETE.divest(w, all(), d); out.divest = { before: n0, after: MARKET.firmsOf(w, ent.agentId).length, total: Math.round((T() - t0) * 100) / 100 }; }
    // 9. 產業頁顯示對手店與競爭統計
    { M.owners[k] = boss.agentId; M.rival[k] = { fid: 'Fu', owner: P[11].agentId, since: d, price: 0.85, pay: 1.1, emp: { [cooks[1].agentId]: d }, rev: 0, cost: 0, hist: [], loss: 0 }; M.cst.opened = Math.max(1, M.cst.opened);
      app.state = w.getState(); app.activeTab = 'industry'; const box = document.createElement('div'); app.renderEconomy(box); const h = box.textContent;
      out.ui = { rival: /⚔️/.test(h), meta: box.querySelectorAll('.compete-meta').length, text: (box.querySelector('.market-rival')?.textContent || '').slice(0, 80) };
      out.brief = MARKET.brief(w, P[11]); }
    // 10. 跑 30 天:沒有錯誤、錢守恆
    { for (const a of P) if (jobs0.has(a) && !a.isDead) a.job = jobs0.get(a); const d0 = w._absDay(); for (let i = 0; i < 96 * 30; i++) { w.paused = false; w.tick(); }
      let other = 0; const D = MONEY.S(w).days || {}; for (const k2 of Object.keys(D)) if (+k2 > d0 + 1) other += +(D[k2].other || 0); out.other = Math.round(other * 100) / 100; }
    return out;
  });
  console.log(`\n[${lang}]`);
  if (lang === 'zh') {
    ok(r.entry.open && r.entry.owner && r.entry.emp >= 1 && r.entry.paid > 0 && r.entry.total === 0, '生意好的產業有人在對面開店、挖人，開店錢付給本地工匠（總數不變）', r.entry);
    ok(r.entry.price < 1 && r.entry.pay > 1, '開幕打折、工資開得比較高', r.entry);
    ok(r.split.share > 0 && r.split.share < 1 && r.split.inc > 0 && r.split.riv > 0 && r.split.rebate > 0 && r.split.total === 100, '兩家分客人，打折省下的錢回到村民手上（100 銀幣一分不少地分給兩家、營業稅和村民）', r.split);
    ok(r.pay.riv > 0 && r.pay.emp > 0 && r.pay.rcost > 0, '對手店的工人由對手老闆發薪', r.pay);
    ok(r.poach.after > r.poach.before && r.poach.incPay > 1, '對面工資高就跳槽，被挖的老闆加薪', r.poach);
    ok(r.close.gone && r.close.log, '對手連虧又沒錢就收攤', r.close);
    ok(r.merge.owner && r.merge.noRival && r.merge.total === 0, '原本那家撐不住被對手併購（總數不變）', r.merge);
    ok(r.mgr.n >= 3 && r.mgr.hired >= 1 && r.mgr.fee > 0 && r.mgr.total === 0 && r.mgr.q3 < r.mgr.q2, '名下第三家起要請掌櫃、付薪水，服務也變差', r.mgr);
    ok(r.capProp && r.capProp.kind === 'antitrust_cap' && r.capProp.ref, '有反壟斷法、有人名下兩家以上：提案收緊', r.capProp);
    ok(r.lobby && r.lobby.inf >= 1 && r.lobby.total === 0, '被針對的大老闆私下塞錢遊說', r.lobby);
    ok(r.canBuyBefore === false && r.cap === 2 && r.canBuyAfter === false && r.divest.after < r.divest.before && r.divest.total === 0, '收緊到兩家後超過的要賣掉', { a: r.canBuyBefore, cap: r.cap, d: r.divest });
    ok(r.ui.rival && r.ui.meta === 1, '產業頁顯示對手店與競爭統計', r.ui);
    ok(/搶生意/.test(r.brief), '村民知道自己在跟誰搶生意（AI 摘要）', r.brief);
    ok(r.other === 0, '30 天沒有來路不明的錢', r.other);
  } else {
    ok(r.ui.rival && /Rival/.test(r.ui.text) && !/[一-鿿]/.test(r.ui.text.replace(/[^\x00-\x7F]/g, (c) => /[一-鿿]/.test(c) ? c : '')), '英文產業頁的對手店', r.ui.text);
    ok(/compet/i.test(r.brief), '英文村民摘要', r.brief);
  }
  ok(errs.length === 0, '沒有錯誤', errs.slice(0, 3));
  await browser.close();
}
(async () => { await run('zh'); await run('en'); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
