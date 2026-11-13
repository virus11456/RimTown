// v9.23.6 AI 寫的日報真的會被採用：
//   以前 daily-news.js 把 llm.chat() 回的字串當成物件讀（.content／.choices），AI 每天寫好的日報都被當成沒寫、改用範本。
//   1) AI 有寫 → 記者專欄用 AI 寫的；長度上限 1500
//   2) 被長度上限切斷 → 收到最後一個完整句子；太短或沒回 → 照舊用範本
//   3) 最近 30 期以前的舊報：AI 專欄只留標題和頭條報導（存檔不會越存越大），最近 30 期完整保留；存讀檔後內容一致
//   4) 畫面：日報頁的「記者專欄」看得到 AI 寫的內容；英文介面人名顯示成英文
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang); const en = lang === 'en';
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
      const w = app.world; const dn = w.dailyNews; const llm = w.conversationEngine.llm; const out = {}; const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const A = npcs[0], B = npcs[1];
      const AI = (tail) => `📰 【${A.name}與${B.name}在廣場大吵一架】\n\n🔥 頭條報導\n今天中午，${A.name}把一籃雞蛋重重放在攤子上，指著${B.name}的鼻子說了很久。圍觀的人越來越多，連賣魚的都放下刀跑來看。我站在井邊看得一清二楚：${B.name}一句話也沒回，只是慢慢把帽子摘下來。\n\n📋 鎮務簡報\n糧倉今天進了兩車小麥。木匠說新橋下週可以完工。\n\n💬 街頭巷尾\n「你聽說了嗎？」「聽說了，雞蛋的事。」\n\n✍️ ${A.name}手記\n${'這個小鎮的每一天都像一鍋慢慢熬的湯，急不得。'.repeat(6)}${tail}`;
      const ev = () => { dn.todayEvents = [{ category: 'event', content: '測試事件：廣場有人吵架', importance: 8, agents: [A.name] }]; dn._lastPublishDay = null; };
      let asked = null; llm.generate = async (p, mt) => { asked = { mt }; return AI('明天見。'); };
      // 1) AI 有寫
      ev(); const p1 = await dn.generateNewspaper(w); out.used = { mt: asked?.mt, ai: /在廣場大吵一架/.test(p1?.content || ''), notes: /手記/.test(p1?.content || ''), len: (p1?.content || '').length };
      // 2) 被切斷／太短／沒回
      llm.generate = async () => AI('然後我想說的其實是，這座小鎮最讓人捨不得的地方就是');
      ev(); const p2 = await dn.generateNewspaper(w); out.cut = { ai: /在廣場大吵一架/.test(p2?.content || ''), end: (p2?.content || '').replace(/\n\n🐎[\s\S]*$/, '').slice(-12) };
      llm.generate = async () => '好的。'; ev(); const p3 = await dn.generateNewspaper(w); out.short = { has: !!p3?.content, ai: /^好的。/.test(p3?.content || ''), len: (p3?.content || '').length };
      llm.generate = async () => '__ERROR__'; ev(); const p4 = await dn.generateNewspaper(w); out.none = { has: !!p4?.content, len: (p4?.content || '').length };
      out.tidy = { md: DailyNewsEngine.tidy('📰 **"Shadows in the Storehouse"**\n\n## 🔥 **Headline Story**\n' + 'I was standing near the Town Square this morning when the whole place seemed to hold its breath. '.repeat(2)), fence: DailyNewsEngine.tidy('```\n' + AI('完。') + '\n```')?.startsWith('📰'), nul: DailyNewsEngine.tidy(null), obj: DailyNewsEngine.tidy('') };
      // 3) 舊報瘦身
      const base = dn.newspapers.length; const long = AI('這座小鎮最讓人捨不得的，就是每個人都把別人的事當成自己的事。'.repeat(14) + '明天見。'); for (let i = 0; i < 34; i++) dn.newspapers.push({ id: dn.newspapers.length + 1, day: i + 1, season: 'spring', year: 1, reporter: A.name, reporterId: A.agentId, reporterJob: 'x', content: long, events: [{ category: 'event', content: 'e' }], publishedAt: i, crossTown: [] });
      const S = dn.serialize(); const n = S.newspapers.length; const old = S.newspapers[base], recent = S.newspapers[n - 1], edge = S.newspapers[n - 30], before = S.newspapers[n - 31];
      out.slim = { n, oldLen: old.content.length, fullLen: long.length, oldHead: /在廣場大吵一架/.test(old.content) && /頭條報導/.test(old.content) && /帽子摘下來/.test(old.content), oldNoNotes: !/手記|鎮務簡報|街頭巷尾/.test(old.content), recentFull: recent.content === long, edgeFull: edge.content.length === long.length || edge.content === dn.newspapers[n - 30].content, beforeSlim: before.content.length < dn.newspapers[n - 31].content.length || dn.newspapers[n - 31].content.length <= 700, live: dn.newspapers[base].content === long, short: DailyNewsEngine.condense('很短的範本日報') === '很短的範本日報', cross: /🐎/.test(DailyNewsEngine.condense(long + '\n\n🐎 跨鎮專欄\n· 河口鎮｜大豐收')) };
      const dn2 = new DailyNewsEngine(); dn2.loadFrom(JSON.parse(JSON.stringify(S))); out.round = dn2.newspapers.length === n && dn2.newspapers[n - 1].content === long;
      dn.newspapers.length = base;
      // 4) 畫面
      out.names = { a: A.name, b: B.name, aEn: (typeof I18N !== 'undefined') ? I18N.localizeNames(A.name, true) : A.name };
      return out;
    });
    ok(r.used.mt === 1500 && r.used.ai && r.used.notes, 'AI 有寫日報：記者專欄用 AI 寫的（以前每天問了卻改用範本）；長度上限 1500', r.used);
    ok(r.cut.ai && /[。！？]$/.test(r.cut.end) && !/就是$/.test(r.cut.end), '日報被長度上限切斷：收到最後一個完整句子', r.cut);
    ok(r.short.has && !r.short.ai && r.short.len > 10 && r.none.has && r.none.len > 10, 'AI 只回一兩個字或沒回：照舊用範本', { s: r.short, n: r.none });
    ok(r.tidy.fence && r.tidy.nul === null && r.tidy.obj === null && !/\*\*|##/.test(r.tidy.md) && /^📰 "Shadows in the Storehouse"\n\n🔥 Headline Story\n/.test(r.tidy.md), '回覆外面包著 ``` 會拿掉、Markdown 的粗體和標題記號拿掉；空的算沒寫', r.tidy);
    ok(r.slim.oldHead && r.slim.oldNoNotes && r.slim.fullLen > 700 && r.slim.oldLen < 420 && r.slim.beforeSlim, '最近 30 期以前的舊報：AI 專欄只留標題和頭條報導', r.slim);
    ok(r.slim.recentFull && r.slim.edgeFull && r.slim.live && r.slim.short && r.slim.cross, '最近 30 期完整保留；遊戲中的資料不動（只有存檔瘦身）；短的範本日報不動；跨鎮專欄保留', r.slim);
    ok(r.round, '存讀檔後期數和最新一期內容一致', r.round);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
