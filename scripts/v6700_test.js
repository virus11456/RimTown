// v6.70.0 經濟深化:創業開店(店名規則／AI)、合夥、客人上門賺錢、合夥拆夥、倒閉、殺價、銀行家審核(名聲差／處不好／AI 決定)、畫面、存讀檔
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const stubAI = (resp) => { const s = { fa: w.fullAgentMode, ok: CE.fullAgentOk, aj: CE._askJson }; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => resp; return () => { w.fullAgentMode = s.fa; CE.fullAgentOk = s.ok; CE._askJson = s.aj; }; };
      let D = 1300; const _ad = w._absDay; w._absDay = () => D; const out = {}; const B = BIZ.S(w); const all = npcs().filter(a => a.job?.key !== 'mayor');
      for (const a of npcs()) w.wallet.bal[a.agentId] = 50;
      // 開店(有錢的老闆自己出)
      const o1 = all[0]; o1.job.key = 'cook'; w.wallet.bal[o1.agentId] = 200; const s1 = await BIZ.open(w, B, o1, D); out.open = !!s1 && s1.type === 'bakery' && WALLET.get(w, o1) === 140 && logHas(/開了一家|opened a/);
      // 合夥(錢不夠找朋友)
      const o2 = all[1], fr = all[2]; w.wallet.bal[o2.agentId] = 30; w.wallet.bal[fr.agentId] = 100; fr.relationships.getOrCreate(o2.agentId, o2.name).affinity = 60; fr.personality.traits = [...fr.personality.traits.filter(x => x !== 'jealous'), 'jealous'];
      const s2 = await BIZ.open(w, B, o2, D); out.partner = !!s2 && s2.partner === fr.agentId && WALLET.get(w, fr) === 60;
      // AI 取店名
      const o3 = all[3]; w.wallet.bal[o3.agentId] = 200; let restore = stubAI({ name: '月光麵包坊' }); const s3 = await BIZ.open(w, B, o3, D); restore(); out.aiName = s3?.name?.[0] === '月光麵包坊';
      // 客人上門
      const m0 = WALLET.get(w, o1), f0 = WALLET.get(w, fr); for (const a of npcs()) if (![o1, o2, o3, fr].includes(a)) w.wallet.bal[a.agentId] = 50;
      D++; fix(0.001, () => BIZ.trade(w, B, D)); out.earn = WALLET.get(w, o1) > m0; out.split = WALLET.get(w, fr) > f0;
      // 合夥拆夥(生意差又愛計較)
      s2.week = 0; D = 1302 + (7 - (1302 % 7)); s2.partner = fr.agentId; fix(0.01, () => BIZ.weekly(w, s2)); out.dispute = !s2.partner && logHas(/鬧翻|fell out/);
      // 倒閉
      s3.lossDays = 14; s3.till = -10; for (const a of npcs()) w.wallet.bal[a.agentId] = 0; D++; fix(0.99, () => BIZ.trade(w, B, D)); out.broke = !B.shops.includes(s3) && logHas(/倒閉|closed down/);
      // 殺價
      const buyer = all[4]; buyer.personality.traits = [...buyer.personality.traits.filter(x => x !== 'shy'), 'charismatic']; w.wallet.bal[buyer.agentId] = 1000; const G = GOODS.S(w);
      const it = fix(0.5, () => GOODS.buy(w, G, { key: 'painting', from: 'x', lv: 2, price: 100, day: D }, buyer)); out.haggle = !!it && WALLET.get(w, buyer) > 900 && logHas(/殺價|haggled/);
      // 銀行家審核
      w.tierState.lv = 1; w.bank = null; BANK.daily(w); const Bk = w.bank; Bk.reserve = 1000;
      const bad = all[5]; DARK.S(w); w.dark.rep[bad.agentId] = { exposed: 3 }; out.refuseRep = BANK.lend(w, Bk, bad, 20, '周轉') === 0 && !Bk.loans[bad.agentId] && logHas(/拒絕|refused/);
      const foe = all[6]; const bk = w.agents[Bk.banker]; bk.relationships.getOrCreate(foe.agentId, foe.name).affinity = -50; out.refuseFoe = BANK.lend(w, Bk, foe, 20, '周轉') === 0;
      const good = all[7]; out.lendOk = BANK.lend(w, Bk, good, 20, '周轉') > 0;
      // AI 決定大筆貸款
      const big = all[8]; restore = stubAI({ lend: false, why: '他還不起' }); BANK.lend(w, Bk, big, 80, '翻修房子'); await new Promise(r => setTimeout(r, 50)); restore(); out.aiRefuse = !Bk.loans[big.agentId] && logHas(/他還不起/);
      const big2 = all[9]; restore = stubAI({ lend: true, why: '可以' }); BANK.lend(w, Bk, big2, 80, '翻修房子'); await new Promise(r => setTimeout(r, 50)); restore(); out.aiLend = !!Bk.loans[big2.agentId];
      w._absDay = _ad;
      app.state = w.getState(); app._showNpcCard(o1.agentId); out.card = document.getElementById('npc-quick-card')?.innerText || ''; app._hideNpcCard();
      const box = document.createElement('div'); document.body.appendChild(box); app.activeTab = 'industry'; app.renderEconomy(box); /* v7.3.0 搬到小鎮 › 產業 */ out.ui = box.querySelector('.pp-biz')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.biz?.shops?.length === B.shops.length; w2.reset(); out.reset = !w2.biz;
      return out;
    });
    ok(r.open, '有錢的人開店（依職業決定店種）', r);
    ok(r.partner, '錢不夠時找交情好的朋友合夥出資', r);
    ok(r.aiName, '完整智能體模式由 AI 取店名', r);
    ok(r.earn && r.split, '客人上門老闆賺錢，合夥人分紅', r);
    ok(r.dispute, '生意差又愛計較的合夥人會鬧翻拆夥', r);
    ok(r.broke, '連續虧損就倒閉', r);
    ok(r.haggle, '有魅力的人買珍品會殺價', r);
    ok(r.refuseRep && r.refuseFoe && r.lendOk, '銀行家審核：名聲差、處不好的借不到，正常的借得到', r);
    ok(r.aiRefuse && r.aiLend, '大筆貸款由銀行家 AI 決定', r);
    ok(/🥖|老闆|Owner/.test(r.card), '角色卡顯示自己的店', r.card.slice(0, 200));
    ok(/🏪/.test(r.ui), '產業頁有鎮上的店', r.ui);
    ok(r.rt && r.reset, '商店存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
