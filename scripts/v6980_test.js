// v6.98.0 首頁改版:3D 方塊村民主視覺(跟遊戲同一套模型、會冒對話泡泡、捲出畫面就停)、8 段玩法介紹(導言＋重點＋遊戲紀錄)、目錄跳段、
// 截圖牆拿掉、英文沒有中文殘留、桌機與 390px 沒有橫向捲動;沒有 WebGL 時改放一張截圖;遊戲裡的村民改用 villager3d.js 後外觀不變
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
      console.log(`${lang} ${W}px`);
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: false } : { saves: [] }) }));
      await page.addInitScript((lang) => { localStorage.setItem('rimtown-lang', lang); }, lang);
      await page.goto(BASE, { waitUntil: 'load' });
      await page.waitForSelector('.lp-stage-live canvas', { timeout: 30000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelectorAll('.lp-bubble.on').length >= 1, null, { timeout: 15000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const L = document.getElementById('landing'); const C = L.cloneNode(true); C.querySelector('#landing-log')?.remove(); const txt = C.textContent;
        const n = (s) => document.querySelectorAll(s).length;
        const bands = [...document.querySelectorAll('#landing-features .lp-chapter')].map(b => ({ id: b.id, h2: !!b.querySelector('h2'), lead: (b.querySelector('.lp-ch-lead')?.textContent || '').length, topics: [...b.querySelectorAll('.lp-topic')].map(t => ({ id: t.id, h3: !!t.querySelector('h3'), sum: (t.querySelector('.lp-topic-sum')?.textContent || '').length, pts: t.querySelectorAll('.lp-points dt').length })), log: b.querySelectorAll('.lp-scene li').length, bridge: !!b.querySelector('.lp-ch-bridge') }));
        const toc = [...document.querySelectorAll('.lp-chnav a')].map(a => a.getAttribute('href'));
        const core = { pillars: n('#landing-core .lp-pillar'), chain: [...document.querySelectorAll('#landing-chain li .lp-chain-tag')].map(a => a.getAttribute('href')) };
        return { bands, toc, live: !!document.querySelector('.lp-stage-live canvas'), bubbles: [...document.querySelectorAll('#lp-stage > .lp-dc .lp-dc-why')].map(b => b.textContent).filter(Boolean), /* v9.29.0 對話泡泡換成決定卡:誰、選項、理由 */
          news: n('.lp-new'), imgs: [...L.querySelectorAll('img')].map(i => i.getAttribute('src')), cards: n('#landing-features .landing-card'),
          cjk: (txt.match(/[一-鿿]{2,}/g) || []).filter(s => s !== '邊境鎮' && s !== '中文'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, lw: L.scrollWidth, lcw: L.clientWidth,
          v3: typeof VILLAGER3D !== 'undefined', jc: typeof JOB_COLORS !== 'undefined', core };
      });
      const order = await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const th = performance.getEntriesByType('resource').find(e => /three\.min\.js/.test(e.name)); return { inHtml: !!document.querySelector('script[src*="three.min.js"]:not([async])'), after: th ? th.startTime >= nav.domContentLoadedEventEnd : null }; });
      ok(!order.inHtml && order.after === true, 'three.js 不在首頁 HTML 裡，畫面出來後才載（不拖慢首屏）', order);
      ok(r.live && r.v3 && r.jc, '主視覺是 3D 方塊村民（跟遊戲同一套 villager3d.js）', { live: r.live, v3: r.v3 });
      ok(r.bubbles.length >= 1 && r.bubbles.every(b => lang === 'en' ? !/[一-鿿]/.test(b) : /[一-鿿]/.test(b)), '首屏的決定卡用對應語言寫出村民的理由', r.bubbles);
      ok(r.bands.length === 7 && r.bands.every(b => b.h2 && b.lead > 40 && b.topics.length >= 2 && b.log >= 2 && b.bridge && b.topics.every(t => t.h3 && t.sum > 10 && t.pts >= 3 && t.pts <= 7)), 'v9.1.1 七章：各有標題、核心導言、2～4 個主題（每個有一句摘要＋點開的重點；v9.29.0 補了新功能，最多 7 個）、每個主題的遊戲紀錄、接到下一章的一句話', r.bands);
      ok(r.core.pillars === 3 && r.core.chain.length >= 5 && r.core.chain.every(h => r.bands.some(b => '#' + b.id === h)), '核心：三根柱子＋一件事怎麼牽動整個鎮（每一步連到所屬章節）', r.core);
      ok(r.cards === 0, '玩法不是卡片牆', r.cards);
      ok(r.toc.length === r.bands.length && r.toc.every((h, i) => h === '#' + r.bands[i].id), '章節導覽連到每一章', r.toc);
      ok(r.news === 0, 'v9.1.1 介紹不再掛版本標籤（版本只在更新紀錄與路線圖）', r.news);
      ok(r.imgs.length === 0, '畫面減量：沒有截圖', r.imgs);
      if (lang === 'en') ok(!r.cjk.length, '英文版沒有殘留中文', r.cjk.slice(0, 5));
      ok(r.sw <= r.cw && r.lw <= r.lcw + 1, '沒有橫向捲動', { sw: r.sw, cw: r.cw, lw: r.lw, lcw: r.lcw });
      // 目錄點下去會捲到那一段
      const before = await page.evaluate(() => document.getElementById('landing').scrollTop);
      await page.click('.lp-chnav a[href="#lp-ch-living"]'); await page.waitForFunction(() => Math.abs(document.getElementById('lp-ch-living').getBoundingClientRect().top) < 80, null, { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(200); // 等平滑捲動停下來
      const jump = await page.evaluate(() => { const L = document.getElementById('landing'); const t = document.getElementById('lp-ch-living').getBoundingClientRect().top; return { top: Math.round(t), st: L.scrollTop, on: document.querySelector('.lp-chnav a.on')?.getAttribute('href') }; });
      ok(jump.st > before && Math.abs(jump.top) < 80 && jump.on === '#lp-ch-living', '章節導覽點「討生活」會捲到那一章，導覽列也亮在那一章', jump);
      // 捲出畫面後 3D 停止(不再重畫)
      const stopped = await page.evaluate(async () => { const c = document.querySelector('.lp-stage-canvas'); if (!c) return null; const gl = c.getContext('webgl2') || c.getContext('webgl'); let n = 0; const orig = gl.drawArrays.bind(gl); gl.drawArrays = (...a) => { n++; return orig(...a); }; await new Promise(r => setTimeout(r, 800)); return n; });
      ok(stopped === 0, '主視覺捲出畫面就停止繪製', stopped);
      ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
      await ctx.close();
    }
  }
  // 沒有 WebGL:改放一張實際畫面
  { const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logged_in: false }) }));
    await page.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(t)) return null; return o.call(this, t, ...a); }; });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForSelector('.lp-stage-fallback img', { timeout: 30000 }).catch(() => {});
    const fb = await page.evaluate(() => document.querySelector('.lp-stage-fallback img')?.getAttribute('src') || null);
    ok(!!fb && /proposals-(zh|en)\.jpg$/.test(fb), '沒有 WebGL 時主視覺改放一張實際畫面', fb); ok(!errs.length, '沒有 WebGL 也沒有頁面錯誤', errs.slice(0, 3)); await ctx.close(); }
  // 遊戲裡的村民改用 villager3d.js:眼睛、四肢、遠處簡化照舊
  { const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
    const g = await page.evaluate(() => { const T = window.rimtownApp.tileMap; const m = T._agentMesh('v98', { name: '測試同一人', job: { key: 'farmer' }, appear: { b: 'a', cls: 1 } }, { job: 'farmer', gender: 'female' });
      const a = VILLAGER3D.build({ aid: 'x', agent: { name: '測試同一人', appear: { b: 'a', cls: 1 } }, pos: { job: 'farmer', gender: 'female' } });
      const cnt = (o) => { let n = 0; o.traverse(x => { if (x.isMesh && !x.userData.isLod) n += x.geometry.attributes.position.count; }); return n; };
      const lod = T._agentLod(m); const r = { sig: m.userData.sig.startsWith('farmer|'), eyes: !!m.userData.eyes && !!m.userData.lids, limbs: ['legL', 'legR', 'armL', 'armR'].every(k => m.children.some(c => c.name === k)), lod: !!lod && lod.isMesh, same: cnt(m) === cnt(a), verts: cnt(m) };
      T._agentGroup.remove(m); T._disposeAgent(m); delete T._agentMeshes.v98; return r; });
    ok(g.sig && g.eyes && g.limbs && g.lod && g.same && g.verts < 3000, '遊戲與首頁的村民是同一套模型（眼睛、四肢、遠處簡化照舊）', g); ok(!errs.length, '遊戲沒有頁面錯誤', errs.slice(0, 3)); await ctx.close(); }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
