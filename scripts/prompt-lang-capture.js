// 抓「送給 AI 的題目」：固定亂數種子開一座預設小鎮，先暖身幾天，再開著完整智能體模式跑幾天，
// 把每一筆送往 /api/chat 的請求內容（prompt、lane、lang、max_tokens）記成一行一筆的 JSONL。
// 只記請求內容（body）；請求標頭（裡面有登入憑證）不讀、不印、不存。
//
// 用法：node scripts/prompt-lang-capture.js <zh|en> <輸出.jsonl> [種子=11] [暖身天數=30] [天數=1]
//       node scripts/prompt-lang-capture.js --report <輸出.jsonl> [...]  # 依題目開頭分組，列出每組有多少中文字（有中文字就以結束碼 1 結束）
//       node scripts/prompt-lang-capture.js --diff <前.jsonl> <後.jsonl> # 逐筆比對兩份是否一字不差
// 環境變數：
//   REPLY=canned（預設）AI 一律回空字串，每次跑出來的題目一模一樣，用來做改動前後的比對
//   REPLY=openai         真的拿題目去問模型（經由本機代理的 api.openai.com），回覆會進記憶、再出現在後面的題目裡；
//                        每次結果不同，只用來看英文版有沒有漏網的中文
//   TOWN=harbor｜gen:<種子>  換一座鎮（預設邊境鎮）；TIER=0…5 指定城鎮等級
//   EXTRA=1              跑完後另外直接叫出「玩家動手才會送」的題目（跟村民聊天、耳語、真心話、事件感想、意圖判定、託夢、許願、王令…）
// 需要本機 8126 服務 chrome-extension/（cd chrome-extension && python3 -m http.server 8126）
const fs = require('fs'), path = require('path');
// 「中文」＝漢字（含注音、假名）。全形標點另外算：決策核心的題目用「／」「＝」當選項的分隔記號（題目裡明講要照抄「＝」前面的代號），那是格式不是中文。
const HAN = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\u3100-\u312f]/g, PUNCT = /[\u3000-\u303f\uff00-\uffef]/g, SEP = /[\uff0f\uff1d]/g;
const HAN_CTX = /[^\n]{0,24}[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\u3100-\u312f][^\n]{0,40}/g;
const hanCount = (s) => (String(s).match(HAN) || []).length;
const punctCount = (s) => (String(s).replace(SEP, '').match(PUNCT) || []).length;
const readL = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

if (process.argv[2] === '--report') {
  // 可以一次給好幾份；有任何一筆含中文字就以結束碼 1 結束
  const rows = process.argv.slice(3).flatMap(readL); const groups = new Map();
  for (const r of rows) { const k = String(r.prompt).replace(/\s+/g, ' ').replace(/["\u300c][^"\u300d]{1,24}["\u300d]/, '"…"').replace(/\d+/g, 'N').slice(0, 44); const g = groups.get(k) || { n: 0, han: 0, pun: 0, len: 0, bad: 0, ex: new Map() }; groups.set(k, g);
    const c = hanCount(r.prompt); g.n++; g.han += c; g.pun += punctCount(r.prompt); g.len += r.prompt.length; if (c) g.bad++;
    if (c) for (const m of String(r.prompt).matchAll(HAN_CTX)) { const x = m[0].trim(); g.ex.set(x, (g.ex.get(x) || 0) + 1); if (g.ex.size > 400) break; } }
  const list = [...groups.entries()].sort((a, b) => b[1].han - a[1].han || b[1].n - a[1].n);
  const bad = rows.filter(r => hanCount(r.prompt)).length, pun = rows.filter(r => punctCount(r.prompt)).length;
  console.log(`${rows.length} 筆請求，${bad} 筆含中文字；另有 ${pun} 筆含全形標點（不計「／」「＝」）；題目開頭 ${groups.size} 種`);
  for (const [k, g] of list) { if (!g.han && !process.env.ALL) continue; console.log(`[${g.bad}/${g.n} 筆含中文] 平均 ${Math.round(g.han / g.n)} 個中文字／${Math.round(g.len / g.n)} 字元  ${JSON.stringify(k)}`);
    for (const [x, n] of [...g.ex.entries()].sort((a, b) => b[1] - a[1]).slice(0, +process.env.N || 12)) console.log(`    ${n}× ${x}`); }
  if (!process.env.ALL && list.some(([, g]) => !g.han)) console.log(`（其餘 ${list.filter(([, g]) => !g.han).length} 種開頭沒有中文字；加 ALL=1 全部列出）`);
  process.exit(bad ? 1 : 0);
}
if (process.argv[2] === '--diff') {
  const A = readL(process.argv[3]), B = readL(process.argv[4]); let diff = 0;
  for (let i = 0; i < Math.max(A.length, B.length); i++) { const a = A[i], b = B[i];
    if (!a || !b || a.prompt !== b.prompt || a.lane !== b.lane || a.lang !== b.lang || a.max_tokens !== b.max_tokens) { diff++; if (diff <= 5) { const x = a?.prompt || '', y = b?.prompt || ''; let j = 0; while (j < x.length && x[j] === y[j]) j++; console.log(`第 ${i} 筆不同（第 ${j} 個字元起）：\n  前 ${JSON.stringify(x.slice(Math.max(0, j - 30), j + 60))}\n  後 ${JSON.stringify(y.slice(Math.max(0, j - 30), j + 60))}`); } } }
  console.log(`前 ${A.length} 筆、後 ${B.length} 筆，不同 ${diff} 筆`); process.exit(diff ? 1 : 0);
}

const { chromium } = require('playwright');
const LANG = process.argv[2] === 'en' ? 'en' : 'zh', OUT = process.argv[3] || path.join(__dirname, '..', 'test-results', `prompts-${LANG}.jsonl`);
const SEED = +(process.argv[4] || 11), WARM = +(process.argv[5] ?? 30), DAYS = +(process.argv[6] ?? 1);
const REPLY = process.env.REPLY || 'canned', EXTRA = process.env.EXTRA === '1';
const BASE = process.env.BASE || 'http://localhost:8126/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig'; // 假的登入憑證，只給本機假後端看

// REPLY=openai：用 curl 走本機代理（金鑰由代理補上，這裡只放一個假的；不印標頭、不印回應以外的東西）
const SYS = { en: 'You are the roleplay and text-generation engine for the simulation game RimTown. The user message is a game prompt: it names the villager you play, the scene and the required output format. Follow it exactly and output only what it asks for. Write only in natural English.',
  zh: '你是模擬遊戲《RimTown》的角色扮演與文字生成引擎。使用者訊息是遊戲提示詞，照做，只輸出提示詞要求的內容。一律繁體中文(台灣用語)。' };
async function askModel(prompt, maxTokens, lang) {
  const { execFile } = require('child_process');
  const body = JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', max_tokens: Math.min(1500, maxTokens || 500), temperature: 0.8, messages: [{ role: 'system', content: SYS[lang] || SYS.zh }, { role: 'user', content: prompt }] });
  return new Promise((resolve) => { const p = execFile('curl', ['-sS', '--max-time', '60', 'https://api.openai.com/v1/chat/completions', '-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer sk-dummy', '--data-binary', '@-'], { maxBuffer: 8e6 }, (err, out) => { try { resolve(JSON.parse(out).choices[0].message.content || ''); } catch (e) { resolve(''); } }); p.stdin.end(body); });
}

// LLMClient 那個類別、還有 _askJson／_askJsonRaw 在 sim-conversation.js 的第幾行到第幾行（從本機檔案讀；BASE 指到別的版本時行號可能差一點，site 只是參考）
function llmLines() { try { const L = fs.readFileSync(path.join(__dirname, '..', 'chrome-extension', 'sim-conversation.js'), 'utf8').split('\n'); const a = L.findIndex(x => /^class LLMClient/.test(x)) + 1; let b = L.length; for (let i = a; i < L.length; i++) if (/^}/.test(L[i])) { b = i + 1; break; } const q0 = L.findIndex(x => /^    async _askJson\(/.test(x)) + 1, q1 = L.findIndex(x => /^    _cap\(/.test(x)); return { LLM0: a, LLM1: b, ASK0: q0, ASK1: q1 }; } catch (e) { return { LLM0: 0, LLM1: 0, ASK0: 0, ASK1: 0 }; } }
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.exposeFunction('__askModel', (prompt, maxTokens, lang) => REPLY === 'openai' ? askModel(prompt, maxTokens, lang) : '');
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '1'); }, { jwt, lang: LANG });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  if (LANG === 'en') await page.evaluate(() => new Promise(r => I18N.ensureDict(r)));
  // EXTRA=1：玩家動手才會送的題目，模擬自己跑不到，這裡一個一個直接叫。每一個各自包起來，叫不動的記在 extraErr、不影響其他的。
  // 玩家打的字：英文介面用英文、中文介面用中文（玩家自己打的中文專有名詞不算漏網）
  if (EXTRA) await page.evaluate((SAY) => {
    window.__promptExtra = async (w, app, drain) => {
      const errs = []; const ce = w.conversationEngine; const player = w.agents.player || Object.values(w.agents).find(a => a.isPlayer);
      const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16).sort((x, y) => String(x.agentId).localeCompare(String(y.agentId)));
      const step = async (name, f) => { try { if (ce.llm) { ce.llm._rateLimitedUntil = 0; } await f(); } catch (e) { errs.push(name + ': ' + (e && e.message)); } await drain(); };
      const withTm = async (f) => { const tm = app.tileMap; try { return await f(); } finally { app.tileMap = tm; } };
      if (!player) return ['no player'];
      // 跟村民聊天：觀察者（旅人）與住在鎮上兩種身分都問，挑幾個不同的人
      for (const obs of [true, false]) { w.observerMode = obs; for (const npc of npcs.slice(0, 5)) await step('chat', () => ce.generatePlayerReply(player, npc, SAY.chat, w)); }
      // 兩個村民聊天的劇本：平常要剛好在玩家附近、又沒在冷卻才會問 AI，這裡直接叫幾組
      for (const [x, y] of [[0, 1], [2, 3], [4, 5]]) await step('talk', async () => { const A = npcs[x], B = npcs[y]; if (!A || !B) return; const r = await ce._llmConversation(A, B, w, A.relationships.getOrCreate(B.agentId, B.name), B.relationships.getOrCreate(A.agentId, A.name)); });
      w.observerMode = false;
      await step('whisper', () => ce.plantWhisper(player, npcs[0], SAY.whisper, w));
      for (const ev of (typeof HEART_EVENTS !== 'undefined' ? HEART_EVENTS : [])) await step('heart:' + ev.id, () => ce.fireHeartEvent(w, npcs[(HEART_EVENTS.indexOf(ev) + 1) % npcs.length], ev));
      await step('react', () => ce.reactToEvent(w, npcs[1], SAY.event, 'event'));
      await step('eventComment', () => ce.sendEventComment(w, SAY.event));
      await step('proactive', async () => { ce._lastNpcMsgTick = -99999; const r0 = Math.random; let k = 0; Math.random = () => (k++ === 0 ? 0 : r0()); try { await ce.tickProactiveMessages(w); } finally { Math.random = r0; } });
      await step('milestone', async () => { if (typeof LIFE_GOALS === 'undefined') return; if (w.townFeed) w.townFeed._lastLlmPostTick = -99999; const def = Object.values(LIFE_GOALS)[0]; await ce.narrateLifeMilestone(w, npcs[2], def, { stage: 0 }, false); if (w.townFeed) w.townFeed._lastLlmPostTick = -99999; await ce.narrateLifeMilestone(w, npcs[3], Object.values(LIFE_GOALS)[1] || def, { stage: 0 }, true); });
      await step('feed', async () => { if (w.townFeed) w.townFeed._lastLlmPostTick = -99999; await ce.generateFeedPost(w, npcs[4], true); });
      for (const kind of ['confession', 'wedding', 'busted', 'breakup', 'divorce', 'feud', 'severance', 'reconcile']) await step('drama:' + kind, () => ce.generateDramaScene(w, kind, {}, npcs[0], npcs[1], npcs[2].name));
      // 聊天意圖的 AI 判定、三天請託的台詞、提案人的說明（都在畫面那一層）
      for (const key of ['comfort', 'persuade', 'flirt', 'threaten']) await step('judge:' + key, async () => { app._judgeN = 0; app._judgeDay = null; await app._judgeIntent(npcs[0], key, SAY.chat); });
      await step('chainQuotes', async () => { const rb = w.requests; if (!rb || typeof REQUEST_CHAINS === 'undefined') return; const keep = rb.chain; try { for (const key of Object.keys(REQUEST_CHAINS)) { rb.chain = { key, npcId: npcs[0].agentId, npcName: npcs[0].name, targetName: npcs[1].name, step: 0 }; await app._aiChainQuotes(w); await drain(); } } finally { rb.chain = keep; } });
      await step('pitch', async () => { const ps = w.proposals; const list = (ps?.list || ps?.active || ps?.all?.() || []); const p = (Array.isArray(list) ? list : Object.values(list)).find(x => x && x.proposerId && w.agents[x.proposerId]); if (!p) return; p.pitch = null; app._pitchN = 0; await app._aiProposalPitch(w, p.id); });
      // 上帝之手：託夢、許願
      w.observerMode = true; w.fullAgentMode = true;
      await step('dream', async () => { if (typeof DREAM === 'undefined') return; const Sd = DREAM.S ? DREAM.S(w) : null; if (Sd) Sd.lastDream = -99; await DREAM.send(w, npcs[0].agentId, SAY.dream); });
      await step('wish', async () => { if (typeof WISH === 'undefined') return; const W = WISH.S(w); W.busy = false; W.day = -1; if (typeof FAITH !== 'undefined' && w.faith) { try { w.faith.power = 999; } catch (e) {} } await WISH.cast(w, SAY.wish); });
      // 後期制度：國王頒王令、新教派教義、銀行擠兌紓困（狀態湊不出來的就跳過）
      await step('decree', async () => { if (typeof CROWN === 'undefined' || !ce.decideDecree) return; await ce.decideDecree(w, npcs[0], { legit: 50 }, Object.keys(CROWN.DECREES)); });
      await step('votes', async () => { const ps = w.proposals; const list = (ps?.list || ps?.active || []); const p = (Array.isArray(list) ? list : Object.values(list)).find(x => x && x.id); if (!p) return; await ce.decideVotes(w, p, npcs.slice(0, 6), w.agents[p.proposerId] || npcs[0]); await ce.decideMayor(w, p, npcs[0], { yes: 5, no: 3 }); });
      await step('election', async () => { await ce.decideCampaign(w, npcs.slice(0, 3), ['farm', 'trade', 'safety'].map(k => ({ key: k, label: k })), false); await ce.decideElectionVotes(w, npcs.slice(0, 3), npcs.slice(3, 9), false); });
      return errs;
    };
  }, LANG === 'en'
    ? { chat: 'How have you been lately? Anything on your mind?', whisper: 'Someone in town secretly admires you.', event: 'A caravan arrived at the square this morning.', dream: 'Build something by the river and make peace with your rival.', wish: 'Let a gentle rain fall and the harvest be plentiful.' }
    : { chat: '最近過得怎麼樣？有什麼心事嗎？', whisper: '鎮上有人偷偷喜歡你。', event: '今天早上有一支商隊到了廣場。', dream: '到河邊蓋點什麼，並且跟你的對頭和好。', wish: '下一場溫柔的雨，讓今年豐收。' });
  const t0 = Date.now();
  const res = await page.evaluate(async ({ SEED, WARM, DAYS, REPLY, EXTRA, TRACE, TT, TOWN, TIER, LLM0, LLM1, ASK0, ASK1 }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    // 固定亂數與時鐘：只在「跑模擬」的那幾段換上，畫面自己的動畫不會吃到這串亂數
    const realRandom = Math.random, realNow = Date.now;
    let s = SEED >>> 0; const seeded = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let clk = 1700000000000; const fakeNow = () => (clk += 7);
    const on = () => { Math.random = seeded; Date.now = fakeNow; }, off = () => { Math.random = realRandom; Date.now = realNow; };
    // 假的 /api/chat：只記請求內容（不碰標頭）
    const cap = []; let phase = 'warm', pending = 0; const realFetch = window.fetch;
    const LLM_LINES = (n) => (n >= LLM0 && n <= LLM1) || (n >= ASK0 && n <= ASK1); // sim-conversation.js 裡 LLMClient 與 _askJson 這些「只負責送」的行
    window.fetch = function (url, opts) {
      if (typeof url === 'string' && url.indexOf('/api/chat') >= 0) {
        let b = {}; try { b = JSON.parse(opts.body); } catch (e) {}
        // site：是哪一行程式送出這一題（跳過 AI 連線本身那幾層），用來算「哪些出題的地方這次沒跑到」
        let site = ''; try { const fr = (new Error().stack || '').split('\n').slice(2).map(x => (x.match(/([\w-]+\.js):(\d+)/) || []).slice(1)).filter(x => x.length); const own = fr.find(x => !(x[0] === 'sim-conversation.js' && LLM_LINES(+x[1]))); if (own) site = own[0] + ':' + own[1]; } catch (e) {}
        const w = app.world; cap.push({ i: cap.length, phase, day: w?.clock?.day, time: w?.clock?.timeStr, lang: b.lang, lane: b.lane, max_tokens: b.max_tokens, site, prompt: String(b.prompt || '') });
        const mk = (reply) => ({ ok: true, status: 200, clone() { return this; }, json: async () => ({ reply }) });
        if (REPLY !== 'openai') return Promise.resolve(mk(''));
        pending++; const rec = cap[cap.length - 1]; return window.__askModel(String(b.prompt || ''), b.max_tokens, b.lang).then(r => { pending--; rec.reply = String(r || ''); return mk(r); }, () => { pending--; rec.reply = ''; return mk(''); }); // 真的問模型時把回覆也記下來（看有沒有回、格式對不對）
      }
      return realFetch.apply(this, arguments);
    };
    const drain = async () => { for (let k = 0; k < 400; k++) await Promise.resolve(); if (REPLY === 'openai') { for (let g = 0; g < 3000 && pending > 0; g++) await new Promise(r => setTimeout(r, 20)); for (let k = 0; k < 200; k++) await Promise.resolve(); } }; // 等真的回覆時時鐘不換回真的：遊戲裡的節流是拿兩次 Date.now() 相減，真假時鐘混著用會算出負的、之後整段不再問
    on();
    const w = new World(); app.world = w; let townNote = 'frontier';
    // TOWN：預設邊境鎮；harbor 這類內建主題；gen:<種子> 是隨機生成的鄰鎮（名字、地名、卡司都不同）。TIER：指定城鎮等級（越高時代越後面，會多出國王、外交、銀行這些題目）
    if (TOWN && TOWN !== 'frontier') {
      if (TOWN.startsWith('gen:')) { const c = TownGen.bySeed(+TOWN.slice(4) || 1); w.townTheme = c.key; w.townName = c.name; w.rosterMode = 'random'; w.reset(); ORIGIN.seed(w, TIER >= 0 ? TIER : (c.tier ?? c.size ?? 0), { seed: c.seed, pop: c.state?.pop, pros: c.state?.prosperity, era: c.state?.era || c.era, founded: c.founded }); townNote = c.name + '/' + c.key; }
      else { const th = TOWN_THEMES[TOWN]; w.townTheme = TOWN; w.townName = th.townName; w.rosterMode = 'scripted'; w.reset(); ORIGIN.seed(w, TIER >= 0 ? TIER : ORIGIN.sizeFor(th.townName, SEED), { seed: SEED }); townNote = th.townName; }
    } else { w.reset(); if (TIER >= 0) ORIGIN.seed(w, TIER, { seed: SEED }); }
    w.observerMode = true; app._buildLLMClient(); w.conversationEngine = app._makeConversationEngine();
    const tm0 = app.tileMap; app.tileMap = null; // 誰住哪一棟平常看地圖層的配置，而地圖是開頁面時用真亂數排的；跑的期間先拿掉地圖，改用村民自己記的住處，每次才會一樣
    const trace = [], stacks = []; const run = async (days, full) => { for (let d = 0; d < days; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.fullAgentMode = full; const tk = trace.length; if (TRACE && tk === TT) { Math.random = () => { stacks.push((new Error().stack || '').split('\n').slice(2, 5).map(x => x.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ')); return seeded(); }; } w.tick(); await drain(); if (TRACE && tk === TT) Math.random = seeded; if (TRACE) trace.push(s + ':' + cap.length); } };
    await run(WARM, false); const warmN = cap.length;
    phase = 'day'; await run(DAYS, true);
    let extraErr = [];
    if (EXTRA && typeof window.__promptExtra === 'function') { phase = 'extra'; try { extraErr = await window.__promptExtra(w, app, drain) || []; } catch (e) { extraErr = [String(e && e.stack || e)]; } }
    off(); window.fetch = realFetch; app.tileMap = tm0;
    return { cap, warmN, extraErr, trace, stacks, townNote, era: (() => { try { return w.research.currentEra(); } catch (e) { return '?'; } })(), day: w.clock.day, pop: Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length };
  }, { SEED, WARM, DAYS, REPLY, EXTRA, TRACE: process.env.TRACE === '1', TT: +(process.env.TRACE_TICK ?? -1), TOWN: process.env.TOWN || '', TIER: +(process.env.TIER ?? -1), ...llmLines() });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, res.cap.map(r => JSON.stringify(r)).join('\n') + '\n');
  if (res.trace.length) fs.writeFileSync(OUT + '.trace', res.trace.join('\n') + '\n'); // TRACE=1：每一格跑完時亂數走到哪、送了幾筆，兩次跑的結果不同時用來找從哪一格開始分岔
  if (res.stacks.length) fs.writeFileSync(OUT + '.stacks', res.stacks.join('\n') + '\n'); // TRACE_TICK=<第幾格>：那一格裡每次取亂數是誰叫的
  const bad = res.cap.filter(r => hanCount(r.prompt)).length;
  console.log(`${LANG}：${res.cap.length} 筆請求（暖身 ${res.warmN}、之後 ${res.cap.length - res.warmN}），含中文字 ${bad} 筆；${res.townNote} 時代 ${res.era} 人口 ${res.pop}；${Math.round((Date.now() - t0) / 1000)} 秒 → ${OUT}`);
  if (res.extraErr.length) console.log('extra 出錯：' + res.extraErr.slice(0, 5).join('\n'));
  if (errs.length) console.log('頁面錯誤：' + errs.slice(0, 5).join(' | '));
  await browser.close();
})();
