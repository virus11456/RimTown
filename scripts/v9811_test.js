// v9.8.1 聊天不再換句話重複:提示詞列出自己最近說過的話、玩家這句只出現一次;回覆跟自己最近說的話太像(換句話說)就重寫一次
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); const w = app.world; const CE = w.conversationEngine; const player = w.agents.player || Object.values(w.agents).find(a => a.isPlayer);
    const npc = Object.values(w.agents).find(a => !a.isPlayer); const _llm = CE.llm; const out = {};
    const prev = '旅人啊，你還問我怎麼不當鎮長了？哈哈，這話問得我心頭一緊，連昨晚都睡不踏實，一直在想趙霞的事……你要不要陪我去廣場看煙火？';
    const para = '旅人，你問我怎麼不當鎮長了？唉，這話問得我心裡一揪。我最近腦子亂得很，連昨晚都沒睡好，老是在想趙霞的事……你陪我去廣場看煙火好不好？';
    const fresh = '沒記錯啦，我是當過鎮長，只是去年選輸了。現在在哨站守夜，反而輕鬆一點。';
    player.chatHistory.push({ speaker: player.name, target: npc.name, text: '你怎麼不當鎮長了？', time: '' }, { speaker: npc.name, target: player.name, text: prev, time: '' });
    const msg = '對啊，還是我記錯人了？'; player.chatHistory.push({ speaker: player.name, target: npc.name, text: msg, time: '' });
    // 1. AI 先換句話重複一次 → 會被抓到、重寫
    const prompts = []; let n = 0; CE.llm = { provider: 'test', generate: async (p) => { prompts.push(p); n++; return n === 1 ? para + '\nEFFECTS: {"affinity_change": 1}' : fresh + '\nEFFECTS: {"affinity_change": 1}'; } };
    const reply = await CE.generatePlayerReply(player, npc, msg, w);
    out.calls = n; out.reply = JSON.stringify(reply).slice(0, 200); out.fresh = JSON.stringify(reply).includes('去年選輸了');
    out.hint = prompts[0].includes('你前面已經說過') && prompts[0].includes('不要把同樣的內容'); out.prevQuoted = prompts[0].includes('旅人啊，你還問我怎麼不當鎮長了');
    out.msgOnce = prompts[0].split(player.name + ': ' + msg).length - 1; out.retryHint = /不要重複，直接回應對方剛剛說的/.test(prompts[1] || '');
    // 2. 正常回答不會被誤判、不會多叫一次 AI
    n = 0; prompts.length = 0; player.chatHistory.push({ speaker: player.name, target: npc.name, text: '那你現在過得好嗎？', time: '' });
    CE.llm = { provider: 'test', generate: async (p) => { prompts.push(p); n++; return '還行吧，守夜雖然冷，但星星很漂亮。\nEFFECTS: {"affinity_change": 1}'; } };
    await CE.generatePlayerReply(player, npc, '那你現在過得好嗎？', w); out.normalCalls = n;
    CE.llm = _llm; return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.hint && r.prevQuoted, '提示詞列出村民自己最近說過的話，叫它不要換句話再說一次', r);
  ok(r.msgOnce === 1, '玩家剛說的那句只出現一次（以前出現兩次）', r);
  ok(r.calls === 2 && r.retryHint && r.fresh, 'AI 換句話重複上一句：抓到並重寫，玩家看到的是新的回答', r);
  ok(r.normalCalls === 1, '正常回答不會被誤判成重複', r);
  ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
