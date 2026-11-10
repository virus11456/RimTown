// v9.13.0 世界史詩:開篇、跨進新時代、城鎮升格、加冕／推翻王室、世界級災厄降臨與撐過、賢者之石(得到、被偷、化為塵土)、傳說,
// 都會寫成史詩的一篇(真實人名、年份);被寫進去的人記得、AI 知道、閒聊會提;史詩書能翻頁、點人名鏡頭跟過去;存讀檔
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
    const tick = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } };
    const P = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
    const E = () => w.epic; const last = () => E().cantos[E().cantos.length - 1];
    const step = () => { E().lastDay = null; EPIC.daily(w); };
    const cjk = (s) => /[一-鿿]/.test(s || '');
    try {
      tick(96 * 2);
      out.open = { has: !!E() && E().cantos.length >= 1 && E().cantos[0].kind === 'open', heroes: E()?.cantos[0]?.heroes.length || 0, log: /寫進了史詩|wrote it into the epic/.test(logs()) };
      // 新時代
      const RM = w.research, ce0 = RM.currentEra; const e0 = ce0.call(RM); RM.currentEra = function () { return e0 + 1; }; step(); RM.currentEra = ce0;
      out.era = { kind: last().kind, lines: last().lines.length, text: EPIC.textOf(last()) };
      // 城鎮升格
      const TS = TIERS.S(w); const lv0 = TS.lv; TS.lv = Math.min(3, lv0 + 1); step(); out.up = { kind: last().kind, title: EPIC.textOf(last()).title }; TS.lv = lv0; step();
      // 加冕、推翻王室
      const C = CROWN.S(w); const K = P()[0]; C.king = K.agentId; step(); out.king = { kind: last().kind, hero: last().heroes[0]?.id === K.agentId, mem: (K.memory.entries || []).slice(-10).some(m => /史詩|epic/.test(m.content || '')) };
      C.republic = true; step(); out.rep = { kind: last().kind, title: EPIC.textOf(last()).title, oldKing: EPIC.textOf(last()).lines.join(' ').includes(t(K.name)) }; C.republic = false; C.king = null; step();
      // 世界級災厄:降臨、撐過
      const kinds = Object.keys(WORLDCAL.KINDS || {}); const wk = kinds[0]; const saved = w.worldcal;
      w.worldcal = { cur: { kind: wk, icon: '☄️' } }; step(); out.wc = { kind: last().kind, title: EPIC.textOf(last()).title };
      w.worldcal = saved; step(); out.wcEnd = { kind: last().kind, lines: EPIC.textOf(last()).lines };
      // 賢者之石:得到、被偷、化為塵土
      const L = LONGEV.S(w); const [A, B2] = [P()[1], P()[2]]; L.held = { id: A.agentId, d0: 0, age0: 40, charge: 100 }; step(); out.stone = { kind: last().kind, hero: last().heroes[0]?.id === A.agentId };
      L.st.stolen++; L.held.id = B2.agentId; step(); out.theft = { kind: last().kind, both: last().heroes.length === 2, text: EPIC.textOf(last()).lines.join(' ') };
      L.st.dust++; L.held = null; step(); out.dust = { kind: last().kind, name: EPIC.textOf(last()).lines.join(' ').includes(t(B2.name)) };
      // 傳說(名人過世)
      const LG = LEGACY.S(w); LG.legends.push({ name: '測試賢者', role: '國王', day: 1, fam: '測', statue: false }); step(); out.legend = { kind: last().kind, title: EPIC.textOf(last()).title };
      // AI、村民卡、鎮況
      out.brief = (w.conversationEngine._agentBrief(w, K, P()[3]).mem || []).some(s => /史詩|epic/.test(s));
      out.tag = EPIC.tag(w, K); out.town = EPIC.townBrief(w);
      const Bk = app._townBlocks(null, ['legacy']); out.ui = { btn: /data-action="epic-open"/.test(Bk.legacy || '') };
      // 閒聊:史詩人物會提、有人會背
      const ce = w.conversationEngine; const rnd = Math.random; let said = 0;
      Math.random = () => 0.05; try { for (let i = 0; i < 6; i++) { const b = P()[4 + i]; ce._fallbackConversation(K, b, w, K.relationships.getOrCreate(b.agentId, b.name), b.relationships.getOrCreate(K.agentId, K.name)); const Lg = ce.npcConversationLog[ce.npcConversationLog.length - 1]; if ((Lg?.dialogue || []).some(x => /史詩|epic/.test(x.text))) said++; } } finally { Math.random = rnd; }
      out.chat = said;
      // 史詩書:翻頁、點人名、Esc
      EPIC.openBook(app); const bk = () => document.getElementById('epic-book'); const title = () => bk()?.querySelector('.epic-title')?.textContent;
      const t1 = title(); bk().querySelector('[data-epic="prev"]').click(); const t2 = title(); bk().querySelector('[data-epic="next"]').click(); const t3 = title();
      out.book = { open: !!bk(), flip: t1 !== t2 && t3 === t1, count: E().cantos.length };
      let idx = E().cantos.findIndex(c => c.kind === 'king'); EPIC.openBook(app, idx); const hb = bk().querySelector('[data-epic="hero"]'); hb.click();
      out.book.hero = !bk() && app.tileMap?._followAgent === K.agentId;
      EPIC.openBook(app); bk().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); out.book.esc = !bk();
      // 存讀檔
      const n0 = E().cantos.length; const blob = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(blob); out.load = { n: (w.epic?.cantos || []).length === n0 };
      // 自然長跑 120 天
      w.epic = null; tick(96 * 120); out.nat = { n: (w.epic?.cantos || []).length, allLines: (w.epic?.cantos || []).every(c => c.lines.length >= 2) };
      if (lang === 'en') out.en = { rep: out.rep.title, leak: (EPIC.view(w)?.cantos || []).concat([{ title: out.rep.title, lines: [] }]).filter(c => c.title && !/[A-Za-z]/.test(c.title)).map(c => c.title).slice(0, 3) };
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  }, lang);
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.open && r.open.has && r.open.heroes >= 1 && r.open.log, `${tag} 開篇：第一天就寫下〈開篇〉，有真實的人名`, r.open);
  ok(r.era && r.era.kind === 'era' && r.era.lines >= 3, `${tag} 跨進新時代寫成一篇`, r.era);
  ok(r.up && r.up.kind === 'up', `${tag} 城鎮升格寫成一篇`, r.up);
  ok(r.king && r.king.kind === 'king' && r.king.hero && r.king.mem, `${tag} 加冕寫成一篇，國王是史詩人物、也記得`, r.king);
  ok(r.rep && r.rep.kind === 'rep' && r.rep.oldKing, `${tag} 推翻王室寫成〈王冠落地〉，提到前一任國王`, r.rep);
  ok(r.wc && r.wc.kind === 'wc' && r.wcEnd && r.wcEnd.kind === 'wcEnd', `${tag} 世界級災厄降臨、撐過都寫成一篇`, { wc: r.wc, end: r.wcEnd });
  ok(r.stone && r.stone.kind === 'stone' && r.stone.hero, `${tag} 得到賢者之石寫成一篇`, r.stone);
  ok(r.theft && r.theft.kind === 'theft' && r.theft.both, `${tag} 賢者之石被偷寫成〈竊石〉（兩個人都是史詩人物）`, r.theft);
  ok(r.dust && r.dust.kind === 'dust' && r.dust.name, `${tag} 賢者之石離身化為塵土，寫出名字`, r.dust);
  ok(r.legend && r.legend.kind === 'legend', `${tag} 名人過世成為傳說，寫成一篇`, r.legend);
  ok(r.brief && r.tag && r.town, `${tag} AI 知道自己被寫進史詩；村民卡有「史詩人物」；鎮上近況會提最新一篇`, { brief: r.brief, tag: r.tag, town: r.town });
  ok(r.ui && r.ui.btn, `${tag} 鎮況的鎮史有「翻開史詩」`, r.ui);
  ok(r.chat >= 2, `${tag} 閒聊時史詩人物會提、有人會背史詩`, r.chat);
  ok(r.book && r.book.open && r.book.flip, `${tag} 史詩書能翻頁`, r.book);
  ok(r.book && r.book.hero && r.book.esc, `${tag} 點史詩裡的人名，鏡頭跟過去；Esc 關掉`, r.book);
  ok(r.load && r.load.n, `${tag} 存讀檔後史詩都在`, r.load);
  ok(r.nat && r.nat.n >= 1 && r.nat.allLines, `${tag} 自然跑 120 天沒問題，每篇都有詩句`, r.nat);
  if (lang === 'en') ok(r.en && /[A-Za-z]/.test(r.en.rep) && !r.en.leak.length, `${tag} 英文介面的史詩標題是英文`, r.en);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
