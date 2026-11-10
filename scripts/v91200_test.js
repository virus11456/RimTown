// v9.12.0 文化演變:流行(穿戴／口頭禪／消遣／吃食)會傳開、退流行、變成習俗;年輕人學得快、學上不學下、
// 太多人跟時帶頭的人先不玩;穿戴付給裁縫(錢包到錢包);地圖上看得到、聊天會講、村民卡與鎮況看得到;存讀檔
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
    const logs = () => (w.messageLog || []).map(m => m.content || '').join('\n');
    const ppl = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 10 && !w.isAway?.(a.agentId));
    const tick = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } };
    const day = () => w._absDay();
    try {
      tick(96); const F = FADS.S(w); F.list = []; F.hist = []; F.lastDay = null; const P = ppl(); const N = P.length;
      // A. 誰容易跟:年輕人 vs 老人、學上不學下
      const y = P.find(a => (a.age ?? 30) < 26 && (a.age ?? 30) >= 16) || P[0], o = P.find(a => (a.age ?? 30) >= 61) || P[1];
      const f0 = { ix: 0, ad: {} }; const ay = y.age, ao = o.age; y.age = 20; o.age = 70; y.techStance = o.techStance = null;
      const tY = y.personality.traits, tO = o.personality.traits; y.personality.traits = []; o.personality.traits = [];
      out.open = { young: FADS.open(w, y, f0), old: FADS.open(w, o, f0) }; y.personality.traits = tY; o.personality.traits = tO; y.age = ay; o.age = ao;
      const hi = P.slice().sort((p, q) => CLASS.level(w, q) - CLASS.level(w, p)); const H = hi[0], Lw = hi[hi.length - 1];
      out.imit = { up: FADS.imit(w, H, Lw), down: FADS.imit(w, Lw, H), lvH: CLASS.level(w, H), lvL: CLASS.level(w, Lw) };
      // B. 新流行冒出來(穿戴):帶頭的人先跟、有紀錄;地圖外觀、村民卡、AI 提示詞
      const wearIx = FADS.LIST.findIndex(x => x.k === 'wear'); const origin = P.find(a => (a.age ?? 30) >= 18) || P[0];
      const fw = FADS.spawn(w, F, P, day(), { ix: wearIx, by: origin });
      const ap = LOOK.of(w, origin);
      out.spawn = { ok: !!fw && !!fw.ad[origin.agentId], log: /戴起了|started wearing/.test(logs()), look: ap?.fd === wearIx, sig: /F\d/.test(LOOK.sig(ap)), tag: FADS.tag(w, origin), brief: (w.conversationEngine._agentBrief(w, origin, P[1]).mem || []).some(s => /流行|fads/.test(s)) };
      // C. 跟穿戴付給裁縫:錢包到錢包;錢不夠跟不上
      let tailor = P.find(a => a.job?.key === 'tailor'); const buyer = P.find(a => a !== origin && a !== tailor && (a.age ?? 30) >= 18 && !fw.ad[a.agentId]);
      if (!tailor) { tailor = P.find(a => a !== origin && a !== buyer && (a.age ?? 30) >= 18); tailor._jobBak = tailor.job; tailor.job = Object.assign({}, tailor.job, { key: 'tailor' }); }
      WALLET.add(w, buyer, 100); const b0 = WALLET.get(w, buyer), s0 = WALLET.get(w, tailor);
      const adopted = FADS.adopt(w, fw, buyer, day()); out.pay = { adopted, buyer: b0 - WALLET.get(w, buyer), seller: WALLET.get(w, tailor) - s0 };
      const poor = P.find(a => a !== origin && a !== tailor && a !== buyer && (a.age ?? 30) >= 18 && !fw.ad[a.agentId]); WALLET.take(w, poor, Math.max(0, WALLET.get(w, poor) - 3));
      out.poor = { adopted: FADS.adopt(w, fw, poor, day()), in: !!fw.ad[poor.agentId] };
      if (tailor._jobBak) { tailor.job = tailor._jobBak; delete tailor._jobBak; }
      // D. 聊天:口頭禪會講出來,沒跟上的人可能學起來;規則對話多幾句
      const wordIx = FADS.LIST.findIndex(x => x.k === 'word'); const sp = P.find(a => a !== origin && (a.age ?? 30) >= 18 && (a.age ?? 30) < 50) || P[2];
      const fwd = FADS.spawn(w, F, P, day(), { ix: wordIx, by: sp }); const phrase = t(FADS.LIST[wordIx].zh);
      const ce = w.conversationEngine; let said = 0, learnt = 0;
      for (let i = 0; i < 40; i++) { const b = P[(i % (N - 1)) + 1] === sp ? P[0] : P[(i % (N - 1)) + 1]; const had = !!fwd.ad[b.agentId]; const relA = sp.relationships.getOrCreate(b.agentId, b.name), relB = b.relationships.getOrCreate(sp.agentId, sp.name);
        ce._fallbackConversation(sp, b, w, relA, relB); const L = ce.npcConversationLog[ce.npcConversationLog.length - 1]; if ((L?.dialogue || []).some(x => String(x.text).includes(phrase))) said++; if (!had && fwd.ad[b.agentId]) learnt++; }
      out.chat = { said, learnt };
      // E. 跑 25 天:傳開、變成正流行
      let maxN = 0, hot = false, hotLog = false; for (let d = 0; d < 30; d++) { tick(96); const f = F.list.find(x => x.id === fw.id); if (!f) break; const n = Object.keys(f.ad).length; maxN = Math.max(maxN, n); if (f.ph === 'hot') hot = true; if (/流行起來|caught on/.test(logs())) hotLog = true; }
      out.spread = { maxN, N, hot, log: hotLog };
      // F. 太多人跟:帶頭的人先不玩;之後退流行
      let fz = F.list.find(x => x.id === fw.id) || FADS.spawn(w, F, P, day(), { ix: wearIx + 1, by: origin });
      for (const a of ppl().slice(0, Math.ceil(N * 0.75))) fz.ad[a.agentId] = day(); fz.ad[origin.agentId] = day(); fz.ph = 'hot'; fz.qd = 0;
      const rnd = Math.random; let snob = false; for (let d = 0; d < 30 && !snob; d++) { tick(96); if (/不稀罕|no longer special/.test(logs())) snob = true; if (!F.list.includes(fz)) break; }
      out.snob = { log: snob, originOut: !fz.ad[origin.agentId] };
      for (let d = 0; d < 120 && F.list.includes(fz); d++) tick(96);
      out.fade = { gone: !F.list.includes(fz), hist: F.hist.some(h => h.ix === fz.ix), log: /退流行|went out of fashion|沒能流行|never really caught on/.test(logs()) };
      // G. 變成習俗(消遣):跟的人夠多、撐得夠久
      F.list = []; const playIx = FADS.LIST.findIndex(x => x.k === 'play'); const fp = FADS.spawn(w, F, ppl(), day(), { ix: playIx, by: ppl()[0] });
      for (const a of ppl().slice(0, Math.ceil(ppl().length * 0.6))) fp.ad[a.agentId] = day(); fp.ph = 'hot'; fp.hd = 30; fp.life = 999; F.lastDay = null;
      Math.random = () => 0.3; try { FADS.daily(w); } finally { Math.random = rnd; }
      const T = w.proposals.traditions || []; out.custom = { dbg: { same: FADS.S(w) === F, fp: !!fp, hd: fp?.hd, cx: fp?.cx, ph: fp?.ph, ld: F.lastDay, d: day() }, trad: T.some(x => x.text === FADS.LIST[playIx].c && x.fad), log: /成了鎮上的習俗|became a town custom/.test(logs()), ended: !F.list.includes(fp), hist: F.hist[0]?.cust === 1 };
      // H. 復古:很久以前流行過的又回來
      F.list = []; F.hist.unshift({ ix: wordIx + 1, d0: day() - 300, d1: day() - 200, max: 9, by: 'x', cust: 0 }); FADS.spawn(w, F, ppl(), day(), { ix: wordIx + 1 });
      out.retro = { log: /又流行回來|back in fashion/.test(logs()), flag: F.list.some(f => f.ix === wordIx + 1 && f.retro) };
      // I. 鎮況看得到、規則裡看得到習俗
      const B = app._townBlocks(null, ['culture', 'lore']); out.ui = { fads: /流行與習俗|Fads and customs/.test(B.culture || ''), lore: (B.lore || '').includes(t(FADS.LIST[playIx].c)) };
      // J. 存讀檔
      const nL = F.list.length, nH = F.hist.length; const blob = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(blob); out.load = { list: (w.fads?.list || []).length === nL, hist: (w.fads?.hist || []).length === nH };
      // K. 自然長跑 150 天:會自己冒出流行、會結束、同時最多三個
      w.fads = null; let mx = 0, spawned = 0; const seen = new Set(); for (let d = 0; d < 150; d++) { tick(96); const L2 = w.fads?.list || []; mx = Math.max(mx, L2.length); for (const f of L2) seen.add(f.id); }
      out.nat = { mx, seen: seen.size, ended: (w.fads?.hist || []).length, st: w.fads?.st };
      if (lang === 'en') out.zhLeak = (w.messageLog || []).slice(-200).map(m => m.content || '').filter(s => /[一-鿿]/.test(s) && /👒|💬|🎲|🍵|🔥|🍂|🏮|🎩|🔁/.test(s)).slice(0, 3);
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  }, lang);
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.open && r.open.young > r.open.old * 3, `${tag} 年輕人比老人容易跟流行`, r.open);
  ok(r.imit && (r.imit.lvH === r.imit.lvL || r.imit.up > r.imit.down), `${tag} 學上不學下：大家愛學階層比自己高的人`, r.imit);
  ok(r.spawn && r.spawn.ok && r.spawn.log, `${tag} 新流行冒出來：帶頭的人先跟，紀錄寫得出來`, r.spawn);
  ok(r.spawn && r.spawn.look && r.spawn.sig, `${tag} 地圖上看得到：跟穿戴流行的人外觀多一樣東西`, r.spawn);
  ok(r.spawn && r.spawn.tag && r.spawn.brief, `${tag} 村民卡有「跟流行」，AI 也知道自己在跟什麼流行`, r.spawn);
  ok(r.pay && r.pay.adopted && r.pay.buyer === 4 && r.pay.seller === 4, `${tag} 跟穿戴付給裁縫 4 銀幣（錢包到錢包）`, r.pay);
  ok(r.poor && !r.poor.adopted && !r.poor.in, `${tag} 錢不夠就跟不上`, r.poor);
  ok(r.chat && r.chat.said >= 3, `${tag} 聊天時口頭禪會講出來`, r.chat);
  ok(r.chat && r.chat.learnt >= 1, `${tag} 聊天時沒跟上的人會學起來`, r.chat);
  ok(r.spread && r.spread.maxN >= Math.ceil(r.spread.N * 0.25) && r.spread.hot && r.spread.log, `${tag} 跑 30 天會傳開、變成正流行`, r.spread);
  ok(r.snob && r.snob.log, `${tag} 太多人跟時，帶頭的人說「不稀罕了」`, r.snob);
  ok(r.fade && r.fade.gone && r.fade.hist && r.fade.log, `${tag} 之後會退流行，留在紀錄裡`, r.fade);
  ok(r.custom && r.custom.trad && r.custom.log && r.custom.ended && r.custom.hist, `${tag} 消遣撐得夠久會變成鎮上的習俗（寫進本鎮的規矩）`, r.custom);
  ok(r.retro && r.retro.log && r.retro.flag, `${tag} 很久以前流行過的會復古回來`, r.retro);
  ok(r.ui && r.ui.fads && r.ui.lore, `${tag} 鎮況看得到「流行與習俗」，規矩裡看得到新習俗`, r.ui);
  ok(r.load && r.load.list && r.load.hist, `${tag} 存讀檔後流行和紀錄都在`, r.load);
  ok(r.nat && r.nat.seen >= 2 && r.nat.ended >= 1 && r.nat.mx <= 3, `${tag} 自然跑 150 天：會自己冒出流行、會結束、同時最多三個`, r.nat);
  if (lang === 'en') ok(r.zhLeak && !r.zhLeak.length, `${tag} 英文介面的流行紀錄沒有中文`, r.zhLeak);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
