// v6.78.0 今晚八點檔:日報 › 日誌最上面是一集旁白(依幕分段＋下集預告)，換日定稿、可翻上一集／下一集；
// 村民對話與逐筆紀錄收進預設收起的摺疊區，技能升級合併成一行；存讀檔保留集數、重設清空；
// 有 AI 時每天最多改寫一次(算在背景額度)，AI 回空白就用規則版；英文版沒有殘留中文；手機 390px 不溢出
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const AI_ZH = '春天的風吹過邊境鎮，看似平靜，卻有人整夜睡不著。\n\n今晚的重頭戲，就在鎮公所門口上演，大家都在等鎮長的一句話。\n\n下集預告：誰會先低頭？敬請鎖定明晚八點。';
const AI_EN = 'A spring wind swept through Frontier Town. It looked calm, yet someone could not sleep.\n\nTonight the drama played out at the town hall, where everyone waited on the mayor.\n\nNext time: who will blink first? Same time tomorrow night.';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
      console.log(`${lang} ${W}px`);
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      let aiOn = false, aiCalls = 0;
      await page.route('**/api/**', r => {
        const u = r.request().url(); const body = r.request().postData() || '';
        if (u.includes('/api/me')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logged_in: true, user: { id: 1, username: 'tester' } }) });
        const ep = /八點檔連續劇的旁白|prime-time TV drama/.test(body); if (ep) aiCalls++;
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saves: [], success: true, reply: ep && aiOn ? (lang === 'en' ? AI_EN : AI_ZH) : '' }) });
      });
      await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
      await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2000);
      // 跑兩天多(AI 回空白：規則版)
      const r1 = await page.evaluate(() => {
        const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
        const d0 = w._absDay(); for (let i = 0; i < 96 * 4 && w._absDay() - d0 < 2; i++) { w.paused = false; try { w.tick(); } catch (e) {} }
        for (let i = 0; i < 40; i++) { w.paused = false; try { w.tick(); } catch (e) {} } w.paused = true;
        const tagged = (w.messageLog || []).slice(-50).every(m => typeof m.d === 'number');
        return { d0, now: w._absDay(), eps: (w.episodes || []).map(e => e.day), tagged };
      });
      ok(r1.eps.length >= 2 && r1.eps.includes(r1.d0) && r1.tagged, '換日時把每一天定稿成一集、日誌帶日期', r1);
      await page.evaluate((mob) => { const app = window.rimtownApp; app.state = app.world.getState(); if (mob && app._openKairoTab) app._openKairoTab('records'); else { document.querySelector('.rt-sidebar-tabs > button[data-tab="records"]')?.click(); app.activeTab = 'records'; } app.renderSidebar(); }, mob);
      await page.waitForTimeout(300);
      const card = async () => page.evaluate(() => {
        const c = document.querySelector('.ep-card'); if (!c) return null;
        const r = c.getBoundingClientRect();
        return { show: c.querySelector('.ep-show')?.textContent || '', live: c.classList.contains('live'), title: c.querySelector('.ep-title')?.textContent || '', paras: c.querySelectorAll('.ep-p').length, tags: [...c.querySelectorAll('.ep-tag')].map(x => x.textContent.trim()),
          next: c.querySelector('.ep-next')?.textContent || '', ai: !!c.querySelector('.ep-ai'), text: c.textContent, prevDis: c.querySelectorAll('.ep-btn')[0]?.disabled, nextDis: c.querySelectorAll('.ep-btn')[1]?.disabled,
          w: Math.round(r.width), sw: c.scrollWidth, cw: c.clientWidth,
          folds: [...document.querySelectorAll('.log-fold')].map(d => ({ open: d.open, s: d.querySelector('summary')?.textContent || '' })),
          skillRows: [...document.querySelectorAll('.log-messages-section .log-entry.type-skill_up')].length, first: document.querySelector('#sidebar-content, .sidebar-content')?.firstElementChild?.className || '' };
      });
      let c = await card();
      ok(!!c && c.live && c.paras >= 2 && c.tags.length >= 2 && c.next.length > 8, '今天這集：分幕旁白＋下集預告，標示播出中', c && { live: c.live, paras: c.paras, tags: c.tags, next: c.next.slice(0, 60) });
      ok(c && c.folds.length >= 1 && c.folds.every(f => !f.open) && c.skillRows <= 1, '村民對話與逐筆紀錄預設收起，技能升級合併成一行', c && { folds: c.folds, skill: c.skillRows });
      ok(c && !c.prevDis && c.nextDis, '今天這集：可以翻上一集，沒有下一集', c && { prev: c.prevDis, next: c.nextDis });
      // 翻到上一集
      await page.click('.ep-card .ep-btn >> nth=0'); await page.waitForTimeout(200);
      const c2 = await card();
      ok(c2 && !c2.live && c2.show !== c.show && !c2.nextDis && c2.paras >= 1, '翻到上一集：已定稿、可以再按「今天」回來', c2 && { show: c2.show, live: c2.live });
      await page.click('.ep-card .ep-btn >> nth=1'); await page.waitForTimeout(200);
      let guard = 0; while (guard++ < 5) { const cc = await card(); if (cc.live) break; await page.click('.ep-card .ep-btn >> nth=1'); await page.waitForTimeout(150); }
      const c3 = await card();
      ok(c3 && c3.live, '一路按下一集會回到今天', c3 && c3.show);
      if (lang === 'en') {
        const cjk = (c3.text.match(/[一-鿿]{2,}/g) || []);
        ok(!cjk.length, '英文版：八點檔卡片沒有殘留中文', cjk.slice(0, 6));
      } else ok(/八點檔/.test(c3.show) && /敬請鎖定明晚八點/.test(c3.next), '中文版：標題與結尾', { show: c3.show, next: c3.next.slice(-20) });
      ok(c3.sw <= c3.cw + 1, '卡片沒有橫向溢出', { sw: c3.sw, cw: c3.cw, w: c3.w });
      // AI 改寫：再換一次日
      aiOn = true; const before = aiCalls;
      const r2 = await page.evaluate(async () => {
        const app = window.rimtownApp, w = app.world; const L = w.conversationEngine.llm; L._rateLimitedUntil = 0; L._primaryCooldownUntil = 0; L._requestTimestamps = []; const d0 = w._absDay();
        for (let i = 0; i < 200 && w._absDay() === d0; i++) { w.paused = false; try { w.tick(); } catch (e) {} } w.paused = true;
        for (let i = 0; i < 40 && !(w.episodes || []).find(e => e.day === d0)?.ai; i++) await new Promise(r => setTimeout(r, 100));
        const ep = (w.episodes || []).find(e => e.day === d0);
        app._epSel = d0; app.state = w.getState(); app.renderSidebar();
        return { d0, ai: !!ep?.ai, aiLang: ep?.aiLang, usedDelta: (w.npcLlmUsedToday || 0), tries: (w.episodes || []).map(e => e.aiTry || 0) };
      });
      await page.waitForTimeout(200);
      const c4 = await card();
      ok(r2.ai && aiCalls > before && c4.ai && c4.paras >= 3 && /鎖定明晚八點|Same time tomorrow/.test(c4.text), 'AI 改寫：每天定稿時用八點檔旁白重寫，卡片標示 AI 旁白', { r2, calls: aiCalls - before, ai: c4.ai, paras: c4.paras });
      ok(r2.tries.every(x => x <= 1) && aiCalls - before <= 2 && r2.usedDelta >= 1, 'AI 每集最多送一次(換日那刻在冷卻才補送)，算進背景額度', { calls: aiCalls - before, tries: r2.tries, used: r2.usedDelta });
      // 存讀檔與重設
      const r3 = await page.evaluate(() => {
        const w = window.rimtownApp.world; const data = JSON.parse(JSON.stringify(w.serialize()));
        const w2 = new World(); w2.loadSave(data);
        const out = { n: (w.episodes || []).length, n2: (w2.episodes || []).length, ai2: (w2.episodes || []).some(e => e.ai), size: JSON.stringify(data.episodes || []).length };
        const v = EPISODE.view(w2, w2.episodes[w2.episodes.length - 1]); out.view = v.acts.length + (v.ai ? 1 : 0);
        w2.reset(); out.afterReset = (w2.episodes || []).length; return out;
      });
      ok(r3.n === r3.n2 && r3.ai2 && r3.view >= 1 && r3.afterReset === 0, '存讀檔保留每一集(含 AI 旁白)，開新地圖清空', r3);
      ok(r3.size < 40000, '存檔裡的集數不會太大', r3.size);
      ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
