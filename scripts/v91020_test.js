// v9.10.3 存檔瘦身:關係數字留一位小數、共同回憶去重複且最親的 10 段留 2 句、閒聊記憶每人最近 15 則(重要的都留)、
// 空的關係人／參數不存、倉庫流水帳只存今天、NPC 對話紀錄 120 則;存了再讀、再存,內容要一樣能用
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
    const w = app.world; w.observerMode = true; const out = {};
    try {
      for (let i = 0; i < 20 * 96 + 80; i++) { w.paused = false; w.tick(); } // 跑 20 天,停在晚上 8 點(倉庫流水帳每天 18:00 記一次,這時有今天的)
      // 先在記憶體裡做出一些重複的共同回憶和很長的小數,確定存檔時會整理
      const A = Object.values(w.agents).find(a => !a.isPlayer && Object.keys(a.relationships.relationships).length >= 2);
      const [rk, R] = Object.entries(A.relationships.relationships)[0]; R.affinity = 39.00000000000007; R.sharedMemories = ['一起看了螢火蟲', '一起看了螢火蟲', '一起吃了綠豆湯', '一起去了市集'];
      for (let i = 0; i < 30; i++) A.memory.addT(w.tickCount, w.clock.timeStr, 'conversation', '與{agentA}交談：{summary}', { agentA: '測試', summary: '第' + i + '次' }, 5, ['測試']);
      A.memory.addT(w.tickCount, w.clock.timeStr, 'conversation', '與{agentA}交談：{summary}', { agentA: '測試', summary: '很重要的一次' }, 9, ['測試']);
      const s1 = JSON.parse(JSON.stringify(w.serialize())); const a1 = s1.agents[A.agentId];
      const r1 = a1.relationships[rk];
      out.rel = { aff: r1.affinity, shared: r1.sharedMemories, dup: new Set(r1.sharedMemories).size === r1.sharedMemories.length };
      const conv = a1.memory.filter(m => m.category === 'conversation'); out.mem = { conv: conv.length, keptImportant: conv.some(m => m.importance >= 9), emptyRel: a1.memory.some(m => Array.isArray(m.relatedAgents) && !m.relatedAgents.length), emptyP: a1.memory.some(m => m.p && !Object.keys(m.p).length), other: a1.memory.filter(m => m.category !== 'conversation').length };
      const dayStart = Math.floor(w.tickCount / 96) * 96; out.stock = { n: s1.stockpile.history.length, today: s1.stockpile.history.every(e => e.tick >= dayStart) };
      out.npcLog = (s1.npcConversationLog || []).length <= 120;
      // 存了再讀、再存
      const nAg = Object.keys(s1.agents).length, nRel = Object.values(s1.agents).reduce((s, a) => s + Object.keys(a.relationships || {}).length, 0);
      w.loadSave(s1); const B = w.agents[A.agentId];
      const s2 = JSON.parse(JSON.stringify(w.serialize()));
      out.round = { nAg: Object.keys(s2.agents).length === nAg, nRel: Object.values(s2.agents).reduce((s, a) => s + Object.keys(a.relationships || {}).length, 0) === nRel,
        memOk: (B.memory.entries || []).every(m => typeof m.content === 'string' && !/\{[a-zA-Z0-9]+\}/.test(m.content || '')), relArr: (B.memory.entries || []).every(m => Array.isArray(m.relatedAgents)),
        aff: B.relationships.relationships[rk]?.affinity, shared: (B.relationships.relationships[rk]?.sharedMemories || []).length };
      for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } out.round.runs = true;
      const size = JSON.stringify(w.serialize()).length, pop = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length; out.per = Math.round(size / pop);
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
    return out;
  });
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.rel && r.rel.aff === 39 && r.rel.dup && r.rel.shared.length <= 2, `${tag} 關係數字只留一位小數，共同回憶去掉重複、最多 2 句`, r.rel);
  ok(r.mem && r.mem.conv <= 16 && r.mem.keptImportant, `${tag} 閒聊記憶每人只存最近 15 則，重要的（8 分以上）照樣留著`, r.mem);
  ok(r.mem && !r.mem.emptyRel && !r.mem.emptyP && r.mem.other > 0, `${tag} 空的關係人、空參數不存；其他種類的記憶照舊`, r.mem);
  ok(r.stock && r.stock.n > 0 && r.stock.today, `${tag} 倉庫流水帳只存今天的（畫面只算今天的進出）`, r.stock);
  ok(r.npcLog, `${tag} NPC 對話紀錄最多存 120 則`, r.npcLog);
  ok(r.round && r.round.nAg && r.round.nRel && r.round.memOk && r.round.relArr && r.round.runs, `${tag} 存了再讀、再存：人數、關係、記憶都在，讀回來能繼續跑`, r.round);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
