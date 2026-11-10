// v9.9.2 傳說迷信:失火的地方被說不乾淨(信的人不去閒晃、做法事驅邪)、天災留下「老天發怒」(獻祭、再來就有人不信)、名人越傳越神(敬重他的家人)、越傳越走樣、闢謠
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; const day1 = () => { for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } };
    day1();
    const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const out = {}; const rnd = Math.random;
    const logs = () => (w.messageLog || []).map(m => (m.content || ''));
    const silver = () => all.reduce((s, a) => s + WALLET.get(w, a), 0) + (w.stockpile?.get?.('silver') || 0) + (w.faith?.rels || []).reduce((s, R) => s + (R.fund || 0), 0);
    // A. 失火 → 凶地傳說
    const Lo = LEGACY.incident(w, 'curse', 'tavern', { p: locName(w, 'tavern') });
    out.created = !!Lo && Object.keys(Lo.hd).length === 3; out.startLog = logs().slice(-30).some(s => /鎮上開始有人說|people in town began/.test(s)); out.l5 = logs().slice(-3);
    // B. 口耳相傳:愛講的人會講得更誇張
    Math.random = () => 0.01; try { for (let i = 0; i < 3; i++) { w.legacy.lastDay = null; LEGACY.daily(w); } } finally { Math.random = rnd; }
    out.heard = Object.keys(Lo.hd).length; out.max = Lo.max; out.mutLog = logs().slice(-40).some(s => /越傳越走樣|grows with every telling/.test(s));
    // C. 信的人不去那裡閒晃(上工照去)
    w.legacy._cur = { tavern: Lo }; const bel = all.find(a => a.job?.workplace !== 'tavern'); Lo.hd[bel.agentId] = [2, 0.9, 0];
    bel.activity = 'recreation'; bel.targetLocation = null; Math.random = () => 0; try { bel._decideLocation(21); } finally { Math.random = rnd; }
    out.avoid = { t: bel.targetLocation, act: bel.activity };
    const non = all.find(a => a !== bel && a.job?.workplace !== 'tavern'); delete Lo.hd[non.agentId]; non.activity = 'recreation'; Math.random = () => 0; try { non._decideLocation(21); } finally { Math.random = rnd; }
    out.nonBel = non.targetLocation;
    // D. 做法事:信的人湊錢(錢不會憑空消失),之後信的程度下降
    const bs = all.slice(0, 5); for (const a of bs) { Lo.hd[a.agentId] = [2, 0.8, 0]; WALLET.add(w, a, 40); }
    const s0 = silver(); Lo.rite = null; w.legacy.lastDay = null; LEGACY.daily(w); const s1 = silver();
    out.rite = !!Lo.rite && Lo.rite.n >= 3 && Lo.rite.sum > 0; out.cons = Math.abs(s1 - s0) < 0.05; out.riteLog = logs().slice(-30).some(s => /做法事驅邪|cleanse/.test(s)); out.after = Lo.hd[bs[0].agentId][1]; out.go = !!bs[0]._thingGo;
    // E. 再出事就應驗
    const hit0 = Lo.hit; LEGACY.incident(w, 'curse', 'tavern', { p: locName(w, 'tavern') }); out.hit = Lo.hit === hit0 + 1; out.hitLog = logs().slice(-5).some(s => /應驗|came true/.test(s));
    // F. 天災 → 老天發怒 → 獻祭 → 又來了
    const ws = w.weather; ws.activeDisaster = null; ws._startDisaster('flood', w); const Wl = w.legacy.lore.find(x => x.kind === 'wrath' && x.key === 'flood' && !x.done);
    out.wrath = !!Wl; for (const a of bs) { Wl.hd[a.agentId] = [2, 0.8, 0]; } Wl.max = 2; Wl.hd[bs[4].agentId][1] = 0.5; w.legacy.lastDay = null; LEGACY.daily(w);
    out.offer = !!Wl.rite && logs().slice(-30).some(s => /獻上供品|offerings/.test(s));
    ws.activeDisaster = null; ws._startDisaster('flood', w); out.again = Wl.rite?.out === 'again' && logs().slice(-10).some(s => /還是來了|came anyway/.test(s)); out.split = { strong: Wl.hd[bs[0].agentId][1], weak: Wl.hd[bs[4].agentId][1] };
    ws.activeDisaster = null;
    // G. 名人傳奇:信的人敬重他的家人
    const fam = all[12]; const fan = all[13]; const sur = LEGACY.surname(fam); const af0 = fan.relationships.getOrCreate(fam.agentId, fam.name).affinity;
    const H = LEGACY.incident(w, 'hero', '測試傳奇', { a: '測試傳奇', r: '首長', f: sur }); H.hd[fan.agentId] = [2, 0.9, 0]; w.legacy.lastDay = null; LEGACY.daily(w);
    out.hero = fan.relationships.relationships[fam.agentId].affinity > af0;
    // H. 闢謠:不信的人勸朋友別當真
    const sk = all[14], fr = all[15]; sk.relationships.getOrCreate(fr.agentId, fr.name).affinity = 60; for (const id of Object.keys(Lo.hd)) delete Lo.hd[id]; Lo.hd[sk.agentId] = [1, -0.9, 0]; Lo.hd[fr.agentId] = [1, 0.6, 0]; Lo.deb = -99; Lo.done = false;
    const Rel = sk.relationships.relationships; const keep = {}; for (const id of Object.keys(Rel)) if (id !== fr.agentId) { keep[id] = Rel[id].affinity; Rel[id].affinity = 0; }
    Math.random = () => 0.05; try { w.legacy.lastDay = null; LEGACY.daily(w); } finally { Math.random = rnd; for (const id of Object.keys(keep)) Rel[id].affinity = keep[id]; }
    out.debunk = Lo.hd[fr.agentId][1] < 0.6 && logs().slice(-30).some(s => /迷信|superstition/.test(s));
    // I. AI 知道、面板看得到、存讀檔
    Lo.hd[fr.agentId] = [2, 0.7, 0]; out.brief = LEGACY.brief(w, fr); const V = LEGACY.view(w); out.view = V.lore.length; out.viewTxt = V.lore[0]?.text;
    const html = app._townBlocks(null, ['legacy']).legacy || ''; out.panel = /👻|⛈️|🌟/.test(html) && /聽過|Heard/.test(html);
    const ser = JSON.parse(JSON.stringify(w.serialize())); out.saved = Array.isArray(ser.legacy?.lore) && ser.legacy.lore.length >= 3;
    out.raw = logs().slice(-60).filter(s => /\{[a-z]\}/.test(s));
    return out;
  });
  console.log(lang, JSON.stringify({ brief: r.brief, txt: r.viewTxt }));
  ok(r.created && r.startLog, `[${lang}] 失火之後留下「那裡不乾淨」的說法，先有三個人聽說`, r);
  ok(r.heard > 3 && r.max >= 2 && r.mutLog, `[${lang}] 口耳相傳：聽過的人變多，愛講的人越講越誇張（日誌寫出來）`, { heard: r.heard, max: r.max });
  ok(r.avoid.t && r.avoid.t !== 'tavern' && r.nonBel === 'tavern', `[${lang}] 深信的人晚上不去那裡，沒聽過的人照去`, r.avoid);
  ok(r.rite && r.cons && r.riteLog && r.after < 0.5 && r.go, `[${lang}] 信的人湊錢做法事驅邪（錢不會憑空消失，晚上一起去），做完之後沒那麼怕了`, r);
  ok(r.hit && r.hitLog, `[${lang}] 同一處又出事：傳說應驗`, r);
  ok(r.wrath && r.offer, `[${lang}] 天災留下「老天發怒」，信的人獻上供品`, r);
  ok(r.again && r.split.strong >= 0.8 && r.split.weak < 0.3, `[${lang}] 獻了供品天災還是來：深信的人更信，半信的人開始不信`, r.split);
  ok(r.hero, `[${lang}] 名人越傳越神：信的人對他的家人更敬重`, r);
  ok(r.debunk, `[${lang}] 不信邪的人闢謠，朋友就沒那麼信`, r);
  ok(/你聽人說|You've heard/.test(r.brief || '') && r.view >= 3 && r.panel && r.saved, `[${lang}] AI 聊天知道、鎮史面板看得到、存檔帶著`, { brief: r.brief, view: r.view, panel: r.panel });
  ok(!r.raw.length, `[${lang}] 日誌沒有沒填的 {x}`, r.raw.slice(0, 3));
  ok(!errs.length, `[${lang}] 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
