// v9.16.0 鎮與鎮的競爭:對手鎮、搶生意、挖角(走或留)、人才投奔、互通有無(關係好換貨／關係差抬價)、友誼賽、遭災送糧;
// 關係跟著變;AI 知道對手鎮、閒聊會提、鎮況外交區塊有兩鎮比較;存讀檔;自然跑 60 天
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
  const r = await page.evaluate((lang) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; const out = {};
    const tick = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } };
    const P = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
    const V = () => w.rival; const last = () => V().log[V().log.length - 1];
    const rel = () => Math.round(DIPLO.S(w).rel[V().pid] || 0); const setRel = (n) => { DIPLO.S(w).rel[V().pid] = n; };
    const rnd = Math.random; const force = (x, f) => { Math.random = () => x; try { return f(); } finally { Math.random = rnd; } };
    const cjk = (s) => /[一-鿿]/.test(s || '');
    try {
      tick(96 * 2);
      out.pick = { has: !!V(), pid: V()?.pid, them: typeof V()?.them === 'number', town: (w.tidings?.places || []).some(p => p.id === V()?.pid && p.kind === 'town') };
      // 搶生意:贏、輸
      w.prosperity.prosperity = 90; V().them = 20; setRel(10); let r0 = rel(); force(0.5, () => RIVAL.event(w, 'trade'));
      out.tradeWin = { kind: last().kind, good: last().good, mod: (w.news?.bulletins || []).some(b => b.rival && b.modifiers?.sell_bonus > 0), rel: rel() < r0 };
      w.prosperity.prosperity = 20; V().them = 90; force(0.5, () => RIVAL.event(w, 'trade'));
      out.tradeLose = { good: last().good, mod: (w.news?.bulletins || []).some(b => b.rival && Object.values(b.modifiers || {}).some(v => v < 0)) };
      // 挖角:留下、被挖走
      const A = P().filter(a => !(w.election?.currentMayor?.(w)?.agentId === a.agentId))[2]; A.skills.skills['工藝'].xp = 9000;
      const n0 = P().length; force(0.0, () => RIVAL.event(w, 'talent'));
      out.kept = { good: last().good, alive: !!w.agents[A.agentId], mem: (A.memory.entries || []).slice(-5).some(m => /沒答應|said no|turned/i.test(m.content || '') || /{p}/.test(m.k || '')), st: V().st.kept };
      force(0.999, () => RIVAL.event(w, 'talent'));
      out.lost = { good: last().good, gone: !w.agents[A.agentId], st: V().st.lost, n: n0 - P().length, mem: P().some(o => (o.memory.entries || []).slice(-6).some(m => (m.content || '').includes(t(A.name)))) };
      // 人才投奔
      w.prosperity.prosperity = 90; V().them = 20; const n1 = Object.keys(w.agents).length; RIVAL.event(w, 'gain');
      out.gain = { kind: last().kind, more: Object.keys(w.agents).length - n1, st: V().st.gained };
      // 互通有無:關係好換貨、關係差抬價
      w.stockpile.add('stone', 400); w.stockpile.consume('cloth', w.stockpile.get('cloth')); setRel(30); const c0 = w.stockpile.get('cloth'), s0 = w.stockpile.get('stone'), r1 = rel();
      RIVAL.event(w, 'dep'); out.swap = { good: last().good, cloth: w.stockpile.get('cloth') - c0, stone: s0 - w.stockpile.get('stone'), warm: rel() > r1 };
      setRel(-40); RIVAL.event(w, 'dep'); out.gouge = { good: last().good, st: V().st.gouge };
      // 友誼賽、送糧
      setRel(0); const r2 = rel(); RIVAL.event(w, 'contest'); out.contest = { kind: last().kind, warm: rel() > r2, champ: !!last().p.a };
      w.stockpile.add('food', 800); setRel(40); V().them = 20; const f0 = w.stockpile.get('food'); const r3 = rel(); RIVAL.event(w, 'aid'); out.aid = { kind: last().kind, food: Math.round(f0 - w.stockpile.get('food')), warm: rel() > r3 };
      // AI、閒聊、畫面
      const tb = w.conversationEngine._townBrief(w); out.brief = tb.includes(t(RIVAL.view(w).name)) || tb.includes(RIVAL.view(w).name);
      const ce = w.conversationEngine; let said = 0;
      Math.random = () => 0.03; try { for (let i = 0; i < 6; i++) { const a = P()[i], b = P()[i + 6]; ce._fallbackConversation(a, b, w, a.relationships.getOrCreate(b.agentId, b.name), b.relationships.getOrCreate(a.agentId, a.name)); const L = ce.npcConversationLog[ce.npcConversationLog.length - 1]; if ((L?.dialogue || []).some(x => x.text.includes(RIVAL.view(w).name))) said++; } } finally { Math.random = rnd; }
      out.chat = said;
      const Bk = app._townBlocks(null, ['diplo']); out.ui = { block: /pp-rival/.test(Bk.diplo || ''), bars: (Bk.diplo.match(/pp-rv-bar/g) || []).length };
      // 存讀檔
      const nlog = V().log.length; const blob = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(blob); out.load = { log: w.rival?.log?.length === nlog, pid: !!w.rival?.pid };
      if (lang === 'en') out.en = { leak: RIVAL.view(w).log.map(x => x.text).filter(cjk), brief: cjk(RIVAL.townBrief(w)) };
      // 自然跑 60 天
      w.rival = null; tick(96 * 60); out.nat = { n: w.rival?.n || 0, kinds: [...new Set((w.rival?.log || []).map(x => x.kind))] };
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  }, lang);
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.pick && r.pick.has && r.pick.them && r.pick.town, `${tag} 從鄰鎮裡挑出對手鎮，有自己的繁榮度`, r.pick);
  ok(r.tradeWin && r.tradeWin.kind === 'trade' && r.tradeWin.good && r.tradeWin.mod && r.tradeWin.rel && r.tradeLose && !r.tradeLose.good && r.tradeLose.mod, `${tag} 搶生意：比較強就守住（賣價加成），比較弱就被搶（賣價變差），關係變差`, { w: r.tradeWin, l: r.tradeLose });
  ok(r.kept && r.kept.good && r.kept.alive && r.kept.st >= 1, `${tag} 挖角：好手婉拒，留在鎮上`, r.kept);
  ok(r.lost && !r.lost.good && r.lost.gone && r.lost.st >= 1 && r.lost.n === 1 && r.lost.mem, `${tag} 挖角：好手被高薪挖走，鎮上的人記得`, r.lost);
  ok(r.gain && r.gain.kind === 'gain' && r.gain.more === 1 && r.gain.st >= 1, `${tag} 我們比較興旺時，對手鎮的人搬過來`, r.gain);
  ok(r.swap && r.swap.good && r.swap.cloth > 0 && r.swap.stone === r.swap.cloth && r.swap.warm && r.gouge && !r.gouge.good && r.gouge.st >= 1, `${tag} 互通有無：關係好拿多的換缺的（關係變好），關係差被抬價`, { s: r.swap, g: r.gouge });
  ok(r.contest && r.contest.kind === 'contest' && r.contest.warm && r.contest.champ && r.aid && r.aid.kind === 'aid' && r.aid.food === 40 && r.aid.warm, `${tag} 友誼賽、對手遭災送糧都讓關係變好`, { c: r.contest, a: r.aid });
  ok(r.brief && r.chat >= 2, `${tag} AI 知道對手鎮；閒聊會提`, { brief: r.brief, chat: r.chat });
  ok(r.ui && r.ui.block && r.ui.bars === 2, `${tag} 鎮況外交區塊有兩鎮比較`, r.ui);
  ok(r.load && r.load.log && r.load.pid, `${tag} 存讀檔後競爭紀錄都在`, r.load);
  ok(r.nat && r.nat.n >= 6 && r.nat.kinds.length >= 3, `${tag} 自然跑 60 天：大約每週一件、種類多樣`, r.nat);
  if (lang === 'en') ok(r.en && !r.en.leak.length && !r.en.brief, `${tag} 英文介面沒有中文`, r.en);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
