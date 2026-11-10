// v9.16.1 跟村民聊天時,村民不再照著玩家的話開頭回答(鸚鵡學話):提示詞不引用玩家原句、明講不要複述;回覆開頭的複述剪掉
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); const w = app.world; const ce = w.conversationEngine; const out = {};
    try {
      const S = (a, b) => ce._stripEcho(a, b);
      out.cases = {
        a: S('你不是要找我聊天嗎？啊……對欸，我剛剛一直在想芝麻的事。', '你說不是我說你不是要找我聊天嗎？'),
        b: S('好啊，你說吧，我聽著呢。我心裡其實還掛著芝麻。', '好啊，你說'),
        keep1: S('好啊，一起去吃飯吧！', '要不要一起吃飯？'),
        keep2: S('今天天氣真好，我們去河邊走走。', '你在幹嘛'),
        short: S('好啊！', '好啊'),
        en: S('You wanted to chat with me? Oh, right, I was thinking about the harvest all morning.', "Didn't you want to chat with me?"),
      };
      const player = Object.values(w.agents).find(a => a.isPlayer) || w.agents.player; const npc = Object.values(w.agents).find(a => !a.isPlayer && !a.isDead);
      player.chatHistory = player.chatHistory || [];
      player.chatHistory.push({ speaker: npc.name, target: player.name, text: '要不要陪我聊聊天？我有點悶。' });
      const msg = '你說不是我說你不是要找我聊天嗎？';
      player.chatHistory.push({ speaker: player.name, target: npc.name, text: msg });
      const saved = ce.llm; let prompts = [];
      ce.llm = { provider: 'mock', _quota: null, generate: async (p) => { prompts.push(p); return '你不是要找我聊天嗎？啊……對欸，我剛剛一直在想芝麻跑去哪了，你有看到牠嗎？\nEFFECTS: {"affinity_change": 1, "romantic_change": 0, "summary": "聊芝麻"}'; } };
      let res; try { res = await ce.generatePlayerReply(player, npc, msg, w); } finally { ce.llm = saved; }
      const rules = prompts[0].slice(prompts[0].indexOf('【回覆規則】'));
      out.prompt = { noQuote: !rules.includes(msg.slice(0, 10)), anti: /不要重複或改寫對方剛說的話/.test(rules) };
      out.reply = res?.npc_reply;
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
    return out;
  });
  console.log(JSON.stringify(r));
  ok(!r.err, '跑完沒有例外', r.err);
  const c = r.cases || {};
  ok(c.a && c.a.startsWith('啊') && !c.a.includes('要找我聊天'), '開頭照抄玩家的問句會被剪掉', c.a);
  ok(c.b && !c.b.startsWith('好啊'), '開頭跟著說「好啊」會被剪掉', c.b);
  ok(c.keep1 === '好啊，一起去吃飯吧！' && c.keep2 === '今天天氣真好，我們去河邊走走。', '正常的回答不會被動到', { k1: c.keep1, k2: c.keep2 });
  ok(c.short === '好啊！', '整句只有一句時不剪（不會剪成空的）', c.short);
  ok(c.en && /^Oh, right/.test(c.en), '英文開頭的複述也剪掉', c.en);
  ok(r.prompt && r.prompt.noQuote && r.prompt.anti, '提示詞的規則裡不再引用玩家原句，並明講不要複述', r.prompt);
  ok(typeof r.reply === 'string' && !/要找我聊天嗎/.test(r.reply) && /芝麻/.test(r.reply), '實際聊天回覆不再以玩家的話開頭', r.reply);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
