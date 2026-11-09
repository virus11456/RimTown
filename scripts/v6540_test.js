// v6.54.0:速度控制合一、個人錢包(工資／生活費／借錢／提案出資)、夜景(窗燈依睡覺開關、燈籠、串燈、螢火蟲)、長時間遊玩不卡(提案頁不重畫、已定案只列 8 件、動態圖層合併)
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
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Wallet Town' : undefined));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', ok: true }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);

    // ---------- 速度 ----------
    const sp = await page.evaluate(async () => {
      const app = window.rimtownApp; const top = document.querySelector('.controls .btn-speed[data-speed="5"]');
      let bgm = 0; const _b = app._updateBGMPhase; app._updateBGMPhase = function () { bgm++; return _b?.apply(this, arguments); };
      top?.click(); await new Promise(r => setTimeout(r, 1300)); app._updateBGMPhase = _b;
      const active = [...document.querySelectorAll('.btn-speed[data-speed].active')].map(b => b.dataset.speed);
      app.activeTab = 'settings'; app.renderSidebar(); const sc = document.getElementById('sidebar-content')?.innerText || '';
      return { has5: !!top, sim: app.simSpeed, active, saved: localStorage.getItem('rimtown_speed_mult'), bgm, settingsSpeed: /模擬速度|速度倍率|Simulation speed|Speed multiplier/i.test(sc), selectGone: !document.getElementById('settings-tab-speed') && !document.getElementById('sim-speed') };
    });
    ok(sp.has5 && sp.sim === 400 && sp.active.length >= 1 && sp.active.every(x => x === '5') && sp.saved === '5', '上方 5x：每格 0.4 秒，桌機與手機的倍率鈕一起亮，記住選擇', sp);
    ok(sp.bgm > 0, '調速後仍走完整模擬迴圈（配樂會跟著日夜切換）', sp);
    ok(!sp.settingsSpeed && sp.selectGone, '設定頁不再有重複的「模擬速度／速度倍率」', sp);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(1500);
    const sp2 = await page.evaluate(() => ({ sim: window.rimtownApp.simSpeed, active: [...document.querySelectorAll('.controls .btn-speed.active')].map(b => b.dataset.speed) }));
    ok(sp2.sim === 400 && sp2.active.join() === '5', '重新整理後速度維持 5x', sp2);
    await page.evaluate(() => window.rimtownApp._setSpeed(1));

    // ---------- 錢包 ----------
    const wl = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world, P = w.proposals; app._setPaused?.(true);
      const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      WALLET.S(w); w.wallet.lastDay = null;
      const worker = npcs.find(a => WALLET.WAGE[a.job?.key]); const tr0 = w.stockpile.get('silver');
      { const MK = w.market; if (MK) { for (const k of Object.keys(MK.owners || {})) if (MK.owners[k] === worker.agentId) { MK.owners[k] = null; if (MK.shares) delete MK.shares[k]; } MK.lastDay = w._absDay(); } } /* v8.7 起合股常讓這個工人變老闆或出錢入股:先拿掉,這裡只量工資和三餐 */
      const before = WALLET.get(w, worker);
      // 一個人身無分文
      const poor = npcs.find(a => a !== worker); /* v6.90 開局有家族,家人會接濟:先讓他孤身一人 */ for (const o of Object.values(w.agents)) { if (o === poor) continue; if ((o._parentNames || []).includes(poor.name)) o._parentNames = o._parentNames.filter(n => n !== poor.name); const rr = o.relationships?.relationships?.[poor.agentId]; if (rr && ['married', 'dating'].includes(rr.status)) rr.status = 'ex'; } poor._parentNames = []; for (const rr of Object.values(poor.relationships?.relationships || {})) if (['married', 'dating'].includes(rr.status)) rr.status = 'ex'; w.wallet.bal[poor.agentId] = 0; poor.needs.hunger = 80; const pj = poor.job; poor.job = null; // 沒工作就沒工資
      { const _md = MARKET.daily; MARKET.daily = () => {}; try { WALLET.daily(w); } finally { MARKET.daily = _md; } } poor.job = pj; /* 只量工資和三餐:市場結算(合股入股)先關掉 */
      const wage = WALLET.WAGE[worker.job.key] * 0.9;
      const after = WALLET.get(w, worker);
      const poorTh = (poor.thoughts || []).some(x => x.kind === 'broke_hungry'), poorHunger = poor.needs.hunger;
      // 借錢:真的有錢移動
      w.wallet.lastDay = null; const lender = npcs.filter(a => a !== poor).sort((x, y) => WALLET.get(w, y) - WALLET.get(w, x))[0]; w.wallet.bal[lender.agentId] = 200; lender.personality.traits = (lender.personality.traits || []).filter(x => x !== 'greedy');
      poor.relationships.getOrCreate(lender.agentId, lender.name).affinity = 60; lender.relationships.getOrCreate(poor.agentId, poor.name).affinity = 60; w.wallet.bal[poor.agentId] = 0;
      const _r = Math.random; Math.random = () => 0.01; try { WALLET.daily(w); } finally { Math.random = _r; }
      const debt = (w.dark?.debts || []).find(d => d.cash && d.r === poor.agentId);
      // 提案出資
      const cands = P._candidates(w, P._abs(w)); const rich = npcs.find(a => a !== poor); w.wallet.bal[rich.agentId] = 5000;
      let pSelf = null; for (const c of cands) { const p = P._createWith(w, P._abs(w), c, rich); if (p.fund) { pSelf = p; break; } }
      const richBefore = WALLET.get(w, rich);
      let collected = null, why = null;
      if (pSelf) { P._ruleVote(w, pSelf, rich); why = pSelf.why[rich.agentId]; P._decide(w, pSelf, 'approve', 'mayor'); collected = richBefore - WALLET.get(w, rich); }
      const item = pSelf ? P.toItem(w, pSelf) : null;
      // AI 知道自己身上有多少錢
      const brief = w.conversationEngine?._agentBrief ? JSON.stringify(w.conversationEngine._agentBrief(w, worker, null)) : '';
      // 存讀檔
      const save = w.serialize(); const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(save)));
      // 很多人窮 → 鎮況急事
      for (const a of npcs.slice(0, 6)) w.wallet.bal[a.agentId] = 0; const iss = WALLET.issues(w).map(i => i.key);
      return { wage, gain: +(after - before).toFixed(1), tr: +(w.stockpile.get('silver') - tr0).toFixed(1), poorTh, poorHunger, debt: !!debt, poorGot: WALLET.get(w, poor) > 0 || !!debt, fundBy: pSelf?.fund?.by, value: pSelf?.fund?.value, why, collected, fundText: item?.fundText, brief: /銀幣|silver/i.test(brief), rt: !!w2.wallet && Object.keys(w2.wallet.bal).length === Object.keys(w.wallet.bal).length, iss };
    });
    ok(wl.gain > 0 && Math.abs(wl.gain + 3 - wl.wage) < 1.5, '有工作的人每天領工資（扣稅後）再付三餐', wl);
    ok(wl.poorTh && wl.poorHunger <= 55, '身無分文的人付不起三餐，會餓、心情變差', wl);
    ok(wl.debt, '窮的人跟有錢的朋友借錢（真的拿到錢，記成要還的債）', wl);
    ok(['self', 'crowd', 'town'].includes(wl.fundBy) && wl.value > 0 && wl.fundText, '提案會決定誰出錢，卡片上寫出出錢方式與金額', wl);
    ok(wl.fundBy !== 'self' || (wl.why === 'pledged' && wl.collected > 0), '自己出錢的提案人一定投贊成，通過後真的從錢包扣款', wl);
    ok(wl.brief, 'AI 知道自己身上有多少錢', wl);
    ok(wl.rt, '錢包存讀檔往返保留', wl);
    ok(wl.iss.includes('poverty'), '很多人窮到吃不起 → 鎮況急事', wl.iss);
    const card = await page.evaluate(() => { const app = window.rimtownApp; const a = Object.values(app.world.agents).find(x => !x.isPlayer); app.state = app.world.getState(); app._showNpcCard(a.agentId); const s = document.getElementById('npc-quick-card')?.innerText || ''; app._hideNpcCard(); return s; });
    ok(/👛/.test(card), '村民卡上看得到身上有多少錢', card.slice(0, 200));
    const ec = await page.evaluate(() => { const app = window.rimtownApp; app.state = app.world.getState(); app.activeTab = 'economy'; app._economySubTab = 'resources'; app.renderSidebar(); return document.getElementById('sidebar-content')?.innerText || ''; });
    ok(/👛/.test(ec), '經濟儀表板有村民荷包摘要', ec.slice(0, 120));

    // ---------- 夜景 ----------
    const nt = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, tm = app.tileMap; w.paused = false;
      const go = async (h) => { let g = 0; while (!(w.clock.hour === h && w.clock.minute === 0) && g++ < 200) w.tick(); app.state = w.getState(); for (let i = 0; i < 70; i++) { app.render(); await new Promise(r => requestAnimationFrame(r)); } };
      await go(21); const n = Object.keys(tm._winIdx || {}).length; const lit21 = Array.from(tm._winLit).slice(1, n + 1).filter(x => x > 0.5).length;
      tm.season = '夏季'; tm.weatherType = 'clear'; tm._updateFireflies(); const ff = !!tm._ff?.visible;
      // 直接驗窗燈規則:醒著的那棟亮、全家睡了那棟暗
      const ids = Object.values(tm._winIdx).filter(Boolean); const b1 = ids.find(b => !tm._winPub?.[b]), b2 = ids.filter(b => !tm._winPub?.[b])[1]; for (let i = 0; i < 90; i++) tm._updateWindowLights({ [b1]: [1, 0], [b2]: [0, 2] }); const rule = [+tm._winLit[b1].toFixed(2), +tm._winLit[b2].toFixed(2)];
      await go(2); const lit2 = Array.from(tm._winLit).slice(1, n + 1).filter(x => x > 0.5).length; const asleep = Object.values(w.agents).filter(a => a.activity === 'sleeping').length;
      w.paused = true;
      return { n, lit21, lit2, asleep, ff, rule, lantern: tm._lanternMat?.emissiveIntensity, bulbs: (tm._bulbMats || []).length, door: (tm._doorGlow || []).length };
    });
    ok(nt.n > 5 && nt.lit21 >= 1 && nt.rule[0] > 0.9, '晚上有人醒著在家的房子亮燈', nt);
    ok(nt.lit2 < nt.lit21 && nt.asleep > 5 && nt.rule[1] < 0.1, '半夜大家睡了，窗燈跟著暗下來', nt);
    ok(nt.lantern > 0.5 && nt.bulbs === 3 && nt.door >= 5, '門口燈籠與廣場串燈晚上會亮', nt);
    ok(nt.ff, '夏天晴朗的晚上有螢火蟲', nt);

    // ---------- 長時間遊玩不卡 ----------
    const pf = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world, P = w.proposals; const a = Object.values(w.agents).find(x => !x.isPlayer);
      for (let i = 0; i < 30; i++) { const cs = P._candidates(w, P._abs(w)); if (!cs.length) break; const p = P._createWith(w, P._abs(w), cs[i % cs.length], a); P._decide(w, p, i % 2 ? 'approve' : 'reject', 'mayor'); }
      app.state = w.getState(); app._ppTab = 'props'; app._ppHistAll = false;
      const box = document.createElement('div'); document.body.appendChild(box); app.renderProposals(box); const first = box.firstElementChild;
      const t0 = performance.now(); for (let i = 0; i < 20; i++) app.renderProposals(box); const ms = (performance.now() - t0) / 20;
      const same = box.firstElementChild === first;
      const histCards = box.querySelectorAll('.pp-card.pp-stamped').length; const more = box.querySelector('[data-pp-more]');
      more?.click(); const all = box.querySelectorAll('.pp-card.pp-stamped').length; box.remove();
      // 動態圖層:加 20 個裝飾,繪製次數不該多 20 次以上
      const tm = app.tileMap; tm.render(app.state.agents || {}, null, {}); const c0 = tm.renderer.info.render.calls;
      tm.decorations = (tm.decorations || []).concat(Array.from({ length: 20 }, (_, i) => ({ type: ['bench', 'flowerbed', 'statue'][i % 3], x: (10 + i) * 16, y: 12 * 16 })));
      for (let i = 0; i < 3; i++) tm.render(app.state.agents || {}, null, {}); const c1 = tm.renderer.info.render.calls;
      return { same, ms: +ms.toFixed(2), histCards, more: !!more, all, c0, c1 };
    });
    ok(pf.same && pf.ms < 5, '提案頁內容沒變就不重畫（不再每格整頁重建）', pf);
    ok(pf.more && pf.histCards <= 9 && pf.all > pf.histCards, '已定案只先列最近 8 件，點「顯示更早的」才展開', pf);
    ok(pf.c1 - pf.c0 < 10, '新蓋的東西會合併繪製，不會一棟多十幾次繪製', pf);

    // 新城鎮錢包重來
    const nw = await page.evaluate(async () => { const app = window.rimtownApp; const old = app.currentTownId; await app.createNewTown(); return { old }; });
    await page.waitForTimeout(2500);
    const nw2 = await page.evaluate(() => { const w = window.rimtownApp.world; return { wallet: w.wallet ? Object.keys(w.wallet.bal).length : 0 }; });
    ok(nw2.wallet === 0, '新城鎮不帶入舊鎮的錢包', nw2);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
