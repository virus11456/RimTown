// v6.50.0 鎮上急事:缺糧／缺衣／冬天沒柴／缺貨／有人過不下去／結仇／士氣低落 → 村民真的受影響(餓、冷、心情、吵架、搬走),
// 自己記得、AI 看得到(村民自身狀態、鎮況、發想提示的急事清單),有對應提案就算有人處理,拖著沒人管會抱怨;存讀檔;提案頁顯示
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }) /* v6.82.2 遊戲在 town.html(首頁不載遊戲) */; await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2000);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, P = w.proposals, eng = w.conversationEngine; app._setPaused?.(true);
      const sp = w.stockpile; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const setRes = (r, n) => { sp.resources[r] = n; };
      // 缺糧、衣服、缺貨
      setRes('food', 2); setRes('meals', 0); setRes('bread', 0); setRes('clothing', 0); setRes('tools', 0); setRes('medicine', 0); setRes('furniture', 0); setRes('metal', 0); setRes('wood', 0); setRes('cloth', 0); setRes('stone', 0); setRes('herbs', 0); setRes('silver', 0);
      const A = npcs()[0], B = npcs()[1], C = npcs()[2];
      A.relationships.getOrCreate(B.agentId, B.name).affinity = -80;
      C.mood = 5;
      P.items = P.items.filter(p => p.status !== 'open'); P._generate = () => {}; // 先不產生提案,只看急事
      let day = P._abs(w);
      const hunger0 = A.needs.hunger;
      const runDay = () => { day++; P._issueDay = null; TOWN_ISSUES.daily(w, P, day); };
      runDay();
      const keys1 = Object.keys(P.issues || {});
      const mat = Object.values(P.issues).find(i => i.key.startsWith('materials:'));
      const worker = mat && w.agents[mat.who[0]]; const workerTh = (worker?.thoughts || []).map(x => x.kind);
      const hunger1 = A.needs.hunger, thoughts1 = (A.thoughts || []).map(x => x.kind);
      for (let i = 0; i < 4; i++) { C.mood = 5; runDay(); }
      const fd = P.issues.food;
      const memIssue = (A.memory.entries || []).filter(e => e.category === 'issue').map(e => e.content);
      const mayor = P._mayor(w); const mayorMem = (mayor?.memory?.entries || []).filter(e => e.category === 'issue').map(e => e.content);
      const log = (w.messageLog || w.log || []).slice(-80).map(m => (Array.isArray(m) ? m.join(' ') : (m.text || m.message || JSON.stringify(m))));
      // AI 看得到:村民自身狀態、鎮況、發想提示
      A.addThought('jealous', w, C.agentId, C.name); A.addThought('dream_progress', w);
      const ab = eng._agentBrief(w, A); const tb = eng._townBrief(w);
      let prompt = ''; eng.fullAgentOk = () => true; eng._askJson = async (p) => { prompt = p; return { title: lang === 'en' ? 'Buy grain' : '去鄰鎮買糧', pitch: 'x', category: 'economy', cost: { silver: 20 }, effects: [{ type: 'resource', res: 'food', amount: 60 }], addresses: [1] }; };
      const lang = window.I18N?.lang || localStorage.getItem('rimtown-lang');
      // v9.28.2 起有 35% 的機會改請村民提「跟急事無關、自己的事」，那種題目不附急事清單；這裡要驗的是附清單的那種，所以先把手氣固定住
      const _rnd = Math.random; Math.random = () => 0.9;
      const j = await eng.inventProposal(w, A, []);
      // 提案處理急事:addresses 指到最急的那件 → by 設好
      sp.resources.silver = 500;
      await P._inventLLM(w, day, A, () => {}, []);
      Math.random = _rnd;
      const made = P.items[P.items.length - 1];
      const firstKey = TOWN_ISSUES.list(P)[0]?.key;
      const claimed = Object.values(P.issues).filter(i => i.by === made?.id).map(i => i.key);
      // 調解提案自動對應結仇
      const feudKey = Object.keys(P.issues).find(k => k.startsWith('feud:'));
      const relief = { kind: 'relief', key: 'relief:' + C.agentId, make: () => ({ kind: 'relief', key: 'relief:' + C.agentId, tk: 'x', tp: {}, dk: 'x', dp: {}, cost: {} }) };
      const rp = P._createWith(w, day, relief, B);
      const miseryClaimed = P.issues['misery:' + C.agentId]?.by === rp?.id;
      // 提案被否決 → 又變沒人管
      rp.status = 'rejected'; C.mood = 5; runDay(); const miseryAfterReject = P.issues['misery:' + C.agentId]?.by || null;
      // 存讀檔
      const blob = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(blob);
      const rtKeys = Object.keys(w2.proposals.issues || {});
      // 問題解決 → 清掉
      setRes('food', 999); setRes('meals', 50); runDay(); const foodGone = !P.issues.food;
      // 提案頁顯示
      app.state = w.getState(); app._ppTab = 'town'; const box = document.createElement('div'); app.renderProposals(box); const panel = box.innerHTML;
      // 規則模式也有對策(缺衣 → 進貨)
      const cands = P._candidates(w, day).map(c => c.key);
      return { mat: mat?.key, workerTh, keys1, hunger0, hunger1, thoughts1, idle: fd?.idle, memIssue: memIssue.slice(-3), mayorMem: mayorMem.slice(-2), complain: log.filter(x => /抱怨|complain/.test(x)).length,
        ab: ab.mem?.[0], tb, promptHas: /addresses/.test(prompt) && prompt.includes(TOWN_ISSUES.text(TOWN_ISSUES.list(P)[0] || { k: '', p: {} }).slice(0, 4)), j: !!j, made: made?.kind, addresses: made?.addresses, claimed, firstKey,
        miseryClaimed, miseryAfterReject, rtKeys, foodGone, panelHas: panel.includes('pp-issues'), cands: cands.filter(k => k.startsWith('market:buy:')), feudKey, fights: (A.thoughts || []).some(x => x.kind === 'fought') || (B.thoughts || []).some(x => x.kind === 'fought') };
    });
    ok(['food', 'clothing', 'goods', 'gloom'].some(k => r.keys1.includes(k)) && r.keys1.includes('food') && r.keys1.some(k => k.startsWith('misery:')) && r.keys1.some(k => k.startsWith('feud:')), '偵測到缺糧、有人過不下去、結仇等急事', r.keys1);
    ok(r.keys1.includes('treasury') && !!r.mat && r.workerTh.includes('no_materials'), '經濟急事:公庫見底、工人缺原料,缺料的工人自己感受到', { keys: r.keys1, mat: r.mat, th: r.workerTh });
    ok(r.hunger1 < r.hunger0 && r.thoughts1.includes('hungry'), '缺糧時村民真的會餓、心裡記著「吃不飽」', { h0: r.hunger0, h1: r.hunger1, th: r.thoughts1 });
    ok(r.memIssue.length > 0, '村民的記憶裡有這件事', r.memIssue);
    ok(r.idle >= 5 && r.complain > 0 && r.mayorMem.length > 0, '拖著沒人管:村民抱怨、鎮長被點名', { idle: r.idle, complain: r.complain, mayor: r.mayorMem });
    ok(!!r.ab && /嫉妒|jealous/i.test(r.ab) && /夢想|dream/i.test(r.ab) && /餓|hungry/i.test(r.ab) && /心情|mood|sad/i.test(r.ab), 'AI 讀村民資料時,先看到他自己的心情、身體狀況與情緒(嫉妒、開心…)', r.ab);
    ok(/急事|urgent/.test(r.tb), '鎮況裡有急事', r.tb.slice(-200));
    ok(r.promptHas, '自由發想的提示詞有急事清單與 addresses 欄位', null);
    ok(r.made === 'free' && (r.addresses || []).length === 1 && r.claimed.includes(r.firstKey), 'AI 填 addresses → 那件急事算有人在處理', { addresses: r.addresses, claimed: r.claimed, first: r.firstKey });
    ok(r.miseryClaimed && r.miseryAfterReject === null, '救濟提案對應到「過不下去」;被否決後又變成沒人管', { a: r.miseryClaimed, b: r.miseryAfterReject });
    ok(r.rtKeys.length > 0, '急事存讀檔', r.rtKeys);
    ok(r.foodGone, '存糧補上後,缺糧急事就消失', null);
    ok(r.panelHas, '提案頁顯示「鎮上急事」', null);
    ok(r.cands.includes('market:buy:clothing'), '規則模式也會想到進貨(缺衣)', r.cands);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
