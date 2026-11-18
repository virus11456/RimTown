// 量測：四種城鎮（村、鎮、城、王都）各跑 N 天，記下舊路徑計數（globalThis.__old）與整體統計
// 用法：BASE=http://localhost:8190/ node measure.js [count|stats] [days=60] [reps=1] [out.json]
//   count：每種城鎮 不開 AI 60 天 → 存檔讀檔接著 20 天；另開一頁 假 AI（每題選第一個選項）60 天
//   stats：每種城鎮 不開 AI 60 天 × reps 次，只記統計
// 只連本機；所有 /api/** 攔掉回空的，其他非本機的請求一律擋掉
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8190/';
const MODE = process.argv[2] || 'count'; const DAYS = +(process.argv[3] || 60); const REPS = +(process.argv[4] || 1); const OUT = process.argv[5] || '';
const SEEDS = [9101, 9202, 9303, 9404]; const NAMES = ['村', '鎮', '城', '王都'];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const host = new URL(BASE).host;

async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = { page: [], error: [], warn: [] };
  page.on('pageerror', e => errs.page.push(String(e.message).slice(0, 300)));
  page.on('console', m => { const x = m.text(); if (m.type() === 'error') errs.error.push(x.slice(0, 300)); else if (m.type() === 'warning' && /^\[/.test(x)) errs.warn.push(x.slice(0, 300)); });
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== host) return r.abort(); if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }); return r.continue(); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 180000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 180000 }); await page.waitForTimeout(500);
  return { ctx, page, errs };
}

// 頁面裡：建鎮、裝上統計
async function setup(page, lv, seed, ai) {
  return page.evaluate(({ lv, seed, ai }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; globalThis.__old = {};
    w.reset(); w.observerMode = true; ORIGIN.seed(w, lv, { seed }); w.observerMode = true;
    const ce = w.conversationEngine; const X = window.__m = { ai, asks: 0, picks: 0, other: 0, seenOther: new Set(), ev: { married: 0, breakup: 0, divorce: 0, feud: 0 }, rel: new Map(), births0: 0, thefts0: 0, caught0: 0 };
    if (ai) {
      w.fullAgentMode = true; app._fullAgentOn = () => true; ce.fullAgentOk = () => !!w.fullAgentMode; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      // 假 AI：決策核心的題目每個人都回第一個選項；其他題目回 null（各系統照沒回話處理）
      ce._askJson = async (p) => { p = String(p); if (!p.includes('【可以選】')) { X.otherAsk = (X.otherAsk || 0) + 1; return null; } X.asks++;
        const out = []; const parts = p.split(/^=== (\d+)\. /m); for (let i = 1; i < parts.length; i += 2) { const n = +parts[i]; const L = parts[i + 1].split('\n').find(l => l.startsWith('【可以選】')); if (!L) continue; const code = L.slice('【可以選】'.length).split(' ／ ')[0].split('＝')[0].trim(); out.push({ n, pick: code, why: '量測用的回答' }); X.picks++; }
        return out; };
    } else { w.fullAgentMode = false; app._fullAgentOn = () => false; }
    X.births0 = (w.lifecycle?.births || []).length; return { pop: Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length, ai: typeof DECIDE !== 'undefined' ? DECIDE.aiOn(w) : null };
  }, { lv, seed, ai });
}

// 頁面裡：跑 n 天（每天讓非同步的 AI 回話有機會處理）
async function runDays(page, n) {
  for (let d0 = 0; d0 < n; d0 += 5) {
    const k = Math.min(5, n - d0);
    await page.evaluate(async (k) => {
      const w = window.rimtownApp.world; const X = window.__m;
      const pairs = () => { const m = new Map(); for (const a of Object.values(w.agents)) { if (a.isPlayer) continue; for (const r of Object.values(a.relationships?.relationships || {})) { if (a.agentId > r.targetId) continue; m.set(a.agentId + '|' + r.targetId, (r.status || '') + '/' + (r.isFeud ? 1 : 0)); } } return m; };
      for (let d = 0; d < k; d++) {
        const before = pairs(); const day0 = w._absDay();
        for (let j = 0; j < 400 && w._absDay() === day0; j++) { w.paused = false; w.tick(); }
        w.paused = true; await new Promise(r => setTimeout(r, 0)); try { if (typeof DECIDE !== 'undefined') await DECIDE.flush(); } catch (e) {}
        const after = pairs();
        for (const [key, v] of after) { const u = before.get(key) || '/0'; const [s0, f0] = u.split('/'); const [s1, f1] = v.split('/');
          if (s1 === 'married' && s0 !== 'married') X.ev.married++;
          if (s0 === 'dating' && s1 !== 'dating' && s1 !== 'married') X.ev.breakup++;
          if (s0 === 'married' && s1 !== 'married') { const [x, y] = key.split('|'); const A = w.agents[x], B = w.agents[y]; if (A && B && !A.isDead && !B.isDead) X.ev.divorce++; }
          if (f1 === '1' && f0 !== '1') X.ev.feud++; }
        const M = w.money; if (M?.days) for (const k2 of Object.keys(M.days)) if (+k2 < w._absDay() && !X.seenOther.has(k2)) { X.seenOther.add(k2); X.other += (+M.days[k2].other || 0); }
      }
    }, k);
  }
}

async function snap(page) {
  return page.evaluate(() => {
    const w = window.rimtownApp.world; const X = window.__m; const r1 = (n) => Math.round(n * 10) / 10;
    const live = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const bal = w.wallet?.bal || {}; let priv = 0; for (const k in bal) priv += (+bal[k] || 0);
    const st = { pop: live.length, births: (w.lifecycle?.births || []).length - X.births0, married: X.ev.married, breakup: X.ev.breakup + X.ev.divorce, feud: X.ev.feud,
      thefts: w.civic?.thefts || 0, caught: w.civic?.caught || 0, factions: Object.keys(w.factions?.factions || {}).length, treasury: r1(w.stockpile?.resources?.silver || 0), priv: r1(priv), other: r1(X.other), day: w._absDay(),
      dstats: typeof DECIDE !== 'undefined' ? DECIDE.stats(w) : null, asks: X.asks, picks: X.picks, otherAsk: X.otherAsk || 0, calam: !!w.calamity?.cur || (w.calamity?.hist || []).length, wc: !!w.worldcal?.cur || (w.worldcal?.hist || []).length, aftermath: (w.aftermath?.hist || []).length + (w.aftermath?.cur || []).length };
    if (st.dstats) st.dstats = { offer: st.dstats.offer, ai: st.dstats.ai, rule: st.dstats.rule, aiMiss: st.dstats.aiMiss };
    return { old: Object.assign({}, globalThis.__old || {}), st };
  });
}

async function saveLoad(page) {
  return page.evaluate(() => {
    const w = window.rimtownApp.world; const data = JSON.parse(JSON.stringify(w.serialize())); globalThis.__old = {};
    const ok = w.loadSave(data); w.observerMode = true; w.fullAgentMode = false; const oldAtLoad = Object.assign({}, globalThis.__old);
    window.__m.births0 = (w.lifecycle?.births || []).length; window.__m.ev = { married: 0, breakup: 0, divorce: 0, feud: 0 }; window.__m.other = 0; window.__m.seenOther = new Set(Object.keys(w.money?.days || {}).filter(k => +k < w._absDay()));
    return { ok: !!ok, oldAtLoad, wallet: !!w.wallet, on: typeof DECIDE !== 'undefined' ? DECIDE.on(w) : null };
  });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = []; const t0 = Date.now(); const log = (s) => process.stderr.write(`[${Math.round((Date.now() - t0) / 1000)}s] ${s}\n`);
  const save = () => { if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1)); };
  try {
    for (let lv = 0; lv < 4; lv++) { if (process.env.TOWN != null && +process.env.TOWN !== lv) continue;
      if (MODE === 'count') {
        { const { ctx, page, errs } = await openPage(browser); const s = await setup(page, lv, SEEDS[lv], false); log(`${NAMES[lv]} noAI pop ${s.pop}`);
          await runDays(page, DAYS); const a = await snap(page); log(`${NAMES[lv]} noAI done`);
          const L = await saveLoad(page); await runDays(page, 20); const b = await snap(page); log(`${NAMES[lv]} load+20 done`);
          res.push({ town: NAMES[lv], run: 'noAI', setup: s, ...a, errs: { page: errs.page.length, error: errs.error.length, warn: errs.warn.length, sample: [...errs.page, ...errs.error, ...errs.warn].slice(0, 8) } });
          res.push({ town: NAMES[lv], run: 'load+20', load: L, ...b });
          await ctx.close(); save(); }
        { const { ctx, page, errs } = await openPage(browser); const s = await setup(page, lv, SEEDS[lv], true); log(`${NAMES[lv]} fakeAI pop ${s.pop} aiOn ${s.ai}`);
          await runDays(page, DAYS); const a = await snap(page); log(`${NAMES[lv]} fakeAI done`);
          res.push({ town: NAMES[lv], run: 'fakeAI', setup: s, ...a, errs: { page: errs.page.length, error: errs.error.length, warn: errs.warn.length, sample: [...errs.page, ...errs.error, ...errs.warn].slice(0, 8) } });
          await ctx.close(); save(); }
      } else {
        for (let r = 0; r < REPS; r++) { const { ctx, page, errs } = await openPage(browser); const s = await setup(page, lv, SEEDS[lv], false);
          await runDays(page, DAYS); const a = await snap(page); log(`${NAMES[lv]} rep ${r} done`);
          res.push({ town: NAMES[lv], run: 'stats', rep: r, setup: s, st: a.st, old: a.old, errs: { page: errs.page.length, error: errs.error.length, sample: [...errs.page, ...errs.error].slice(0, 5) } });
          await ctx.close(); save(); }
      }
    }
  } finally { await browser.close(); }
  save(); console.log(JSON.stringify(res));
})();
