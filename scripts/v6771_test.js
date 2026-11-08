// v6.77.1 首頁改寫(v6.98.0 起特色改成 8 段介紹、主視覺改 3D、拿掉截圖牆與「小鎮的一天」):怎麼玩／小鎮裡會自己長出什麼／AI 與金鑰三段都在;過時說法(五座城鎮、玩家附近、玩家不能填金鑰、事件卡是唯一能做的)不再出現;
// 英文版沒有殘留中文;桌機與 390px 手機沒有橫向捲動
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
      console.log(`${lang} ${W}px`);
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: false } : { saves: [] }) }));
      await page.addInitScript((lang) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_3d_quality', 'low'); }, lang);
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForSelector('#landing-howto', { timeout: 60000 }); await page.waitForTimeout(800);
      const r = await page.evaluate(() => {
        const L = document.getElementById('landing'); const C = L.cloneNode(true); C.querySelector('#landing-log')?.remove(); const txt = C.textContent;
        const n = (sel) => document.querySelectorAll(sel).length;
        return { howto: n('#landing-howto .landing-step'), feats: n('#landing-features .lp-band'), ai: n('#landing-ai .landing-card'),
          h2: [...L.querySelectorAll('h2')].map(x => x.textContent.trim()), txt, cjk: (txt.match(/[一-鿿]{2,}/g) || []).filter(s => s !== '邊境鎮' && s !== '中文'),
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, lw: L.scrollWidth, lcw: L.clientWidth,
          reg: !!document.getElementById('landing-register') && !!document.getElementById('landing-login'),
          lp: { stats: n('.lp-stats li'), day: n('.lp-day li'), gallery: [...document.querySelectorAll('.lp-gallery img')].map(i => i.getAttribute('src')), tiers: n('.lp-tiers li'), faq: n('.lp-faq details'), final: n('.lp-final [data-lp-go]'), hero: !!document.querySelector('.lp-hero .lp-sky') && !!document.querySelector('.lp-hero #lp-stage') } };
      });
      ok(r.howto === 4 && r.feats === 10 && r.ai === 2, '怎麼玩 4 步、玩法 10 段(v7.7.1 加身體與醫療、神話基因)、AI 與金鑰 2 則(v6.78.1 起沒有自備金鑰)', { howto: r.howto, feats: r.feats, ai: r.ai });
      ok(r.reg, '未登入時有註冊／登入按鈕', r.reg);
      ok(r.lp.hero && r.lp.stats === 6 && r.lp.day === 0 && r.lp.tiers === 4 && r.lp.faq === 6 && r.lp.final === 2, '首頁各區：主視覺、數字、成長路線、常見問題、頁尾按鈕(v6.98.0 拿掉「小鎮的一天」)', r.lp);
      ok(r.lp.gallery.length === 0, 'v6.98.0 不再放截圖牆（畫面減量）', r.lp.gallery);
      const stale = lang === 'zh'
        ? /五座城鎮、近百位|玩家附近|你唯一能做的|看顧小鎮的觀察者/
        : /five towns|near the player|cannot enter their own key|only thing you can do/i;
      ok(!stale.test(r.txt), '沒有過時的說法', (r.txt.match(stale) || [])[0]);
      ok(lang === 'zh' ? !/自己的 Claude、GPT 或 Gemini 金鑰/.test(r.txt) && /Claude 不能用才換 GPT/.test(r.txt) : !/own Claude, GPT or Gemini key/.test(r.txt) && /GPT only if Claude/.test(r.txt), 'AI 段落：全部用內建 AI(Claude → GPT → Groq)，不再有自備金鑰', null);
      ok(lang === 'zh' ? /邀請碼/.test(r.txt) : /invite code/i.test(r.txt), '頁尾提到註冊需要邀請碼', null);
      if (lang === 'en') ok(!r.cjk.length, '英文版沒有殘留中文', r.cjk.slice(0, 5));
      ok(r.sw <= r.cw && r.lw <= r.lcw + 1, '沒有橫向捲動', { sw: r.sw, cw: r.cw, lw: r.lw, lcw: r.lcw });
      ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
