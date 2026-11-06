// v6.74.1 (1) 今天 AI 額度剩不到三成:背景功能(閒聊、完整智能體決策)改規則,事件卡反應與玩家聊天照常用 AI
// (2) 事件卡反應遇到每分鐘上限會等(最多一分鐘),真的叫不到才用預設台詞;同一張卡的預設台詞不重複
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  // 伺服器:v6.76.6 起登入玩家預設每日 5000 次;AI_USER_DAILY 可覆蓋(0 = 不限),回覆附上剩餘與上限
  const src = fs.readFileSync(path.join(__dirname, '../api/chat.js'), 'utf8');
  const m = src.match(/const USER_DAILY = (.*);/); const ud = (env) => (new Function('process', 'return ' + m[1]))({ env });
  ok(ud({}) === 5000 && /if \(limit > 0 && q\.count >= limit\)/.test(src), '伺服器：登入玩家預設每日 5000 次 AI', { USER_DAILY: ud({}) });
  ok(ud({ AI_USER_DAILY: '500' }) === 500 && ud({ AI_USER_DAILY: '0' }) === 0 && /limit: limit > 0 \? limit : null/.test(src), '伺服器：AI_USER_DAILY 可覆蓋（0 = 不限），並回傳剩餘與上限', null);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); const CE = w.conversationEngine; const out = {};
      const EC = w.eventCards; const playable = () => (EC.all?.() || EVENT_CARDS).map(c => c.id || c).filter(id => EC.canPlay?.(w, id)?.ok !== false);
      const waitDone = async (entry, ms) => { const t0 = Date.now(); while (entry.reactions.length < 3 && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 200)); };
      // (1) AI 前 4 秒被擋住 → 等到可以再叫,回覆是 AI 的
      const until = Date.now() + 4000; let calls = 0;
      CE.llm = { _canMakeRequest: () => Date.now() >= until, generate: async () => { calls++; return '這下可熱鬧了，我得去看看。'; } };
      const ids = playable(); EC.cooldown = {}; EC._todayCount = 0; let res = EC.play(w, ids[0]); const e1 = EC.played[EC.played.length - 1];
      await waitDone(e1, 20000);
      out.waited = calls >= 1 && e1.reactions.length && e1.reactions.every(x => !x.fb) && /熱鬧/.test(e1.reactions[0].text);
      // (2) 沒有 AI → 預設台詞,標 fb,同卡不重複
      CE.llm = null; EC.cooldown = {}; EC._todayCount = 0; const ids2 = playable().filter(id => id !== ids[0]); EC.play(w, ids2[0]); const e2 = EC.played[EC.played.length - 1];
      await waitDone(e2, 8000);
      out.fb = e2.reactions.length === 3 && e2.reactions.every(x => x.fb);
      out.noDup = new Set(e2.reactions.map(x => x.text)).size === e2.reactions.length || e2.reactions.length > 2;
      out.entryFb = (EC.toEntry(w, e2).reactions || []).every(x => x.fb);
      // (3) 額度剩不到三成:背景不放行、完整智能體決策改規則;玩家聊天與事件卡反應照常
      const L = new LLMClient(); const today = new Date().toISOString().slice(0, 10);
      L._quota = { remaining: 200, limit: 300, day: today }; out.okHigh = L._canMakeRequest(false) && L._canMakeRequest(true, true);
      L._quota = { remaining: 80, limit: 300, day: today }; out.bgBlocked = !L._canMakeRequest(false); out.playerOk = L._canMakeRequest(true) && L._canMakeRequest(true, true);
      const CE2 = new ConversationEngine(L); w.fullAgentMode = true; out.fullAgentRule = !CE2.fullAgentOk(w);
      L._quota = { remaining: 80, limit: 300, day: '2000-01-01' }; out.newDay = L._canMakeRequest(false) && CE2.fullAgentOk(w);
      // 伺服器回覆帶 remaining/limit 會被記下來;額度用完的 429 也會記成 0
      const _f = window.fetch; window.fetch = async () => new Response(JSON.stringify({ reply: 'hi', remaining: 50, limit: 300 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const L2 = new LLMClient(); try { await L2._callProvider('server', '', null, 'x', 10, 0.5, 'chat'); } catch (e) {} out.tracked = L2._quota?.remaining === 50 && L2._quotaLow();
      window.fetch = async () => new Response(JSON.stringify({ reply: 'hi', remaining: null, limit: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const L4 = new LLMClient(); await L4._callProvider('server', '', null, 'x', 10, 0.5, 'chat'); out.unlimited = !L4._quota && !L4._quotaLow() && L4._canMakeRequest(false);
      window.fetch = async () => new Response(JSON.stringify({ code: 'quota_exceeded', message: 'x' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      const L3 = new LLMClient(); L3._quota = { remaining: 200, limit: 300, day: today }; const rr = await L3._callProvider('server', '', null, 'x', 10, 0.5, 'chat'); out.exhausted = rr === '__RATE_LIMITED__' && L3._quota.remaining === 0;
      window.fetch = _f;
      out.ok = true; return out;
    });
    ok(r.waited, 'AI 一時被每分鐘上限擋住：事件卡反應會等，回覆仍是 AI 的', r);
    ok(r.fb && r.entryFb, '真的叫不到 AI 才用預設台詞', r);
    ok(r.okHigh && r.bgBlocked && r.playerOk && r.fullAgentRule && r.newDay, '額度剩不到三成：背景與決策改規則，玩家聊天與事件卡照常；換日就恢復', r);
    ok(r.tracked && r.exhausted, '有上限時：從伺服器回覆記下剩餘額度；額度用完也會記下', r);
    ok(r.unlimited, '沒有上限時：背景功能照常用 AI，不會被保留機制擋住', r);
    ok(r.noDup, '同一張卡的預設台詞不重複', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
