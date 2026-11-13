// v9.23.7 英文模式：村民的英文名剛好是普通單字（Autumn、Sunny、Max…）時，AI 回覆裡的那個單字不再一律被換成他的中文名
//   以前：AI 寫「an Autumn morning」→ 存檔裡變成「an 雨桐 morning」（英文介面看不出來，切回中文介面或拿去比對人名時才露出來）
//   現在：題目裡有提到那個人（找得到他的中文名或那個英文字）才換；「名 姓」兩個字的照舊一律換
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['en', 'zh']) {
    console.log(lang); const en = lang === 'en';
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    let chatReply = ''; const sent = [];
    await page.route('**/api/**', r => { const u = r.request().url(); if (/\/api\/chat/.test(u)) { try { sent.push(JSON.parse(r.request().postData() || '{}').prompt || ''); } catch (e) {} return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: chatReply }) }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/\/api\/me/.test(u) ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
    // 1) 換名規則本身（跟介面語言無關）
    const u = await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
      I18N.registerName('雨桐', 'Autumn'); const D = I18N.delocalizeNames; const text = 'An Autumn morning: Sunny skies, and Max laughed.';
      const npcs = Object.values(app.world.agents).filter(a => !a.isPlayer); const two = npcs.map(a => [a.name, I18N.localizeNames(a.name, true)]).find(x => / /.test(x[1])) || ['', ''];
      return { old: D(text), none: D(text, '季節：秋季。天氣晴。'), one: D(text, '今天馬強在廣場。'), enSrc: D(text, 'Villagers: Sunny, Hugo'), two, twoOut: two[0] ? D(two[1] + ' said hi.', '無關的題目') : null, empty: D('', 'x'), zhOnly: D('沒有英文', 'x') }; });
    ok(u.old === 'An 雨桐 morning: 蘇晴 skies, and 馬強 laughed.', '不帶題目呼叫：行為照舊（三個都換）', u.old);
    ok(u.none === 'An Autumn morning: Sunny skies, and Max laughed.', '題目沒提到這些人：Autumn、Sunny、Max 都當普通單字，不換', u.none);
    ok(u.one === 'An Autumn morning: Sunny skies, and 馬強 laughed.', '題目提到馬強：只有 Max 換回中文名', u.one);
    ok(u.enSrc === 'An Autumn morning: 蘇晴 skies, and Max laughed.', '題目裡是用英文名提到的（Sunny）：照樣認得、換回中文名', u.enSrc);
    ok(!u.two[0] || u.twoOut === u.two[0] + ' said hi.', '「名 姓」兩個字的英文名：題目沒提到也照舊換（不會跟普通單字撞）', { two: u.two, out: u.twoOut });
    ok(u.empty === '' && u.zhOnly === '沒有英文', '空字串、沒有英文的字串原樣回傳', u);
    // 2) 真的走一次 AI 呼叫
    chatReply = 'It was a Sunny Autumn day, and Max laughed with Hugo.';
    const g = await page.evaluate(async () => { const llm = window.rimtownApp.world.conversationEngine.llm; llm._canMakeRequest = () => true; llm._rateLimitedUntil = 0;
      const a = await llm.generate('今天馬強在廣場遇到張豪。請寫一句話。', 60, 0.5, true); return { a, lang: LLM_LANG.get(), provider: llm.provider }; });
    if (en) ok(g.a === 'It was a Sunny Autumn day, and 馬強 laughed with 張豪.', '英文模式實際呼叫：題目裡有的人（Max、Hugo）換回中文名，天氣和季節的單字不動', g);
    else ok(/Sunny Autumn day, and Max laughed with Hugo/.test(g.a || ''), '中文模式：回覆裡的英文不做人名轉換（照舊）', g);
    if (en) ok(/Max/.test(sent[sent.length - 1] || '') && /Hugo/.test(sent[sent.length - 1] || '') && !/馬強|張豪/.test(sent[sent.length - 1] || ''), '送出去的題目照舊把中文名換成英文名', (sent[sent.length - 1] || '').slice(0, 120));
    // 3) AI 日報（題目是中文、沒提到雨桐）
    if (en) { chatReply = '📰 "The Longest Day of Autumn, Day Twelve"\n\n🔥 Headline Report\n' + 'The square was loud all morning and nobody could agree on who started it. '.repeat(3) + 'Tomorrow will be just as noisy.';
      const p = await page.evaluate(async () => { const w = window.rimtownApp.world; const dn = w.dailyNews; const A = Object.values(w.agents).find(a => !a.isPlayer); dn.todayEvents = [{ category: 'event', content: '測試事件：廣場有人吵架', importance: 8, agents: [A.name] }]; dn._lastPublishDay = null; const paper = await dn.generateNewspaper(w); return (paper?.content || '').slice(0, 80); });
      ok(/The Longest Day of Autumn, Day Twelve/.test(p) && !/雨桐/.test(p), 'AI 日報標題裡的季節「Autumn」：存檔裡保持英文（以前會變成村民的中文名）', p); }
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
