// v10.2.1 同一個人同時有兩件事在等 AI：兩件都要有下文
// 以前一個人只有一格「等 AI 回答」。他自己的事送去問 AI 之後，同一格又有人找上門，後到的把前一件蓋掉：
// 前一件的回答回來時對不上號，既不採用、也沒有改照個性決定，那件事沒有下文，AI 名額白用一次。
// 1) 用兩個測試專用的類別（自己的事＋別人找上門的事）排給同一個人：兩件都由 AI 的回答決定，名額算兩次、沒有落空
// 2) 兩件都在等的時候，再來第三件別人找上門的事、或同一類的事再來一次：照個性當場決定，不會沒下文
// 3) 等過夜還沒回話：兩件都改照個性決定，晚到的回答不算
// 4) 固定種子的小鎮跑幾天：每一件送去問 AI 的事，最後都有「決定了」或「事情過去了」
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load', timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  return { page, errs, ctx };
}
// 共用：固定亂數、建城、接一個假的 AI（回答先扣著，等測試放行；一律選每個人清單上的第一個選項）
const setup = () => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {}; app._showSeasonRecap = () => {}; app._showCornerNotice = () => {};
  let s = 7; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
  const T = window.__T = { ev: [], prompts: 0, gates: [], hold: true };
  DECIDE.observe((ev, o) => { T.ev.push({ ev, id: o.a?.agentId, kind: o.K?.key || o.kind || '', src: o.src || '', op: o.op ? String(o.op.id) : '' }); });
  const ce = w.conversationEngine; const llm = ce.llm; llm.generate = () => Promise.resolve('__ERROR__'); llm._quotaLow = () => false; llm._canMakeRequest = () => true;
  ce._askJson = async (prompt) => { if (!/"pick"/.test(String(prompt))) return null; T.prompts++;
    if (T.hold) await new Promise(r => T.gates.push(r));
    const blocks = String(prompt).split(/\n?=== \d+\. /).slice(1);
    return blocks.map((b, i) => { const m = b.match(/【可以選】\s*([^＝=\s]+)\s*[＝=]/); return { n: i + 1, pick: m ? m[1].trim() : 'a', why: '我自己想清楚了' }; }); };
  T.release = () => { const g = T.gates.splice(0); g.forEach(r => r()); };
  w.fullAgentMode = true; app._fullAgentOn = () => true;
  return { aiOn: DECIDE.aiOn(w) };
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---------- 1～3：測試專用的類別 ----------
  console.log('同一個人同時等兩件事');
  { const { page, errs, ctx } = await open(browser); const s0 = await page.evaluate(setup); ok(s0.aiOn, '假的 AI 接上了', s0);
    const r = await page.evaluate(async () => {
      const w = window.rimtownApp.world, T = window.__T; const X = DECIDE.S(w); const d = w._absDay(); const out = {}; const ran = [];
      const who = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16)[3]; const id = who.agentId; T.who = id;
      const opt = (k, tag) => [{ id: tag + 'A', text: { raw: k + '：做' }, base: 1, run: () => { ran.push(tag + 'A'); return { raw: '做了' }; } }, { id: tag + 'B', text: { raw: k + '：不做' }, base: 0, run: () => { ran.push(tag + 'B'); return { raw: '沒做' }; } }];
      // 自己的事（會被每天掃到的那種；這裡只讓這個人遇到，而且用 enqueue 直接排，不靠每天掃）
      DECIDE.kind('tOwn', { title: '測試：自己的事', cool: 99, pri: 0, scan: true, when: (w, a) => (a.agentId === T.who && T.ownOn ? { t: 1 } : null), facts: () => '你在想一件自己的事。', options: () => opt('自己的事', 'own') });
      DECIDE.kind('tAsk', { title: '測試：有人找上門', scan: false, facts: () => '有人來找你商量。', options: () => opt('找上門', 'ask') });
      DECIDE.kind('tAsk2', { title: '測試：又有人找上門', scan: false, facts: () => '又有人來找你。', options: () => opt('又找上門', 'ask2') });
      const evOf = (kind) => T.ev.filter(e => e.id === id && e.kind === kind).map(e => e.ev + (e.src ? ':' + e.src : ''));
      // 今天的名額從零算起（這個測試不靠每天掃）
      X.lastDay = d; X._asked = 0; X._kAsked = {}; const st0 = { ...X.st }; T.ev.length = 0; T.ownOn = true;
      DECIDE.enqueue(w, who, 'tOwn', { t: 1 }); DECIDE.drain(w, X, d);
      DECIDE.enqueue(w, who, 'tAsk', { from: 'x' }); DECIDE.drain(w, X, d);
      out.thinking = [evOf('tOwn'), evOf('tAsk')]; out.askedBefore = X._asked;
      // 兩件都在等：第三件別人找上門的事、同一類再來一次，都當場照個性決定
      DECIDE.enqueue(w, who, 'tAsk2', { from: 'y' }); DECIDE.drain(w, X, d);
      DECIDE.enqueue(w, who, 'tAsk', { from: 'z' }); DECIDE.drain(w, X, d);
      out.third = evOf('tAsk2'); out.dupNow = evOf('tAsk'); out.askedAfter3 = X._asked;
      await new Promise(r => setTimeout(r, 30)); T.release(); await DECIDE.flush(); await new Promise(r => setTimeout(r, 30)); T.release(); await DECIDE.flush();
      out.own = evOf('tOwn'); out.ask = evOf('tAsk'); out.ran = ran.slice(); out.st = { ai: X.st.ai - st0.ai, rule: X.st.rule - st0.rule, miss: X.st.aiMiss - st0.aiMiss }; out.prompts = T.prompts;
      out.log = (X.log[id] || []).filter(e => /^t(Own|Ask)/.test(e.kind)).map(e => e.kind + ':' + e.id + ':' + (e.ai ? 'ai' : 'rule'));
      // 3) 等過夜還沒回話
      T.ev.length = 0; ran.length = 0; X.lastDay = d; X._asked = 0; X._kAsked = {}; const st1 = { ...X.st };
      DECIDE.enqueue(w, who, 'tOwn', { t: 1 }); DECIDE.drain(w, X, d); DECIDE.enqueue(w, who, 'tAsk', { from: 'x' }); DECIDE.drain(w, X, d);
      const realDay = w._absDay; w._absDay = () => d + 1; T.ownOn = true; X.cool[id + '|tOwn'] = d + 99; /* 隔天不要又把同一件自己的事排一次，這裡只看昨天那兩件怎麼收 */ const kinds = Object.values(DECIDE.KINDS); const saved = kinds.map(K => K.when); kinds.forEach(K => { if (K.key !== 'tOwn' && K.scan) K.when = () => null; }); // 隔天：只看這兩件，不讓其他類別進來攪
      DECIDE.daily(w); kinds.forEach((K, i) => { K.when = saved[i]; });
      out.night = { own: evOf('tOwn'), ask: evOf('tAsk'), ran: ran.slice(), miss: X.st.aiMiss - st1.aiMiss };
      const n0 = T.ev.length; T.release(); await DECIDE.flush(); await new Promise(r => setTimeout(r, 30)); T.release(); await DECIDE.flush();
      out.late = T.ev.slice(n0).filter(e => e.id === id && /^t(Own|Ask)$/.test(e.kind) && e.src === 'ai').length; w._absDay = realDay;
      return out; });
    ok(r.thinking[0].join() === 'asked,thinking' && r.thinking[1].join() === 'asked,thinking' && r.askedBefore === 2, '兩件事都送去問 AI，名額算兩次', r.thinking);
    ok(r.own.includes('decided:ai') && r.ask.includes('decided:ai') && r.ran.includes('ownA') && r.ran.includes('askA'), '回答回來後，兩件都照 AI 的回答決定、真的執行（以前自己那一件沒有下文）', { own: r.own, ask: r.ask, ran: r.ran });
    ok(r.st.ai === 2 && r.st.miss === 0 && r.log.includes('tOwn:ownA:ai') && r.log.includes('tAsk:askA:ai'), '沒有落空的回答，兩筆都記在他的決定紀錄裡', { st: r.st, log: r.log });
    ok(r.third.includes('decided:rule') && r.dupNow.filter(x => x === 'decided:rule').length === 1 && r.askedAfter3 === 2, '兩件都在等的時候，再來第三件、或同一類再來一次：當場照個性決定，不多佔名額', { third: r.third, dup: r.dupNow, asked: r.askedAfter3 });
    ok(r.night.own.includes('decided:rule') && r.night.ask.includes('decided:rule') && r.night.miss === 2 && r.late === 0, '等過夜還沒回話：兩件都改照個性決定，晚到的回答不算', r.night);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 2)); await ctx.close(); }

  // ---------- 4：固定種子的小鎮跑幾天 ----------
  console.log('固定種子的小鎮跑 12 天（AI 隨問隨答）');
  { const { page, errs, ctx } = await open(browser); await page.evaluate(setup);
    const r = await page.evaluate(async () => {
      const w = window.rimtownApp.world, T = window.__T; T.hold = false; w.fullAgentMode = false; for (let i = 0; i < 96 * 6; i++) { w.paused = false; w.tick(); } w.fullAgentMode = true; T.ev.length = 0;
      for (let day = 0; day < 12; day++) { for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } await DECIDE.flush(); await new Promise(r => setTimeout(r, 0)); }
      await DECIDE.flush(); await new Promise(r => setTimeout(r, 20)); await DECIDE.flush();
      // 每一筆「送去問」之後，同一個人同一類要有一筆「決定了」或「事情過去了」
      const open = new Map(); let lost = 0; const lostEx = []; let thinking = 0, both = 0; const waiting = new Map();
      for (const e of T.ev) { const k = e.id + '|' + e.kind;
        if (e.ev === 'thinking') { thinking++; if (open.has(k)) { lost++; lostEx.push(k); } open.set(k, 1); const n = (waiting.get(e.id) || 0) + 1; waiting.set(e.id, n); if (n >= 2) both++; }
        else if (e.ev === 'decided' || e.ev === 'dropped') { if (open.has(k)) { open.delete(k); waiting.set(e.id, Math.max(0, (waiting.get(e.id) || 0) - 1)); } } }
      const X = DECIDE.S(w); return { thinking, left: [...open.keys()], lost, lostEx: lostEx.slice(0, 5), both, ai: X.st.ai, miss: X.st.aiMiss, prompts: T.prompts }; });
    console.log('   ', JSON.stringify(r));
    ok(r.thinking >= 20 && r.prompts >= 8, '這 12 天有足夠多的事送去問 AI', { thinking: r.thinking, prompts: r.prompts });
    ok(r.left.length === 0 && r.lost === 0, '每一件送去問 AI 的事最後都有下文（決定了，或事情過去了）', { left: r.left.slice(0, 6), lost: r.lost, ex: r.lostEx });
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 2)); await ctx.close(); }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
