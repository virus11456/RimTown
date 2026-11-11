// v6.78.1 每日報紙(取代 v6.78.0 的「八點檔」):日報 › 日誌最上面是一份報紙(報頭、期數、頭條、各版、明日看點)，換日定稿、可翻上一期／下一期；
// 「小鎮劇場」拿掉，名場面同類合併成報紙上的一則；村民對話與逐筆紀錄預設收起、技能升級合併；不另外呼叫 AI；
// 存讀檔保留、重設清空；鎮況卡寫出現任首長(可點開村民卡)；自備金鑰關閉(舊金鑰清掉、設定頁沒有表單)；英文版無殘留中文；手機 390px 不溢出
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
      console.log(`${lang} ${W}px`);
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      let paperAi = 0;
      await page.route('**/api/**', r => {
        const u = r.request().url(); const body = r.request().postData() || '';
        if (u.includes('/api/me')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logged_in: true, user: { id: 1, username: 'tester' } }) });
        if (/八點檔|prime-time/.test(body)) paperAi++;
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saves: [], success: true, reply: '' }) });
      });
      await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1');
        if (!sessionStorage.getItem('byok_seeded')) { sessionStorage.setItem('byok_seeded', '1'); localStorage.setItem('rimtown_byok', JSON.stringify({ provider: 'anthropic', key: 'sk-test-old', model: '' })); } }, { jwt, lang });
      await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2000);
      // 自備金鑰關閉
      const k = await page.evaluate(() => ({ prov: window.rimtownApp.llmClient?.provider, stored: localStorage.getItem('rimtown_byok') }));
      ok(k.prov === 'server' && !k.stored, '自備金鑰關閉：一律用小鎮內建 AI，舊的自備金鑰被清掉', k);
      // 跑兩天多，並在今天塞 5 場同類名場面
      const r1 = await page.evaluate((lang) => {
        const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
        const d0 = w._absDay(); for (let i = 0; i < 96 * 4 && w._absDay() - d0 < 2; i++) { w.paused = false; try { w.tick(); } catch (e) {} }
        for (let i = 0; i < 40; i++) { w.paused = false; try { w.tick(); } catch (e) {} } w.paused = true;
        const ids = Object.values(w.agents).filter(a => !a.isPlayer).slice(0, 6);
        w.dramaArchive = w.dramaArchive || [];
        for (let i = 0; i < 5; i++) w.dramaArchive.push({ kind: 'feud', icon: '💥', title: '廣場對嗆', aName: ids[i].name, bName: ids[i + 1].name, aId: ids[i].agentId, bId: ids[i + 1].agentId, lines: [{ speaker: ids[i].name, text: lang === 'en' ? 'Explain yourself!' : '你給我說清楚！' }], year: w.clock.year, season: w.clock.season, day: w.clock.day, tick: w.tickCount });
        const tagged = (w.messageLog || []).slice(-50).every(m => typeof m.d === 'number');
        return { d0, eps: (w.episodes || []).map(e => e.day), tagged };
      }, lang);
      ok(r1.eps.length >= 2 && r1.eps.includes(r1.d0) && r1.tagged, '換日時把每一天定稿成一期報紙、日誌帶日期', r1);
      await page.evaluate((mob) => { const app = window.rimtownApp; app.state = app.world.getState(); if (mob && app._openKairoTab) app._openKairoTab('records'); else { document.querySelector('.rt-sidebar-tabs > button[data-tab="records"]')?.click(); app.activeTab = 'records'; } app.renderSidebar(); }, mob);
      await page.waitForTimeout(300);
      const card = async () => page.evaluate(() => {
        const c = document.querySelector('.np-paper'); if (!c) return null;
        return { name: c.querySelector('.np-name')?.textContent || '', meta: c.querySelector('.np-meta')?.textContent || '', live: c.classList.contains('live'), head: c.querySelector('.np-headline')?.textContent || '',
          secs: [...c.querySelectorAll('.np-sec h4')].map(x => x.textContent.trim()), items: [...c.querySelectorAll('.np-sec li')].map(x => x.textContent), text: c.textContent,
          prevDis: c.querySelectorAll('.np-btn')[0]?.disabled, nextDis: c.querySelectorAll('.np-btn')[1]?.disabled, sw: c.scrollWidth, cw: c.clientWidth,
          theater: !!document.querySelector('.drama-theater, .drama-replay-row'),
          folds: [...document.querySelectorAll('.log-fold')].map(d => ({ open: d.open, s: d.querySelector('summary')?.textContent || '' })),
          skillRows: [...document.querySelectorAll('.log-messages-section .log-entry.type-skill_up')].length };
      });
      let c = await card();
      ok(!!c && c.live && c.head.length > 3 && c.secs.length >= 2 && c.items.length >= 3, '今天這期：報頭、頭條、各版新聞，標示今日編輯中', c && { live: c.live, head: c.head, secs: c.secs, n: c.items.length });
      ok(c && (lang === 'zh' ? c.name.trim() === '觀察者日報' && /第 \d+ 期/.test(c.meta) : /Observer Daily/.test(c.name) && /Issue \d+/.test(c.meta)), '報頭有報名與期數', c && { name: c.name, meta: c.meta });
      ok(c && !/八點檔|下集預告|敬請鎖定|播出中|Next time|On air|Tonight/.test(c.text), '不再有八點檔的說法', c && c.text.slice(0, 120));
      const merged = c ? [c.head].concat(c.items).filter(x => { const m = x.match(/廣場對嗆 (\d+) 起|×(\d+)/); return m && +(m[1] || m[2]) >= 5; }) : [];
      ok(c && !c.theater && merged.length === 1, '小鎮劇場拿掉，同一天 5 場廣場對嗆合併成一則', c && { theater: c.theater, merged });
      ok(c && c.folds.length >= 1 && c.folds.every(f => !f.open) && c.skillRows <= 1, '村民對話與逐筆紀錄預設收起，技能升級合併成一行', c && { folds: c.folds, skill: c.skillRows });
      ok(c && !c.prevDis && c.nextDis, '今天這期：可以翻上一期，沒有下一期', c && { prev: c.prevDis, next: c.nextDis });
      await page.click('.np-paper .np-btn >> nth=0'); await page.waitForTimeout(200);
      const c2 = await card();
      ok(c2 && !c2.live && c2.meta !== c.meta && !c2.nextDis, '翻到上一期：已定稿、可以再按「今天」回來', c2 && { meta: c2.meta, live: c2.live });
      let guard = 0; while (guard++ < 6) { const cc = await card(); if (cc.live) break; await page.click('.np-paper .np-btn >> nth=1'); await page.waitForTimeout(150); }
      const c3 = await card();
      ok(c3 && c3.live, '一路按下一期會回到今天', c3 && c3.meta);
      if (lang === 'en') { const cjk = (c3.text.match(/[一-鿿]{2,}/g) || []); ok(!cjk.length, '英文版：報紙沒有殘留中文', cjk.slice(0, 6)); }
      ok(c3.sw <= c3.cw + 1, '報紙沒有橫向溢出', { sw: c3.sw, cw: c3.cw });
      // 再換一次日：不會另外呼叫 AI 改寫
      await page.evaluate(() => { const w = window.rimtownApp.world; const d0 = w._absDay(); for (let i = 0; i < 200 && w._absDay() === d0; i++) { w.paused = false; try { w.tick(); } catch (e) {} } w.paused = true; });
      await page.waitForTimeout(500);
      ok(paperAi === 0, '報紙由當天的事整理，不另外呼叫 AI', paperAi);
      // 存讀檔與重設
      const r3 = await page.evaluate(() => {
        const w = window.rimtownApp.world; const data = JSON.parse(JSON.stringify(w.serialize()));
        const w2 = new World(); w2.loadSave(data);
        const out = { n: (w.episodes || []).length, n2: (w2.episodes || []).length, size: JSON.stringify(data.episodes || []).length };
        const v = EPISODE.view(w2, w2.episodes[w2.episodes.length - 1]); out.secs = v.sections.length; out.head = v.title;
        const old = JSON.parse(JSON.stringify(data)); old.episodes = [{ day: 1, mat: { items: [{ act: 'main', c: 'x' }], counts: {} }, teaser: [], ai: 'x' }];
        const w3 = new World(); w3.loadSave(old); out.oldDropped = (w3.episodes || []).length === 0;
        w2.reset(); out.afterReset = (w2.episodes || []).length; return out;
      });
      ok(r3.n === r3.n2 && r3.secs >= 1 && r3.head && r3.afterReset === 0 && r3.oldDropped, '存讀檔保留每一期、v6.78.0 的舊集數丟掉、開新地圖清空', r3);
      ok(r3.size < 40000, '存檔裡的報紙不會太大', r3.size);
      // 鎮況卡：現任首長
      const r4 = await page.evaluate((mob) => {
        const app = window.rimtownApp, w = app.world; app.state = w.getState();
        if (mob && app._openKairoTab) app._openKairoTab('proposals'); else { document.querySelector('.rt-sidebar-tabs > button[data-tab="proposals"]')?.click(); app.activeTab = 'proposals'; }
        app._ppTab = 'town'; app.renderSidebar();
        const mayor = w.election?._officeHolder?.(w);
        const line = [...document.querySelectorAll('.pp-tier-line, .pp-gov .ic-row')].map(x => x.textContent).find(x => /現任|Current/.test(x)) || '';
        const btn = document.querySelector('.pp-gov .ic-row:last-child .pp-mayor-name, .pp-tier-line .pp-mayor-name');
        return { line, mayor: mayor ? mayor.agentId : null, btn: btn ? btn.dataset.val : null, title: typeof TIERS !== 'undefined' ? TIERS.leaderTitle(w) : '' };
      }, mob);
      ok(r4.line && (r4.mayor ? r4.btn === r4.mayor : /從缺|Vacant/.test(r4.line)) && r4.line.includes(r4.title), '鎮況卡寫出現任首長(名字可點開村民卡)', r4);
      // 設定頁沒有自備金鑰表單
      const r5 = await page.evaluate(() => { const app = window.rimtownApp; const box = document.createElement('div'); try { app.renderSettings(box); } catch (e) { return { err: e.message }; } return { form: !!box.querySelector('#settings-byok-provider, .byok-box'), len: box.innerHTML.length }; });
      ok(!r5.err && !r5.form && r5.len > 200, '設定頁沒有自備金鑰表單', r5);
      ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
