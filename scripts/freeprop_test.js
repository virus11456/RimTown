// v6.47.0 村民自由提案:AI 回傳天馬行空的提案(含不合法的值)→ 只留白名單效果、數值夾住、好處打折;通過後真的改變世界(資源、每日產出、心情、人際、政令、轉職、傳統、地標);提示詞組得出來;存讀檔;中英
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
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
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2000);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, P = w.proposals; app._setPaused?.(true);
      const ag = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const A = ag.find(a => a.job?.key === 'farmer') || ag[0], B = ag.find(a => a !== A && a.job?.key !== 'mayor'), C = ag.find(a => a !== A && a !== B && a.job?.key !== 'mayor' && a.job?.key !== 'doctor');
      // 1) 提示詞組得出來(攔下送 AI 的那一刻)
      let prompt = ''; const eng = w.conversationEngine; const _ask = eng._askJson, _ok = eng.fullAgentOk;
      eng.fullAgentOk = () => true; eng._askJson = async (p) => { prompt = p; return { skip: true }; };
      await eng.inventProposal(w, A);
      eng._askJson = _ask;
      // 2) AI 回傳一個天馬行空的提案(混了不合法的東西)
      const wild = { title: '替廣場的貓立雕像，每週三只說真話', pitch: '貓陪了我們這麼多年', category: 'culture', cost: { silver: 40, gold: 999 },
        effects: [ { type: 'resource', res: 'food', amount: 9999 }, { type: 'daily', res: 'herbs', amount: 3, days: 99 }, { type: 'mood', who: 'all', amount: 50 },
          { type: 'relation', a: B.name, b: C.name, amount: 20 }, { type: 'modifier', key: 'festival_chance', value: 0.9, days: 10 }, { type: 'job', name: C.name, job: 'doctor' },
          { type: 'tradition', text: '每週三全鎮只說真話' }, { type: 'landmark', name: '廣場貓神像', icon: '🐱' }, { type: 'nuke' }, { type: 'mood', who: 'name:不存在的人', amount: 5 } ] };
      eng.inventProposal = async () => wild;
      const day = P._abs(w); const before = P.items.length;
      P.items = P.items.filter(p => p.status !== 'open'); // 騰出待決名額
      await P._inventLLM(w, day, A, () => { window.__fb = true; });
      const p = P.items[P.items.length - 1];
      const fxTypes = (p?.fx || []).map(e => e.type);
      const item = P.toItem(w, p);
      // 3) 強制通過並執行
      const food0 = w.stockpile.get('food'), herbs0 = w.stockpile.get('herbs'), silver0 = w.stockpile.get('silver');
      const mood0 = A.moodModifier || 0; const rel0 = B.relationships.getOrCreate(C.agentId, C.name).affinity;
      w.stockpile.add('silver', 200, w.tickCount, 'test', 'test');
      p.status = 'approved'; P._execute(w, p, day);
      const after = { status: p.status, result: p.result, food: w.stockpile.get('food') - food0, mood: (A.moodModifier || 0) - mood0, rel: B.relationships.getOrCreate(C.agentId, C.name).affinity - rel0, job: C.job?.key,
        decree: (w.council?.activeDecrees || []).some(d => String(d.id).startsWith('free_')), trad: (P.traditions || []).map(x => x.text), lm: (P.landmarks || []).map(x => x.icon + x.name), ongoing: (P.ongoing || []).length };
      // 每日產出:過兩天草藥有增加
      const h1 = w.stockpile.get('herbs'); P._lastDay = null; FREEPROP.daily(w, P); const h2 = w.stockpile.get('herbs');
      // 4) 傳統進到 AI 的鎮況
      const brief = eng._townBrief(w);
      // 5) 存讀檔
      const blob = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(blob);
      eng.fullAgentOk = _ok;
      return { promptOk: prompt.length > 300 && prompt.includes(A.name) || prompt.includes(I18N.localizeName ? I18N.localizeName(A.name) : A.name), promptLen: prompt.length, created: !!p && p.kind === 'free', fb: !!window.__fb, fxTypes, fx: p?.fx, cost: p?.cost, item: { effects: item.effectsText, kind: item.kindLabel }, after, herbsDaily: h2 - h1, brief: brief.slice(-120),
        rt: { trad: (w2.proposals.traditions || []).length, lm: (w2.proposals.landmarks || []).length, ongoing: (w2.proposals.ongoing || []).length } };
    });
    ok(r.promptOk, '自由發想的提示詞組得出來(含鎮況與自己的資料)', r.promptLen);
    ok(r.created && !r.fb, 'AI 的點子變成一件提案', { created: r.created, fb: r.fb });
    ok(!r.fxTypes.includes('nuke') && r.fxTypes.filter(x => x === 'mood').length === 1 && r.fxTypes.length <= 8, '不合法的效果(未知類型、不存在的人)被丟掉', r.fxTypes);
    const food = r.fx.find(e => e.type === 'resource'), mood = r.fx.find(e => e.type === 'mood'), daily = r.fx.find(e => e.type === 'daily'), mod = r.fx.find(e => e.type === 'modifier');
    ok(food.amount <= 150 && mood.amount <= 8 && daily.days <= 20 && mod.value <= 0.3 && !r.cost.gold, '數值夾在範圍內、不明資源的花費被拿掉', { food, mood, daily, mod, cost: r.cost });
    ok(food.amount < 150 || mood.amount < 8, '好處太划算時被打折', { food: food.amount, mood: mood.amount });
    ok((r.cost.silver || 0) >= 30 || (r.cost.stone || 0) >= 15, '立地標一定有代價(至少 30 銀或 15 石)', r.cost);
    ok(r.item.effects.length >= 6 && r.item.effects.some(x => /🐱/.test(x)), '提案卡列出實際效果', r.item);
    ok(r.after.status === 'done' && r.after.food > 0 && r.after.mood > 0 && r.after.rel > 0 && r.after.job === 'doctor' && r.after.decree, '通過後真的改變世界(食物、心情、關係、轉職、政令)', r.after);
    ok(r.after.trad.length === 1 && r.after.lm.length === 1 && r.after.ongoing === 1 && r.herbsDaily > 0, '立下傳統與地標、每天產出草藥', { a: r.after, herbs: r.herbsDaily });
    ok(/真話|truth/i.test(r.brief) || r.brief.includes('每週三'), '新傳統寫進 AI 的鎮況', r.brief);
    ok(r.rt.trad === 1 && r.rt.lm === 1 && r.rt.ongoing === 1, '存檔→讀檔保留傳統、地標與連續效果', r.rt);
    await page.evaluate(() => { const app = window.rimtownApp; app.state = app.world.getState(); });
    await page.waitForTimeout(1200);
    const lm = await page.evaluate(() => [...document.querySelectorAll('.t3d-landmark')].map(e => e.innerText));
    ok(lm.length === 1 && /廣場貓神像|🐱/.test(lm[0]), '地標出現在 3D 地圖上', lm);
    if (process.env.SHOT) { await page.evaluate(() => { const app = window.rimtownApp; const sq = app.tileMap.buildingZones.town_square; app.tileMap.focusLocation?.('town_square'); }); await page.waitForTimeout(1500); await page.screenshot({ path: process.env.SHOT + '/lm_' + lang + '.png' }); }
    await page.evaluate(() => { const app = window.rimtownApp; app.state = app.world.getState(); app._openKairoTab ? app._openKairoTab('proposals') : app._goTab?.('proposals'); app.renderSidebar?.(); });
    await page.waitForTimeout(700);
    const fxN = await page.evaluate(() => document.querySelectorAll('.pp-fx span').length);
    // v6.53.0 規矩與地標搬到「鎮況」子分頁
    await page.evaluate(() => document.querySelector('[data-pp-tab="town"]')?.click()); await page.waitForTimeout(200);
    const panel = await page.evaluate((fx) => ({ fx, lore: document.querySelector('.pp-lore')?.innerText || '' }), fxN);
    await page.evaluate(() => document.querySelector('[data-pp-tab="props"]')?.click());
    ok(panel.fx >= 6 && /每週三|truth|Wednesday/i.test(panel.lore), '提案分頁顯示效果標籤與「規矩與地標」', panel);
    if (process.env.SHOT) { await page.evaluate(() => document.querySelector('.pp-lore')?.scrollIntoView()); await page.screenshot({ path: process.env.SHOT + '/pp_' + lang + '.png' }); await page.evaluate(() => document.querySelector('.pp-fx')?.closest('.pp-card')?.scrollIntoView()); await page.screenshot({ path: process.env.SHOT + '/ppcard_' + lang + '.png' }); }
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
