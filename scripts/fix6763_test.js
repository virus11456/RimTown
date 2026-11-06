// v6.76.3 回歸:空間滿而且 IndexedDB 寫不進去時,不會刪掉別鎮唯一的本機存檔(目前這座的舊副本也不會先被刪);
// 開新遊戲(城鎮列表／設定的新地圖)後,原本那座立刻搬去 IndexedDB 而且是新的世界;桌機 1280px 英文介面控制列換行時不蓋住四個主分頁;
// 教學與提案頁不再說「由你批准」
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    for (const W of [1280, 1100]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, serviceWorkers: 'block' });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', success: true }) }));
      await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
      await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
      // 1) 四個主分頁沒被控制列蓋住
      const lay = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('.rt-sidebar-tabs button')].filter(b => b.getClientRects().length && getComputedStyle(b).display !== 'none');
        const hits = tabs.map(b => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!el && (el === b || b.contains(el)); });
        const ctl = document.querySelector('.header .controls').getBoundingClientRect(), sb = document.getElementById('rimtown-sidebar').getBoundingClientRect();
        return { n: tabs.length, hits, ctlBottom: Math.round(ctl.bottom), sbTop: Math.round(sb.top) };
      });
      ok(lay.n === 4 && lay.hits.every(Boolean) && lay.sbTop >= lay.ctlBottom, `${W}px:四個主分頁都點得到,側欄在控制列下方`, lay);
      if (W === 1100) { await ctx.close(); continue; }
      // 2) 教學與提案頁的說法
      const txt = await page.evaluate(() => {
        const step = document.querySelector('.tutorial-step[data-step="4"]'); const s4 = step ? (step.textContent || '') : '';
        const app = window.rimtownApp; const box = document.createElement('div'); const st = app.state; app.state = Object.assign({}, st, { proposals: null }); try { app.renderProposals(box); } catch (e) {} app.state = st;
        return { s4: s4.replace(/\s+/g, ' ').slice(0, 400), empty: box.innerText.replace(/\s+/g, ' ') };
      });
      const bad = /你批准|由你批准|you approve|you can approve/i;
      ok(!bad.test(txt.s4) && (lang === 'zh' ? /(村長|鎮長|市長)自己拍板/.test(txt.s4) : /(village chief|mayor|Mayor) decides/.test(txt.s4)), '教學:提案由村長自己拍板,不再要你批准', txt.s4);
      ok(!bad.test(txt.empty) && (lang === 'zh' ? /自己拍板/.test(txt.empty) : /decides/.test(txt.empty)), '提案頁空白說明也一樣', txt.empty);
      // 3) 空間滿 + IndexedDB 寫不進去:別鎮的本機存檔還在、目前這座在 IndexedDB 的舊副本也還在
      const q = await page.evaluate(async () => {
        const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._localQuotaNoticeShown = true;
        const out = {}; const blob = JSON.stringify(w.serialize()); const cur = app.currentTownId; const key = 'rimtown_town_' + cur;
        const L = app._getTownList(); for (const id of ['town_qa', 'town_qb']) { if (!L.some(x => x.id === id)) L.push({ id, name: id, origin: 'neighbor', world: w.worldId || 'w0' }); localStorage.setItem('rimtown_town_' + id, blob); } app._saveTownList(L);
        // 目前這座在 IndexedDB 也有一份舊副本
        localStorage.removeItem(key); await RTStore.set(cur, blob); app._idbTowns.add(cur);
        const oSet = Storage.prototype.setItem, oIdb = RTStore.set;
        // (a) localStorage 寫目前這座一律失敗、IndexedDB 也寫不進去
        Storage.prototype.setItem = function (k, v) { if (k === key) throw new DOMException('full', 'QuotaExceededError'); return oSet.call(this, k, v); };
        RTStore.set = async () => undefined;
        app._saveCurrentTown(); try { await app._quotaSpill; } catch (e) {}
        out.a = { qa: !!localStorage.getItem('rimtown_town_town_qa'), qb: !!localStorage.getItem('rimtown_town_town_qb'), curIdb: !!(await RTStore.get(cur)), curIdx: app._idbTowns.has(cur) };
        RTStore.set = oIdb;
        // (b) IndexedDB 正常:別鎮搬過去後目前這座寫得進 localStorage,這時才刪舊副本
        Storage.prototype.setItem = function (k, v) { if (k === key && (localStorage.getItem('rimtown_town_town_qa') || localStorage.getItem('rimtown_town_town_qb'))) throw new DOMException('full', 'QuotaExceededError'); return oSet.call(this, k, v); };
        app._saveCurrentTown(); try { await app._quotaSpill; } catch (e) {}
        Storage.prototype.setItem = oSet;
        out.b = { qaLs: !!localStorage.getItem('rimtown_town_town_qa'), qaIdb: !!(await RTStore.get('town_qa')), qbIdb: !!(await RTStore.get('town_qb')), curLs: !!localStorage.getItem(key), curIdb: !!(await RTStore.get(cur)) };
        return out;
      });
      ok(q.a.qa && q.a.qb, '空間滿而且 IndexedDB 寫不進去:別鎮唯一的本機存檔沒被刪', q.a);
      ok(q.a.curIdb && q.a.curIdx, '目前這座寫不進去時,IndexedDB 裡的舊副本也還在', q.a);
      ok(!q.b.qaLs && q.b.qaIdb && q.b.qbIdb && q.b.curLs && !q.b.curIdb, 'IndexedDB 正常時:別鎮確定搬過去才讓位,目前這座寫好後才刪舊副本', q.b);
      // 4) 開新遊戲:原本那座立刻搬去 IndexedDB、新的世界;設定裡的「新地圖」走同一條路
      const nw = await page.evaluate(async () => {
        const app = window.rimtownApp, w = app.world; window.confirm = () => true; let n = 0; window.prompt = () => '測試新鎮' + (++n);
        const prev = app.currentTownId, w0 = w.worldId; await app.createNewTown();
        const r1 = { prev, now: app.currentTownId, prevLs: !!localStorage.getItem('rimtown_town_' + prev), prevIdb: !!(await RTStore.get(prev)), newWorld: !!w.worldId && w.worldId !== w0, curLs: !!localStorage.getItem('rimtown_town_' + app.currentTownId) };
        const prev2 = app.currentTownId, w1 = w.worldId; const b = document.createElement('button'); b.dataset.action = 'settings-new-map'; (document.getElementById('rimtown-app') || document.body).appendChild(b); b.click();
        for (let i = 0; i < 50 && app.currentTownId === prev2; i++) await new Promise(r => setTimeout(r, 100));
        for (let i = 0; i < 30 && !!localStorage.getItem('rimtown_town_' + prev2); i++) await new Promise(r => setTimeout(r, 100));
        const r2 = { changed: app.currentTownId !== prev2, prevLs: !!localStorage.getItem('rimtown_town_' + prev2), prevIdb: !!(await RTStore.get(prev2)), newWorld: !!w.worldId && w.worldId !== w1 };
        b.remove(); return { r1, r2 };
      });
      ok(nw.r1.now !== nw.r1.prev && !nw.r1.prevLs && nw.r1.prevIdb && nw.r1.newWorld && nw.r1.curLs, '開新遊戲:原本那座立刻搬去 IndexedDB,localStorage 只留新的一座', nw.r1);
      ok(nw.r2.changed && !nw.r2.prevLs && nw.r2.prevIdb && nw.r2.newWorld, '設定的「新地圖」也是新的世界,原本那座同樣搬走', nw.r2);
      ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
