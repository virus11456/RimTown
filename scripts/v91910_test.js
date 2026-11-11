// v9.19.1 首頁「村民開始自己拿主意」一節（v9.19 大腦更新的完整介紹）
// 位置在「核心玩法」後面、章節導覽前面；改前改後對照、五個步驟、三種選擇、在遊戲裡哪裡看、做到哪（只有「錢的事」標成已上線）
// 英文版沒有殘留中文；桌機、平板、390px 手機都不超出畫面、沒有橫向捲動、字不小於 12px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    for (const [W, H, mob] of [[1280, 900, false], [820, 1100, false], [390, 844, true]]) {
      console.log(`${lang} ${W}px`);
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: false } : { saves: [] }) }));
      await page.addInitScript((lang) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_3d_quality', 'low'); }, lang);
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForSelector('#landing-decide', { timeout: 60000 }); await page.waitForTimeout(600);
      const r = await page.evaluate(() => {
        const S = document.getElementById('landing-decide'); const n = (sel) => S.querySelectorAll(sel).length; const sr = S.getBoundingClientRect();
        const kids = [...document.querySelectorAll('#landing-core, #landing-decide, .lp-chnav')].map(x => x.id || 'chnav');
        const over = [...S.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > sr.right + 1 || b.left < sr.left - 1 || e.scrollWidth > e.clientWidth + 1); }).map(e => e.className || e.tagName).slice(0, 5);
        const small = [...S.querySelectorAll('p, dd, dt, h3, h4, span, b')].filter(e => e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.className || e.tagName).slice(0, 5);
        const txt = S.textContent;
        return { order: kids, ba: n('.lp-ba > div'), now: n('.lp-ba .now'), steps: n('.lp-steps-5 .lp-step'), picks: n('.lp-picks li'), points: n('.lp-points > div'), prog: n('.lp-prog li'), done: [...S.querySelectorAll('.lp-prog li.done h4')].map(x => x.textContent.trim()),
          h2: S.querySelector('h2').textContent.trim(), over, small, txt, cjk: (txt.match(/[一-鿿]{2,}/g) || []),
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, lw: document.getElementById('landing').scrollWidth, lcw: document.getElementById('landing').clientWidth };
      });
      ok(r.order.join('>') === 'landing-core>landing-decide>chnav', '排在「核心玩法」後面、章節導覽前面', r.order);
      ok(r.h2 === (lang === 'zh' ? '村民開始自己拿主意' : 'Villagers now make up their own minds'), '標題', r.h2);
      ok(r.ba === 2 && r.now === 1, '以前／現在對照兩格', { ba: r.ba, now: r.now });
      ok(r.steps === 5, '五個步驟', r.steps);
      ok(r.picks === 3, '同一筆閒錢三種選擇', r.picks);
      ok(r.points === 3, '在遊戲裡哪裡看得到：三處', r.points);
      ok(r.prog === 3 && r.done.length === 2 && r.done[0] === (lang === 'zh' ? '錢的事' : 'Money') && r.done[1] === (lang === 'zh' ? '人際' : 'Relationships'), '做到哪了：三格，「錢的事」「人際」標成已上線（v9.20.0）；政治還沒做，不能寫成做完', { prog: r.prog, done: r.done });
      ok(lang === 'zh' ? /示意/.test(r.txt) : /illustrations/.test(r.txt), '三種選擇有標明是示意', null);
      ok(lang === 'zh' ? /每天最多 10 人/.test(r.txt) : /up to 10 people a day/.test(r.txt), '寫出 AI 每天最多決定 10 人（跟 sim-decide.js 的 AI_MAX 一致）', null);
      ok(!/憑空變多|守恆/.test(r.txt), '不說錢「守恆」（旅遊、外地讀書的錢會流到鎮外）', null);
      if (lang === 'en') ok(r.cjk.length === 0, '英文版沒有殘留中文', r.cjk.slice(0, 5));
      ok(r.over.length === 0, '沒有超出區塊或被截掉的內容', r.over);
      ok(r.small.length === 0, '字不小於 12px', r.small);
      ok(r.sw <= r.cw + 1 && r.lw <= r.lcw + 1, '沒有橫向捲動', { sw: r.sw, cw: r.cw, lw: r.lw, lcw: r.lcw });
      ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
      await ctx.close();
    }
  }
  // AI_MAX 真的是 10（首頁寫的數字跟程式一致）
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'chrome-extension', 'sim-decide.js'), 'utf8');
  ok(/AI_MAX\s*=\s*10\b/.test(src), 'sim-decide.js 的 AI_MAX 是 10', (src.match(/AI_MAX\s*=\s*\d+/) || [])[0]);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
