// v9.23.5 其他 AI 功能接真模型後的修正：
//   1) 伺服器回覆長度上限 600→1600（每日行程、日報以前一律被壓到 600，寫到一半被切斷）
//   2) 被切斷的巢狀 JSON 救回寫完的部分（行程、對話結果）；對話結果只丟沒寫完的那一項
//   3) 聊完改行程：長度上限 350→500、要求寫短；每日行程一次 2 人、每人 650
//   4) AI 寫的句子太長時切在句子結尾（英文上限放寬），不再固定字數硬切；台詞前面重複的「名字：」拿掉
//   5) 題目裡的地點和動作用看得懂的名字（以前是 residential south、sleeping）
//   6) 跟村民聊天：首長本人知道自己是首長、去掉外層引號、英文句點結尾不再被砍、Oh／Ha 不當複述；許願的字數切法與英文長度
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };

async function server() {
  console.log('— 伺服器 /api/chat');
  const libPath = path.join(__dirname, '..', 'api', '_lib.js');
  require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: {
    authUser: () => ({ u: 'Tester', id: 1 }), isBanned: async () => false, isAdmin: () => false, readJson: async () => null, writeJson: async () => {},
    err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, clientIp: () => '1.1.1.1', rateLimit: () => true } };
  process.env.LLM_BASE_URL = 'https://relay.example'; process.env.LLM_API_KEY = 'k'; delete process.env.GROQ_API_KEY;
  let relayBody = null; const _warn = console.warn; console.warn = () => {};
  global.fetch = async (url, opts) => { if (url.includes('relay.example')) { relayBody = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"ok":true}' }] }) }; } return { ok: false, status: 500, json: async () => ({}) }; };
  const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
  const mkRes = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
  const ask = async (max) => { relayBody = null; const res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt: '你是小鎮的記者。', lane: 'background', max_tokens: max, lang: 'zh' } }, res); return relayBody?.max_tokens; };
  const a = await ask(1400), b = await ask(1200), c = await ask(5000), d = await ask(350), e = await ask(undefined);
  ok(a === 1400 && b === 1200, '每日行程（1400）、日報（1200）要多少給多少，不再壓到 600', [a, b]);
  ok(c === 1600, '超過 1600 的照樣封頂', c);
  ok(d === 350 && e === 300, '小的請求照舊（沒填預設 300）', [d, e]);
  console.warn = _warn;
}

const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function client(browser, lang) {
  console.log('— 前端 ' + lang); const en = lang === 'en';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d', '1'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 1, { seed: 7 }); const ce = w.conversationEngine; const out = {};
    ce.llm.generate = async () => '__ERROR__'; for (let d = 0; d < 3; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    while (w.clock.hour !== 10) { w.paused = false; w.tick(); }
    const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18); const [A, B, C2, D2, E2] = npcs; const P = LLMClient;
    // 1) 通用救法
    const plan = P.parseJson('{"plan": [{"time": "14:30", "text": "備料", "steps": ["清點食材", "切菜"]}, {"time": "16:00", "text": "幫忙準備晚餐", "steps": ["把湯底熬上火", "轉身找');
    const fxRaw = '{"affinity_change_a": 3, "affinity_change_b": -2, "romantic_change_a": 0, "romantic_change_b": 0, "summary": "兩人為了攤位吵了一架。", "memory_a": "他居然當著客人的面數落我", "memory_b": "我只是說了實話，她卻';
    const fx = P.repairJson(fxRaw);
    out.repair = { plan: plan && plan.plan && plan.plan.length === 2 && plan.plan[1].steps.length === 1 && plan.plan[1].text === '幫忙準備晚餐', fx: fx && fx.affinity_change_a === 3 && fx.affinity_change_b === -2 && fx.memory_a && !('memory_b' in fx), prose: P.parseJson('以下是行程說明，沒有 JSON'), flat: P.parseJson('{"lend":false,"why":"數目太大，我手上') };
    // 2) 切在句子結尾、拿掉名字
    const long = '韓俊宏破壞別人的工作本來就不對，雖然我跟他交情已經淡了，但我不想看著柯一帆白白吃虧，還是要把事情說出來讓大家知道。這樣才公平。再補一句很長很長的話讓它超過上限看看會怎麼切。';
    const longEn = 'Hank has always been fair to me, and I would rather swallow my pride than watch him take the blame for something that was never his doing in the first place. That is all there is to it, and I will say so in front of everyone who asks about it tomorrow.';
    const isEn = LLM_LANG.get() === 'en'; const c1 = P.clip(isEn ? longEn : long, 60);
    out.clip = { c1, len: c1.length, ends: /[。.]$/.test(c1), short: P.clip('很短', 60) === '很短', name: P.clip(isEn ? "Garrick's Golden Harvest Corner Stall and Sundries" : '石記百年老字號黃金豐收街角雜貨舖總店', 16, 40, true), noDots: !/…$/.test(P.clip(isEn ? "Garrick's Golden Harvest Corner Stall and Sundries" : '石記百年老字號黃金豐收街角雜貨舖總店', 16, 40, true)),
      un1: P.unname(A.name + '：各位鄉親，我會讓大家吃飽', A.name), un2: P.unname('**' + A.name + '**: 各位鄉親', A.name), un3: P.unname('「我看得出你是真心的。」', B.name), keep: P.unname('各位鄉親：我會讓大家吃飽', A.name) };
    try { const enName = I18N.localizeNames(A.name, true); out.clip.unEn = enName !== A.name ? P.unname(enName + ': I will keep everyone fed', A.name) : 'I will keep everyone fed'; } catch (e) { out.clip.unEn = String(e); }
    // 3) 村民對話：結果那一行被切斷
    { const relA = A.relationships.getOrCreate(B.agentId, B.name), relB = B.relationships.getOrCreate(A.agentId, A.name); const a0 = relA.affinity, b0 = relB.affinity; const m0 = A.memory.entries.length; let asked = null;
      ce.llm.generate = async (p, mt) => { if (asked) return '__ERROR__'; /* 對話之後接著觸發的改行程不算 */ asked = { p, mt }; return `${A.name}： 你今天又遲到了。\n${B.name}： 路上耽擱了一下。\nEFFECTS: {"affinity_change_a": -3, "affinity_change_b": -3, "romantic_change_a": 0, "romantic_change_b": 0, "summary": "${A.name}數落${B.name}遲到，氣氛很僵。", "memory_a": "他連句道歉都沒有", "memory_b": "我明明有說原因，她卻`; };
      w.logMessage = ((f) => function (ty, c, ...x) { if (ty === 'conversation') out.convLog = String(c); return f.call(this, ty, c, ...x); })(w.logMessage);
      await ce._llmConversation(A, B, w, relA, relB);
      const memA = A.memory.entries.slice(m0).map(m => m.content).join('|');
      out.conv = { mt: asked?.mt, brief: /30 字內|under 25 words/.test(asked?.p || ''), dA: relA.affinity - a0, dB: relB.affinity - b0, summary: /遲到/.test(out.convLog || ''), memA: /道歉都沒有/.test(memA), log: out.convLog }; }
    // 4) 聊完改行程：被切斷
    { let asked = null; ce._canReplan = () => true; C2.dailyPlan = { key: '', goals: [], blocks: [{ time: '08:00', text: '上工', steps: [] }] };
      ce.llm.generate = async (p, mt) => { asked = { p, mt }; return '{"plan": [{"time": "14:30", "text": "回店裡把帳對完", "steps": ["翻帳本", "點銀幣"]}, {"time": "18:00", "text": "去廣場找朋友", "steps": ["買兩串烤肉", "邊走邊'; };
      await ce.replanRestOfDay(C2, w, '剛跟朋友約了晚上見面');
      const blocks = C2.dailyPlan?.blocks || [];
      out.replan = { mt: asked?.mt, brief: /20 字內|under 15 words/.test(asked?.p || ''), n: blocks.length, has1430: blocks.some(b => b.time === '14:30' && /帳/.test(b.text)), has1800: blocks.some(b => b.time === '18:00' && b.steps.length === 1), kept: blocks.some(b => b.time === '08:00') }; }
    // 5) 每日行程：一次 2 人、每人 650
    { const seen = []; ce._planBusy = false; ce._planQueue = [A, B, C2, D2, E2].map(a => a.agentId); ce.llm._canMakeRequest = () => true; w.npcLlmUsedToday = 0;
      ce.llm.generate = async (p, mt) => { seen.push({ mt, names: [A, B, C2, D2, E2].filter(a => p.includes(a.name)).length, brief: /20 字內|under 15 words/.test(p) }); return '__ERROR__'; };
      await ce.tickPlanQueue(w); out.plans = { first: seen[0], left: ce._planQueue.length }; }
    // 6) 題目裡的地點和動作
    { let asked = null; w.townFeed = w.townFeed || { posts: [] }; w.townFeed._lastLlmPostTick = -99999; D2.currentLocation = 'residential_south'; D2.activity = 'sleeping';
      ce.llm.generate = async (p) => { asked = p; return '__ERROR__'; }; try { await ce.generateFeedPost(w, D2, true); } catch (e) { out.feedErr = String(e); }
      out.feed = { asked: !!asked, raw: /residential[ _]south|sleeping/.test(asked || ''), line: (String(asked || '').split('\n').find(l => /現在在|Currently at|is at|Now at/i.test(l)) || '').slice(0, 80) }; }
    // 8) 跟村民聊天（第二輪真模型驗證找到的）
    { const player = w.agents.player || Object.values(w.agents).find(a => a.isPlayer); const mName = typeof mayorNameOf === 'function' ? mayorNameOf(w) : ''; const M = npcs.find(a => a.name === mName), N = npcs.find(a => a.name !== mName); let asked = '';
      const FX = '\nEFFECTS: {"affinity_change": 1, "romantic_change": 0, "summary": "ok"}';
      const say = async (npc, msg, reply) => { player.chatHistory = []; ce.llm._canMakeRequest = () => true; ce.llm.generate = async (p) => { asked = p; return reply + FX; }; const r = await ce.generatePlayerReply(player, npc, msg, w); return r?.npc_reply; };
      out.chat = { hasMayor: !!M, mName };
      if (M) { await say(M, '你好', '你好啊。'); out.chat.self = /你自己就是現任|You yourself are the current/.test(asked); out.chat.selfNotOther = !asked.includes(t('現任鎮長是') + mName); }
      await say(N, '你好', '你好啊。'); out.chat.other = !mName || (asked.includes(mName) && !/你自己就是現任|You yourself are the current/.test(asked));
      out.chat.quote = await say(N, '你好，今天過得怎麼樣？', '「哈，還行啦！今天忙到腰都快斷了。」');
      out.chat.period = await say(N, 'What do you think of the mayor?', "Ha, you're asking me that straight out? Well, he is doing his best with a tough job. Me? I had my turn, and it ended badly.");
      out.chat.oh = await say(N, 'Hello! How has your day been?', 'Oh, hello there, traveler! Busy, but a good kind of busy.');
      out.chat.star = await say(N, 'What do you think of the mayor?', "*scratches the back of his neck and gives a rueful grin* She's a sharp one, I'll give her that. I *really* mean it.");
      out.chat.echo = await say(N, 'How has your day been?', 'How has my day been? well, busy as always, traveler.'); }
    // 9) 許願：AI 寫的標題、故事、反應太長
    { const S = WISH.S(w); S.busy = false; S.day = null; try { CALAMITY.S(w).power = 40; } catch (e) {} ce.llm._canMakeRequest = () => true; const isEn = LLM_LANG.get() === 'en';
      const story = isEn ? 'A painted wagon rolled through the gate at dawn, followed by jugglers, a clown, and a drum-beating strongman. The square filled with laughter, and for one afternoon every quarrel in town was forgotten. Then the rain came and everybody ran for the tavern, laughing all the way down the muddy road to the river.' : '一輛彩繪馬車在清晨駛進鎮口，後面跟著雜耍藝人、小丑和打鼓的大力士。廣場上笑聲不斷，這個下午鎮上所有的爭吵都被拋在腦後。後來下起雨，大家笑著一路跑進酒館，沿著泥濘的路一直跑到河邊，誰也沒有停下來。再多寫一句讓它超過上限。';
      const title = isEn ? 'The Wandering Circus Comes to Our Little Frontier Town at Dawn Today' : '流浪馬戲團在清晨來到我們這座邊境小鎮的廣場上表演了一整個下午';
      const _ask = ce._askJson; ce._askJson = async () => ({ title, icon: '🎪', story, effects: [{ type: 'mood', who: 'all', amount: 3 }], reactions: [{ name: A.name, line: isEn ? "Look at that clown juggling pies, I have not laughed like this in weeks and weeks, and honestly I thought I never would again after the harvest went so badly for all of us this year, so bless them." : '你看那個小丑在丟派，我好幾個禮拜沒這樣笑過了，說真的今年收成那麼差我還以為再也笑不出來了，真是老天保佑這些人願意來我們這種小地方表演給大家看。' }] });
      const r = await WISH.cast(w, isEn ? 'A wandering circus arrives and everyone forgets their troubles for one whole afternoon.' : '一個流浪馬戲團來到鎮上，大家暫時忘了煩惱。'); ce._askJson = _ask;
      const ev = r?.ev || {}; const txt = (x) => typeof x === 'string' ? x : (x?.p?.x || '');
      out.wish = { ok: !!r?.ok, ai: !!ev.ai, why: r?.why, max: WISH.MAXLEN, input: ev.text, title: txt(ev.title), story: txt(ev.story), react: ev.reactions?.[0]?.text || '' }; }
    // 7) 各功能都改用新的切法
    out.sites = {}; for (const [k, f] of Object.entries({ politics: typeof POLITICS !== 'undefined' ? POLITICS : null })) out.sites[k] = !!f;
    return out;
  });
  ok(r.repair.plan && r.repair.fx && r.repair.prose === null && r.repair.flat && r.repair.flat.lend === false, '被切斷的行程和對話結果：寫完的部分救回來，只丟沒寫完的那一小段；不是 JSON 的照樣算沒回答', r.repair);
  ok(r.clip.ends && r.clip.len <= (en ? 180 : 60) && r.clip.len >= 30 && r.clip.short, `太長的句子切在句子結尾（${en ? '英文上限放寬到三倍' : '中文 60 字'}），短的不動`, r.clip);
  ok(r.clip.name.length <= (en ? 40 : 16) && r.clip.noDots, '店名、作品名太長：切短但不加「…」', r.clip.name);
  ok(/^各位鄉親/.test(r.clip.un1) && r.clip.un2 === '各位鄉親' && r.clip.un3 === '我看得出你是真心的。' && /^各位鄉親：/.test(r.clip.keep) && r.clip.unEn === 'I will keep everyone fed', '台詞前面的「名字：」拿掉（中文名、英文名、粗體都認得）；不是名字的冒號不動', r.clip);
  ok(r.conv.mt === 600 && r.conv.brief, '村民對話：長度上限 600、題目要求寫短', r.conv);
  ok(r.conv.dA < 0 && r.conv.dB < 0 && r.conv.summary && r.conv.memA, '對話結果被切斷：好感變化、摘要、寫完的記憶照樣採用（以前整行作廢、好感改用亂數）', r.conv);
  ok(r.replan.mt === 500 && r.replan.brief, '聊完改行程：長度上限 500、題目要求寫短', r.replan);
  ok(r.replan.has1430 && r.replan.has1800 && r.replan.kept, '改行程的回覆被切斷：寫完的時段照樣排進去，原本已過的時段保留', r.replan);
  ok(r.plans.first && r.plans.first.mt === 1400 && r.plans.first.brief && r.plans.left === 3, '每日行程：一次問 2 人（排隊的 5 人剩 3 人）、長度上限 1400、題目要求寫短', r.plans);
  ok(r.feed.asked && !r.feed.raw, '社群貼文的題目：地點和動作用看得懂的名字（以前是 residential south、sleeping）', r.feed);
  ok(r.chat.hasMayor && r.chat.self && r.chat.selfNotOther && r.chat.other, '跟首長本人聊天：題目說「你自己就是現任首長」（以前只說現任首長是某某，本人會把自己當別人評論）；跟別人聊照舊交代現任是誰', r.chat);
  ok(r.chat.quote === '哈，還行啦！今天忙到腰都快斷了。', '整段回覆被引號包住：去掉外層引號', r.chat.quote);
  ok(/ended badly\.$/.test(r.chat.period || '') && /^Ha, you're/.test(r.chat.period || ''), '英文回覆以句點結尾：整段保留（以前被當成沒寫完，砍回前一個問號）', r.chat.period);
  ok(/^Oh, hello there/.test(r.chat.oh || ''), '英文回覆開頭的 Oh／Ha：不當成複述剪掉', r.chat.oh);
  ok(r.chat.star === "She's a sharp one, I'll give her that. I *really* mean it.", '英文回覆裡用星號包起來的動作描寫：拿掉（單字強調不動）', r.chat.star);
  ok(/^Well, busy as always/.test(r.chat.echo || ''), '真的在複述對方的話：照樣剪掉，剪完英文句首補回大寫', r.chat.echo);
  { const W = r.wish;
    ok(W.ok && W.ai && W.max === (en ? 160 : 60) && (!en || /afternoon\.$/.test(W.input)), `許願可以寫的長度：${en ? '英文 160 個字元（以前 60，一句話寫不完）' : '中文照舊 60 字'}`, { max: W.max, input: W.input, why: W.why });
    ok(W.title.length <= (en ? 60 : 20) && W.title.length >= 8 && !/…$/.test(W.title) && (!en || 'The Wandering Circus Comes to Our Little Frontier Town at Dawn Today'.split(' ').includes(W.title.split(' ').pop())), '許願的標題太長：切在單字邊界、不加「…」', W.title);
    ok(W.story.length <= (en ? 270 : 90) && /[。.!?！？…]$/.test(W.story) && W.react.length <= (en ? 180 : 60) && /[。.!?！？…]$/.test(W.react), '許願的故事和村民反應太長：切在句子或單字邊界（以前固定字數，英文會斷在單字中間）', { story: W.story, react: W.react }); }
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
function sources() {
  console.log('— 各功能的字數處理');
  const dir = path.join(__dirname, '..', 'chrome-extension'); const need = ['sim-politics', 'sim-culture', 'sim-dream', 'sim-bank', 'sim-diplo', 'sim-crown', 'sim-legacy', 'sim-mind', 'sim-epic', 'sim-aftermath', 'sim-ceremony', 'sim-biz', 'sim-things'];
  const miss = need.filter(f => !/LLMClient\.clip\(/.test(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
  ok(miss.length === 0, `${need.length} 個 AI 功能都改成切在句子結尾（不再固定字數硬切）`, miss);
  const bank = fs.readFileSync(path.join(dir, 'sim-bank.js'), 'utf8');
  ok(/_askJson\(prompt, 200\)/.test(bank) && (bank.match(/一句話，25 字內/g) || []).length === 2, '銀行利率與紓困的理由：題目要求一句話、紓困的長度上限放寬到 200（以前理由寫太長被切斷就拿不到）', null);
}
(async () => {
  await server(); sources();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await client(browser, lang);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
