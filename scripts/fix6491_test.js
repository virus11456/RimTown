// v6.50.0 完整智能體模式:提案十成由村民(AI)自己發想;系統偵測到的鎮況(依急迫度排序)當參考提示放進提示詞;沒有任何狀況時也能自己想
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }) /* v6.82.2 遊戲在 town.html(首頁不載遊戲) */; await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2000);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, P = w.proposals, eng = w.conversationEngine; app._setPaused?.(true);
      w.fullAgentMode = true; eng.fullAgentOk = () => true;
      const prompts = []; eng._askJson = async (p) => { prompts.push(p); return { skip: true }; };
      eng.chooseProposal = async () => { prompts.push('__CHOOSE__'); return null; };
      const day = P._abs(w);
      const reset = () => { P.items = P.items.filter(p => p.status !== 'open'); P.proposerCooldown = {}; };
      // 讓一位村民過得很慘 → 系統應該看到「救濟」之類的狀況
      const ag = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); ag[0].mood = 5; ag[1].mood = 8;
      let invent = 0, choose = 0, withHints = 0, topIn = 0, own = 0, ownHints = 0; const N = 20;
      // 9.28.2:有一部分提案請村民提「自己的點子」,那種題目不附鎮況(避免大家都去提同一件急事)
      const OWN = t('鎮上眼前的急事已經有人在處理了。這一次請提一件跟那些急事無關、屬於你自己的事：你的工作、你在乎的人、你的心願，或你一直想讓鎮上變得不一樣的地方。'); const isOwn = (p) => p.includes(OWN);
      for (let i = 0; i < N; i++) {
        reset(); const cands = P._candidates(w, day); const before = prompts.length;
        P._generate(w, day); await new Promise(res => setTimeout(res, 20));
        const mine = prompts.slice(before);
        const inv = mine.find(p => p !== '__CHOOSE__' && /JSON/.test(p) && /effects/.test(p));
        if (inv) { invent++; const hasHint = /\n- /.test(inv) || /\n1\. /.test(inv);
          if (isOwn(inv)) { own++; if (hasHint) ownHints++; }
          else { if (hasHint) withHints++;
            if (cands.length) { const top = cands.slice().sort((x, y) => y.weight - x.weight)[0].make(ag[0]); const tt = P._fill(top.tk, top.tp); if (inv.includes(String(tt).slice(0, 6))) topIn++; } } }
        if (mine.includes('__CHOOSE__')) choose++;
      }
      // 沒有任何候選狀況時:仍有機會自己想,且不會出錯
      const _c = P._candidates; P._candidates = () => []; let noCand = 0;
      for (let i = 0; i < 20; i++) { reset(); const b = prompts.length; P._generate(w, day); await new Promise(res => setTimeout(res, 10)); if (prompts.length > b) noCand++; }
      P._candidates = _c;
      return { invent, choose, withHints, topIn, own, ownHints, N, noCand, share: ProposalSystem.FREE_SHARE };
    });
    ok(r.share === 1, 'FREE_SHARE = 1', r.share);
    ok(r.invent === r.N && r.choose === 0, '20 次提案全部走 AI 自己發想,沒有走「從點子裡挑」', r);
    ok(r.withHints === r.N - r.own && r.withHints >= 6, '處理急事的那種題目,每次都附上系統看到的鎮況', r);
    ok(r.ownHints === 0, '請村民提自己點子的那種題目,不附鎮況', r);
    ok(r.topIn >= r.N - r.own - 2, '最急的狀況排在提示裡', r);
    ok(r.noCand > 0 && r.noCand < 20, '系統沒看到任何狀況時,村民偶爾還是會自己想', r.noCand);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
