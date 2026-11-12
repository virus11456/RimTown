// v9.23.2 用真模型驗證 AI 模式後修的三件事
// 1) 提示詞太長：伺服器超過 6000 字會從尾巴截掉，寫在最後的「只輸出 JSON」跟著不見，AI 改回一段散文 → 解析失敗、悄悄退回規則。
//    實測（線上 9.23.1、兩座 100 人的城鎮）：投票 55 次裡 50 次超過上限、42 次失敗。
//    → 前端：一次問好幾個人的題目（投票、選舉投票、決策核心）先把每個人的帳本收短到放得下；
//      伺服器：英文上限放寬到 18000 字（同樣內容英文字元數約三倍），超過時留頭留尾、不再砍掉結尾。
// 2) AI 的回覆被字數上限切斷：銀行家說「不借」但理由寫太長 → JSON 沒收尾 → 解析失敗 → 程式當成沒回答、照規則把錢借出去。
//    → 切斷的 JSON 也救得回來；放款的題目要求理由 20 字內。
// 3) 上游偶爾整段拒答（英文）：新增句型偵測，換另一個渠道重問。
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const path = require('path'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };

// ---------- A. 伺服器 /api/chat（不用瀏覽器） ----------
async function server() {
  console.log('— 伺服器 /api/chat');
  const libPath = path.join(__dirname, '..', 'api', '_lib.js');
  require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: {
    authUser: () => ({ u: 'Tester', id: 1 }), isBanned: async () => false, isAdmin: () => false, readJson: async () => null, writeJson: async () => {},
    err: (res, code, c, m) => { res.status(code); res.json({ code: c, message: m }); }, clientIp: () => '1.1.1.1', rateLimit: () => true } };
  process.env.LLM_BASE_URL = 'https://relay.example'; process.env.LLM_API_KEY = 'k'; process.env.GROQ_API_KEY = 'gsk';
  let relayText = '[{"n":1,"vote":"for","why":"好"}]', groqText = '[{"n":1,"vote":"against","why":"不好"}]'; let relayBody = null; const calls = [];
  const _warn = console.warn; console.warn = () => {};
  global.fetch = async (url, opts) => {
    if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile' }] }) };
    if (url.includes('groq.com')) { calls.push('groq'); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: groqText } }] }) }; }
    if (url.includes('relay.example')) { calls.push('relay'); relayBody = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: relayText }] }) }; }
  };
  const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
  const mkRes = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
  const ask = async (prompt, lang) => { calls.length = 0; relayBody = null; const res = mkRes(); await chat({ method: 'POST', headers: {}, body: { prompt, lane: 'chat', max_tokens: 300, lang } }, res); return res; };
  const sent = () => relayBody.messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n');
  const TAIL = '只輸出 JSON 陣列，每個元素 {"n":序號,"vote":"for"或"against","why":"理由"}，不要其他文字。';
  const zh = (n) => '你是模擬小鎮的村民決策引擎。HEADMARK ' + '村'.repeat(n) + '\n' + TAIL;
  await ask(zh(3000), 'zh'); ok(sent().includes('HEADMARK') && sent().includes(TAIL) && !sent().includes('\n…\n'), '中文 3000 字：原樣送出', sent().length);
  await ask(zh(7000), 'zh'); { const s = sent(); const body = s.slice(s.indexOf('你是模擬小鎮'));
    ok(s.includes('HEADMARK') && s.includes(TAIL), '中文 7000 字：開頭和結尾的格式要求都還在（以前結尾被砍掉）', [s.includes('HEADMARK'), s.includes(TAIL)]);
    ok(body.length <= 6000 && body.includes('\n…\n'), '中文 7000 字：收到 6000 字以內，中間收掉的地方有標記', body.length); }
  const TAIL_EN = 'Output only a JSON array, one element per villager: {"n":number,"vote":"for" or "against","why":"reason"}. No other text.';
  const en = (n) => 'You are the decision engine. HEADMARK ' + 'villager '.repeat(Math.ceil(n / 9)).slice(0, n) + '\n' + TAIL_EN;
  await ask(en(15000), 'en'); ok(sent().includes(TAIL_EN) && !sent().includes('\n…\n'), '英文 15000 字：原樣送出（以前跟中文共用 6000，會被砍掉六成）', sent().length);
  await ask(en(22000), 'en'); { const s = sent(); const body = s.slice(s.indexOf('You are the decision engine')); ok(s.includes('HEADMARK') && s.includes(TAIL_EN) && body.length <= 18000, '英文 22000 字：收到 18000 字以內，頭尾都在', body.length); }
  // 拒答 → 換渠道
  relayText = "I'm not going to produce this one: it asks me to act as the decision engine for a town-simulation game, but the output it wants is in-character villager decisions that I'd be writing as an AI, and I'm not going to do that here. I'm happy to help in other ways, like sketching villager profiles.";
  let r = await ask(zh(300), 'zh'); ok(r.body.provider === 'groq' && r.body.reply === groqText, '上游整段拒答（實測遇到的句型）→ 換另一個渠道重問', [r.code, r.body?.provider, calls]);
  relayText = '[{"n":1,"pick":"b","why":"I am not going to lend him money again."}]';
  r = await ask(en(300), 'en'); ok(r.body.provider === 'relay' && r.body.reply === relayText, '英文模式村民說「I am not going to lend…」不會被誤判成拒答', [r.body?.provider, calls]);
  console.warn = _warn;
}

// ---------- B. 前端 ----------
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function client(browser, lang) {
  console.log(`— 前端 ${lang}`); const en = lang === 'en';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d', '1'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 2, { seed: 22 }); const ce = w.conversationEngine; const out = {};
    ce.llm.generate = async () => '__ERROR__'; // 暖身期間不連線
    for (let d = 0; d < 20; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    w.fullAgentMode = true; app._fullAgentOn = () => true; ce.fullAgentOk = () => true;
    const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId)); const max = ce._promptMax(); out.max = max;
    // 把每個人的處境撐長：很多記憶、很多做過的決定（老鎮的樣子）
    const X = DECIDE.S(w); const long = (n) => { for (const a of npcs.slice(0, 12)) { for (let i = 0; i < n; i++) a.memory.add(w.tickCount, w.clock.timeStr, 'daily', '今天在市集跟' + npcs[(i * 7) % npcs.length].name + '為了一批木材的價錢吵了很久，最後各退一步，但我心裡還是不太痛快，回家後想了一整晚。'.repeat(5), 8, []); X.log[a.agentId] = Array.from({ length: 5 }, (_, i) => ({ d: w._absDay() - i, kind: 'pinch', id: 'endure', what: '咬牙撐過去', why: { raw: '跟人開口太難了，再撐幾天看看，等工資發下來再說，實在不行再想別的辦法' }, res: null, ai: 1 })); } };
    let cap = null; const seen = []; ce._askJsonRaw = async (p, mt) => { seen.push(p); if (/L900|=== 1\. /.test(p) || /鎮長選舉正在投票|election for (mayor|village chief|town)|is voting/i.test(p)) cap = { p, mt }; return null; }; const grab = async (f) => { cap = null; await f(); return cap || { p: seen[seen.length - 1] || '', mt: 0 }; };
    const P = w.proposals; const prop = { id: 'L900', kind: 'tax', title: '加稅到 15%', desc: '公庫快見底了，提議把稅從 10% 調到 15%。', cost: {}, proposerId: npcs[0].agentId, proposerName: npcs[0].name, newTax: 0.15 };
    const title = P.title, desc = P.desc; P.title = (p) => p.id === 'L900' ? p.title : title.call(P, p); P.desc = (p) => p.id === 'L900' ? p.desc : desc.call(P, p);
    const tailOk = (p) => /JSON/.test(p.slice(-260));
    const votersAll = (p, vs) => vs.every((a, i) => p.includes(`\n${i + 1}. `));
    const vs = npcs.slice(1, 7);
    cap = await grab(() => ce.decideVotes(w, prop, vs, npcs[0])); out.voteNormal = { len: cap.p.length, tail: tailOk(cap.p), all: votersAll(cap.p, vs) };
    long(14); const fullLen = (() => { const bs = vs.map(a => ce._agentBrief(w, a, npcs[0])); return bs.reduce((s, b) => s + b.mem.join('／').length, 0); })();
    cap = await grab(() => ce.decideVotes(w, prop, vs, npcs[0])); out.voteLong = { len: cap.p.length, tail: tailOk(cap.p), all: votersAll(cap.p, vs), full: fullLen, hasLedger: /【錢】|\[Money\]|Money/.test(cap.p) };
    // 選舉投票（8 人）
    const cands = npcs.slice(0, 3).map(a => ({ agentId: a.agentId, name: a.name, policyLabel: '減稅', speech: '我會讓大家的日子好過一點。' })); const ev = npcs.slice(3, 11);
    cap = await grab(() => ce.decideElectionVotes(w, cands, ev, false)); out.elect = { len: cap.p.length, tail: tailOk(cap.p), all: votersAll(cap.p, ev) };
    // 決策核心一次問 5 個人
    const K = DECIDE.KINDS.pinch; const list = npcs.slice(0, 40).map(a => { w.wallet.bal[a.agentId] = 2; const ctx = K.when(w, a) || {}; return { a, ctx, opts: (K.options(w, a, ctx) || []).filter(Boolean) }; }).filter(o => o.opts.length >= 2).slice(0, 5);
    const dp = DECIDE.prompt(w, K, list); out.decide = { n: list.length, len: dp.length, tail: /"t":"goal"/.test(dp.slice(-200)), all: list.every((o, i) => dp.includes(`=== ${i + 1}. `)) };
    // 修補被切斷的 JSON
    const pj = LLMClient.parseJson; const j1 = pj('{"lend":false,"why":"數目遠超我手上的50銀幣，連我銀行裡的29銀幣都不夠。我自己的錢也得留著'); const j2 = pj('[{"n":1,"vote":"for","why":"好"},{"n":2,"vote":"against","why":"太貴了，我'); const j3 = pj('```json\n[{"n":1,"pick":"a"},{"n":2,"pick":"z","do":"請客"}]\n```');
    out.json = { lendFalse: j1 && j1.lend === false, arr: Array.isArray(j2) && j2.length === 1 && j2[0].vote === 'for', fenced: Array.isArray(j3) && j3.length === 2, prose: pj('以下是六位村民的投票：1. 陳偉 贊成'), empty: pj('') };
    // 銀行家放款：理由限長；「不借」被切斷也算數
    { const src = String(BANK.lend); out.bank = { guide: t('一句理由，20 字內').length > 4 };
      const B = BANK.S(w); B.open = true; const banker = npcs.find(a => a.agentId === B.banker) || null; out.bank.hasBanker = !!banker;
      const borrower = npcs.find(a => a !== banker && !(B.loans || {})[a.agentId] && BIZ.vet(w, B, a).ok); let asked = null; out.bank.hasBorrower = !!borrower;
      ce._askJsonRaw = async (p, mt) => { asked = { p, mt }; return LLMClient.parseJson('{"lend":false,"why":"他身上只有一點錢，還欠著別人，收入又不穩定，借這麼多風險太大，我沒辦法放心把錢借出去，等他'); };
      const loans0 = Object.keys(B.loans || {}).length; const res0 = B.reserve; B.reserve = Math.max(B.reserve || 0, 500);
      try { BANK.lend(w, B, borrower, 90, '周轉'); } /* 景氣差時放款額會打折，給大一點才一定會問銀行家 */ catch (e) { out.bank.err = String(e); }
      await new Promise(r => setTimeout(r, 300));
      out.bank.asked = !!asked; out.bank.promptGuide = asked ? asked.p.includes(t('一句理由，20 字內')) : null; out.bank.mt = asked?.mt; out.bank.refused = Object.keys(B.loans || {}).length === loans0; }
    return out;
  });
  ok(r.max === (en ? 17000 : 5700), '提示詞上限：中文 5700、英文 17000（比伺服器的 6000／18000 留一點餘裕）', r.max);
  ok(r.voteNormal.len <= r.max && r.voteNormal.tail && r.voteNormal.all, '投票（6 人）：放得進上限、結尾有格式要求、六個人都在', r.voteNormal);
  ok((en || r.voteLong.full > r.max) && r.voteLong.len <= r.max && r.voteLong.tail && r.voteLong.all && r.voteLong.hasLedger, '每個人的處境很長時（老鎮）：帳本自動收短，還是放得進去、六個人都在', r.voteLong);
  ok(r.elect.len <= r.max && r.elect.tail && r.elect.all, '選舉投票（8 人）：同樣放得進去', r.elect);
  ok(r.decide.n >= 2 && r.decide.len <= r.max && r.decide.tail && r.decide.all, '決策核心一次問好幾個人：放得進去、每個人都在', r.decide);
  ok(r.json.lendFalse && r.json.arr && r.json.fenced && r.json.prose === null && r.json.empty === null, 'AI 回覆被切斷：物件救得回來、陣列留到最後一個完整的人；散文照樣算沒回答', r.json);
  ok(r.bank.asked && r.bank.promptGuide && r.bank.mt >= 140, '銀行家放款的題目要求理由 20 字內', r.bank);
  ok(r.bank.refused, '銀行家說「不借」但理由被切斷：照樣不借（以前解析失敗就照規則借出去）', r.bank);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  await server();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await client(browser, lang);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
