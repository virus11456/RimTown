// v9.28.1 決策核心沒有備用路：各系統的擲骰備用碼清掉了，每個選擇點只剩「本人決定」一條路。
// 驗：十個決策檔都有載入（網頁、離線快取、資料夾三邊一致）、每個選擇點都登記了、沒有開關能把決策核心關掉、
//     AI 沒開／額度用完／金鑰錯誤／AI 不回話／AI 答非所問時，每件事都照個性決定、沒有人卡住；AI 有回話時照 AI 的。
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const DIR = path.join(__dirname, '..', 'chrome-extension');
const FLAGS = ['soc', 'pol', 'life', 'work', 'share', 'fun', 'dark', 'crowd', 'love'];

(async () => {
  // ---------- 1) 檔案：資料夾、網頁、離線快取三邊一致 ----------
  console.log('— 檔案');
  const onDisk = fs.readdirSync(DIR).filter(f => /^sim-decide.*\.js$/.test(f)).sort();
  const html = fs.readFileSync(path.join(DIR, 'town.html'), 'utf8'); const sw = fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8');
  const inHtml = [...html.matchAll(/<script src="(sim-decide[^"]*\.js)"/g)].map(m => m[1]).sort();
  const inSw = [...sw.matchAll(/'\.\/(sim-decide[^']*\.js)'/g)].map(m => m[1]).sort();
  ok(onDisk.length === 10 && onDisk.join() === inHtml.join() && onDisk.join() === inSw.join(), '十個決策檔：資料夾裡有的，網頁都有載入、離線快取也都有列', { onDisk, inHtml, inSw });
  ok(html.indexOf('sim-decide.js') < html.indexOf('sim-decide-soc.js'), '決策核心本體排在各批選擇點之前載入', null);
  const src = {}; for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !/three|i18n/.test(f))) src[f] = fs.readFileSync(path.join(DIR, f), 'utf8');
  const gates = []; for (const [f, s] of Object.entries(src)) { const m = s.match(/\b(byShare|byChoice|byWork|byFun|byCrowd|byLife|byDark|_byLove)\b/g); if (m) gates.push(f + ':' + [...new Set(m)].join('/')); }
  ok(gates.length === 0, '各系統不再有「這件事交給本人還是擲骰」的分岔', gates);
  const reads = []; for (const [f, s] of Object.entries(src)) { const m = s.match(new RegExp('DECIDE\\.(' + FLAGS.join('|') + ')\\b(?! *= *true)', 'g')); if (m) reads.push(f + ':' + [...new Set(m)].join('/')); }
  ok(reads.length === 0, '沒有任何程式去讀「這一批有沒有載入」的記號來決定要不要擲骰', reads);
  const declared = new Set(); for (const f of onDisk) for (const m of src[f].matchAll(/\bkind\('([A-Za-z_]+)'/g)) declared.add(m[1]);

  // ---------- 2) 實際跑 ----------
  console.log('— 實際跑');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async ({ FLAGS }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const ce = w.conversationEngine;
    for (let d = 0; d < 3; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    app._fullAgentOn = () => w.fullAgentMode;
    const X = DECIDE.S(w); const K = DECIDE.KINDS;
    out.flags = Object.fromEntries(FLAGS.map(f => [f, DECIDE[f] === true]));
    out.kinds = Object.keys(K).sort();
    out.shape = Object.values(K).filter(k => !(k.title && typeof k.options === 'function' && typeof k.facts === 'function' && (!k.scan || typeof k.when === 'function') && k.cool >= 0 && k.pri > 0)).map(k => k.key);
    // 沒有開關：把每一批的記號都關掉，決策核心照樣在、每天照樣問、照樣有人拿主意
    const st = () => ({ offer: X.st.offer, ai: X.st.ai, rule: X.st.rule, miss: X.st.aiMiss || 0 });
    const d = (a, b) => ({ offer: b.offer - a.offer, ai: b.ai - a.ai, rule: b.rule - a.rule, miss: b.miss - a.miss });
    const today = () => { X.cool = {}; X.q = []; X.lastDay = -1; DECIDE.daily(w); };
    const day = async (setup) => { const s0 = st(); setup?.(); today(); await DECIDE.flush(); await DECIDE.flush(); const r = d(s0, st()); const s1 = st(); /* 隔天再跑一次：昨天問 AI 沒下文的人會被算進「沒回話」，沒有的話就是沒有人卡住 */ X.lastDay = -1; const sv = ce.fullAgentOk; const fm = w.fullAgentMode; w.fullAgentMode = false; X.cool = Object.fromEntries(Object.values(w.agents).flatMap(a => Object.keys(K).map(k => [a.agentId + '|' + k, w._absDay() + 9]))); DECIDE.daily(w); r.stuck = (X.st.aiMiss || 0) - s1.miss; w.fullAgentMode = fm; ce.fullAgentOk = sv; X.cool = {}; return r; };
    out.on0 = DECIDE.on(w);
    for (const f of FLAGS) DECIDE[f] = false;
    out.onOff = DECIDE.on(w); out.off = await day();
    for (const f of FLAGS) DECIDE[f] = true;
    // AI 沒開
    out.noAi = await day();
    // 以下都是「完全智能體」開著
    const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let asked = 0;
    w.fullAgentMode = true;
    // 額度用完（或冷卻中）：不問 AI
    ce.fullAgentOk = () => false; ce._askJson = async () => { asked++; return null; }; asked = 0; out.quota = await day(); out.quota.asked = asked;
    // 金鑰錯誤：問了就出錯
    ce.fullAgentOk = () => true; ce._askJson = async () => { asked++; throw new Error('401 invalid api key'); }; asked = 0; out.keyErr = await day(); out.keyErr.asked = asked;
    // AI 不回話
    ce._askJson = async () => { asked++; return null; }; asked = 0; out.silent = await day(); out.silent.asked = asked;
    // AI 答非所問：不是清單、或選了不存在的選項
    ce._askJson = async () => { asked++; return { hello: 'world' }; }; asked = 0; out.junk = await day(); out.junk.asked = asked;
    ce._askJson = async () => { asked++; return [1, 2, 3, 4, 5].map(n => ({ n, pick: 'no-such-option', why: 'x' })); }; asked = 0; out.wrong = await day(); out.wrong.asked = asked;
    // AI 有回話：照 AI 的（每題選第一個選項）
    ce._askJson = async () => { asked++; return [1, 2, 3, 4, 5].map(n => ({ n, pick: 'a', why: 'T-WHY' })); }; asked = 0; out.ai = await day(); out.ai.asked = asked;
    out.aiWhy = Object.values(X.log).flat().some(e => e.ai && e.why?.raw === 'T-WHY');
    out.max = DECIDE.AI_MAX;
    ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;
    // 照常跑三天沒有錯誤、沒有排著沒人處理的事
    let err = null; try { for (let dd = 0; dd < 3; dd++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
    out.days = { err, q: X.q.length };
    return out;
  }, { FLAGS });
  await ctx.close(); await browser.close();

  ok(Object.values(r.flags).every(Boolean), '九批選擇點都有載入', r.flags);
  const missing = [...declared].filter(k => !r.kinds.includes(k)); const extra = r.kinds.filter(k => !declared.has(k));
  ok(declared.size >= 70 && missing.length === 0 && extra.length === 0, `程式裡寫的 ${declared.size} 個選擇點全部登記了，一個不少`, { n: r.kinds.length, missing, extra });
  ok(r.shape.length === 0, '每個選擇點都有標題、事實、選項（每天會掃的還有「什麼時候問」）', r.shape);
  ok(r.on0 && r.onOff, '決策核心一直在運作；把每一批的記號都關掉也關不掉它', { on0: r.on0, onOff: r.onOff });
  const full = (x) => x.offer >= 5 && x.rule === x.offer && x.ai === 0;
  ok(full(r.off), '記號全關：每天照樣問、每件事都有人照個性決定', r.off);
  ok(full(r.noAi), 'AI 沒開：每件事都照個性決定，一件不漏', r.noAi);
  ok(full(r.quota) && r.quota.asked === 0, 'AI 額度用完：不去問 AI，每件事都照個性決定', r.quota);
  const fell = (x) => x.offer >= 5 && x.ai === 0 && x.rule > 0 && x.rule >= x.offer - r.max && x.asked >= 1 && x.stuck === 0;
  ok(fell(r.keyErr), '金鑰錯誤：問 AI 出錯的那幾件改照個性決定，沒有人卡著等', r.keyErr);
  ok(fell(r.silent), 'AI 不回話：那幾件改照個性決定，沒有人卡著等', r.silent);
  ok(fell(r.junk) && r.junk.miss >= 1, 'AI 回的不是清單：那幾件改照個性決定', r.junk);
  ok(fell(r.wrong) && r.wrong.miss >= 1, 'AI 選了不存在的選項：那幾件改照個性決定', r.wrong);
  ok(r.ai.ai >= 1 && r.ai.ai <= r.max && r.ai.asked >= 1 && r.aiWhy && r.ai.rule + r.ai.ai >= r.ai.offer - r.max && r.ai.stuck === 0, 'AI 有回話：照 AI 選的做、記下 AI 的理由；一天問 AI 的件數有上限，其餘照個性', r.ai);
  ok(!r.days.err && r.days.q === 0, '照常跑三天沒有錯誤，沒有排著沒人處理的事', r.days);
  ok(errs.length === 0, '沒有程式錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
