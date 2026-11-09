// v8.7.0 股份與合夥經營:招股（合股買下公營產業）、每週分紅、做假帳被抓、賣股週轉、眼紅入股、缺錢賣股、拆夥、股東會奪權、
// 股東搬走與過世（繼承）、整家被賣時股東分錢、存讀檔、AI 知道、成就、銀幣守恆、介面（中英、桌機與 390px）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[Shares\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      WALLET.S(w); const M = SHARES.S(w); const B = w.wallet.bal; const sp = w.stockpile;
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
      const total = () => Math.round(((sp.get('silver') || 0) + Object.values(B).reduce((s, v) => s + (v || 0), 0)) * 100) / 100;
      const setAff = (a, b, v) => { const r = a.relationships.getOrCreate(b.agentId, b.name); r.affinity = v; };
      const tr = (a, k) => { a.personality.traits = [...new Set([...(a.personality.traits || []).filter(x => !['greedy', 'stubborn', 'perfectionist', 'jealous', 'generous', 'kind', 'thrifty'].includes(x)), ...k])]; };
      const d = w._absDay(); const all = npcs();
      // 選一個有工人的產業
      const K = Object.keys(MARKET.SECTORS).find(k => MARKET.workersOf(w, k, all).length >= 1) || 'farm';
      const ppl = all.filter(a => (a.age ?? 30) >= 18).slice(0, 8); const [A, Bb, C, D, E] = ppl;
      // 1) 招股:沒人一個人買得起,A 帶頭、找交情好的 B、C 合股
      for (const a of all) B[a.agentId] = 5; M.owners[K] = null; delete M.shares[K]; M.hist[K] = [];
      const price = SHARES.valueOf(w, K); B[A.agentId] = Math.round(price * 0.55); B[Bb.agentId] = Math.round(price * 0.5); B[C.agentId] = Math.round(price * 0.5);
      tr(A, ['hardworking']); setAff(Bb, A, 60); setAff(C, A, 50); setAff(D, A, -10);
      const t0 = total(); fix(0.1, () => SHARES.syndicate(w, npcs(), d)); const s1 = SHARES.stakes(w, K);
      out.syn = { owner: M.owners[K] === A.agentId, holders: Object.keys(s1).length, sum: Object.values(s1).reduce((x, y) => x + y, 0), lead: s1[A.agentId] >= Math.max(...Object.values(s1)), drift: Math.round((total() - t0) * 100) / 100, st: M.sh.st.syn, log: (w.messageLog || []).slice(-6).some(m => /🤝/.test(String(m.content || ''))) };
      // 2) 每週分紅:照股份分利潤的六成
      M.shares[K] = { [A.agentId]: 50, [Bb.agentId]: 30, [C.agentId]: 20 }; M.owners[K] = A.agentId; tr(A, ['kind']); B[A.agentId] = 500; B[Bb.agentId] = 50; B[C.agentId] = 50;
      M.hist[K] = Array.from({ length: 7 }, () => [30, 10]); const prof = SHARES.profit7(w, K); const b0 = B[Bb.agentId], c0 = B[C.agentId]; const t2 = total();
      fix(0.9, () => SHARES.weekly(w, npcs(), d));
      out.div = { b: Math.round((B[Bb.agentId] - b0) * 100) / 100, c: Math.round((B[C.agentId] - c0) * 100) / 100, expB: Math.round(prof * 0.6 * 0.3 * 100) / 100, drift: Math.round((total() - t2) * 100) / 100 };
      // 3) 做假帳:貪心的當家少分,細心的股東抓到;不嘴硬就把錢吐回去
      tr(A, ['greedy']); tr(Bb, ['perfectionist']); M.shares[K] = { [A.agentId]: 50, [Bb.agentId]: 30, [C.agentId]: 20 }; M.owners[K] = A.agentId; B[A.agentId] = 500; setAff(Bb, A, 20); setAff(A, Bb, 20); M.sh.angry = {};
      const b1 = B[Bb.agentId]; const t3 = total(); fix(0.05, () => SHARES.weekly(w, npcs(), d));
      out.cheat = { caught: M.sh.st.caught >= 1, gotFull: Math.round((B[Bb.agentId] - b1) * 100) / 100, exp: Math.round(prof * 0.6 * 0.3 * 100) / 100, affDrop: (Bb.relationships.relationships[A.agentId]?.affinity || 0) < 20, drift: Math.round((total() - t3) * 100) / 100 };
      // 嘴硬:不吐錢,其他股東也生氣
      tr(A, ['greedy', 'stubborn']); M.sh.angry = {}; setAff(C, A, 20); fix(0.05, () => SHARES.weekly(w, npcs(), d));
      out.deny = { angryC: !!(M.sh.angry[K] || {})[C.agentId], angryB: !!(M.sh.angry[K] || {})[Bb.agentId] };
      // 4) 股東會奪權:不滿的股東加起來比當家多
      M.shares[K] = { [A.agentId]: 40, [Bb.agentId]: 35, [C.agentId]: 25 }; M.owners[K] = A.agentId; M.sh.angry[K] = { [Bb.agentId]: d, [C.agentId]: d };
      SHARES.oust(w, K, d); out.oust = { owner: M.owners[K] === Bb.agentId, st: M.sh.st.out };
      // 當家股份過半就拉不下來
      M.shares[K] = { [A.agentId]: 60, [Bb.agentId]: 25, [C.agentId]: 15 }; M.owners[K] = A.agentId; M.sh.angry[K] = { [Bb.agentId]: d, [C.agentId]: d }; SHARES.oust(w, K, d); out.oust.safe = M.owners[K] === A.agentId;
      // 5) 賣股週轉:當家欠薪沒錢,賣一部分股份給有錢人
      M.shares[K] = { [A.agentId]: 100 }; M.owners[K] = A.agentId; B[A.agentId] = 2; M.unpaid[A.agentId] = 3; B[D.agentId] = 2000; const t5 = total();
      SHARES.rescue(w, npcs()); const s5 = SHARES.stakes(w, K);
      out.rescue = { sold: (s5[A.agentId] || 0) < 100, boss: M.owners[K] === A.agentId, unpaid: M.unpaid[A.agentId] === 0, cash: B[A.agentId] > 2, buyer: Object.keys(s5).find(h => h !== A.agentId) === D.agentId, drift: Math.round((total() - t5) * 100) / 100 };
      // 6) 眼紅入股:生意好,有錢又眼紅的人出高價
      M.shares[K] = { [A.agentId]: 100 }; M.owners[K] = A.agentId; tr(A, ['greedy']); B[A.agentId] = 10; tr(E, ['jealous']); B[E.agentId] = 3000; M.hist[K] = Array.from({ length: 7 }, () => [40, 5]);
      const t6 = total(); fix(0.1, () => SHARES.weekly(w, npcs(), d)); const s6 = SHARES.stakes(w, K);
      out.buy = { holders: Object.keys(s6).length, fan: Object.keys(s6).some(h => h !== A.agentId), st: M.sh.st.buy, drift: Math.round((total() - t6) * 100) / 100 };
      // 7) 拆夥:翻臉,當家買斷
      M.shares[K] = { [A.agentId]: 70, [C.agentId]: 30 }; M.owners[K] = A.agentId; B[A.agentId] = 3000; setAff(A, C, -60); setAff(C, A, -60); M.hist[K] = Array.from({ length: 7 }, () => [5, 5]); const t7 = total();
      fix(0.1, () => SHARES.weekly(w, npcs(), d)); out.split = { only: Object.keys(SHARES.stakes(w, K)).length === 1, st: M.sh.st.split, drift: Math.round((total() - t7) * 100) / 100 };
      // 8) 整家被賣給外人:舊當家把賣價照股份分給股東
      M.shares[K] = { [A.agentId]: 60, [Bb.agentId]: 40 }; M.owners[K] = A.agentId; const before = {}; for (const k of Object.keys(MARKET.SECTORS)) before[k] = { own: M.owners[K === k ? k : k], s: M.shares[k] ? JSON.parse(JSON.stringify(M.shares[k])) : null };
      const v8 = SHARES.valueOf(w, K); B[A.agentId] = v8 + 5; const bb8 = B[Bb.agentId]; M.owners[K] = E.agentId; SHARES.reconcile(w, before);
      out.sold = { cut: Math.round((B[Bb.agentId] - bb8) * 100) / 100, exp: Math.round(v8 * 0.4 * 100) / 100, reset: JSON.stringify(SHARES.stakes(w, K)) === JSON.stringify({ [E.agentId]: 100 }) };
      // 9) 搬走:股東搬走照比例分;當家搬走由股份最多的接手
      M.shares[K] = { [A.agentId]: 50, [Bb.agentId]: 30, [C.agentId]: 20 }; M.owners[K] = A.agentId; const keepA = w.agents[A.agentId]; delete w.agents[A.agentId];
      SHARES.departures(w); out.leave = { boss: M.owners[K] === Bb.agentId, sum: Object.values(M.shares[K]).reduce((x, y) => x + y, 0), noA: !(A.agentId in M.shares[K]) }; w.agents[A.agentId] = keepA;
      // 10) 過世:股份由配偶繼承
      M.shares[K] = { [A.agentId]: 50, [C.agentId]: 50 }; M.owners[K] = A.agentId; const sp9 = D; C.relationships.getOrCreate(sp9.agentId, sp9.name).status = 'married'; sp9.relationships.getOrCreate(C.agentId, C.name).status = 'married';
      C._deathCause = 'test'; w.lifecycle._killNpc(w, C); out.inh = { heir: (M.shares[K] || {})[sp9.agentId] === 50, noC: !((M.shares[K] || {})[C.agentId]), boss: M.owners[K] === A.agentId };
      // 11) 存讀檔
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = JSON.stringify(w2.market?.shares?.[K]) === JSON.stringify(M.shares[K]) && (w2.market?.sh?.st?.syn || 0) === M.sh.st.syn;
      // 12) AI 知道、村民卡
      M.shares[K] = { [A.agentId]: 60, [Bb.agentId]: 40 }; M.owners[K] = A.agentId; M.sh.lastDiv[K] = 12;
      out.brief = { boss: MARKET.brief(w, A), hold: MARKET.brief(w, Bb), card: MARKET.describe(w, Bb) };
      // 13) 成就
      const U = app._unlockedAchievements; for (const k of ['sh_syn', 'sh_out']) U.delete(k); app._achNewOnce = true; app._achFirstCheckDone = true; app._showAchievementToast = () => {}; app._checkAchievements(); out.ach = ['sh_syn', 'sh_out'].filter(k => !U.has(k));
      // 14) 真的跑幾週:不出錯、銀幣守恆(股份那一段)
      let sd = 0; const _mt = MARKET.daily; const tick = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } };
      try { tick(96 * 15); } catch (e) { out.runErr = e.message; }
      out.run = { owners: Object.keys(MARKET.SECTORS).filter(k => M.owners[k]).length, sums: Object.keys(M.shares).every(k => !M.shares[k] || Math.abs(Object.values(M.shares[k]).reduce((x, y) => x + y, 0) - 100) < 0.01), bossIn: Object.keys(M.shares).every(k => !M.shares[k] || !M.owners[k] || M.owners[k] in M.shares[k]) };
      // 16) 提案:做假帳醜聞後有人提「帳本公開」;小股東贊成、當家反對;通過後很少人敢動手腳
      M.sh.law = {}; w.proposals.items = (w.proposals.items || []).filter(p => !/^sh_/.test(p.kind));
      M.shares[K] = { [A.agentId]: 50, [Bb.agentId]: 30, [C.agentId]: 20 }; for (const x of [A, Bb, C]) if (!w.agents[x.agentId]) w.agents[x.agentId] = x;
      M.owners[K] = A.agentId; tr(A, ['greedy']); tr(Bb, ['perfectionist']); B[A.agentId] = 500; M.hist[K] = Array.from({ length: 7 }, () => [30, 10]);
      fix(0.05, () => SHARES.weekly(w, npcs(), d)); const ap = (w.proposals.items || []).find(p => p.kind === 'sh_audit');
      for (const k of Object.keys(MARKET.SECTORS)) if (k !== K && M.owners[k] === Bb.agentId) M.owners[k] = null; /* 別家的當家會反對,這裡只看小股東 */
      const vMinor = fix(0.5, () => SHARES.vote(w, { kind: 'sh_audit' }, Bb)).v, vBoss = fix(0.5, () => SHARES.vote(w, { kind: 'sh_audit' }, A)).v;
      SHARES.enact(w, { kind: 'sh_audit' }); const ch0 = M.sh.st.cheat; fix(0.3, () => SHARES.weekly(w, npcs(), d));
      out.audit = { prop: !!ap, vMinor, vBoss, law: !!M.sh.law.audit, noCheat: M.sh.st.cheat === ch0, kind: !!PROPOSAL_KINDS.sh_audit };
      // 員工認股:工人贊成、當家反對;通過後有存款的工人認購自家產業 5%
      const wk = MARKET.workersOf(w, K, npcs()).find(a => a.agentId !== A.agentId && !M.shares[K]?.[a.agentId]);
      const vWorker = wk ? fix(0.5, () => SHARES.vote(w, { kind: 'sh_staff' }, wk)).v : 'for', vOwner = fix(0.5, () => SHARES.vote(w, { kind: 'sh_staff' }, A)).v;
      M.shares[K] = { [A.agentId]: 80, [Bb.agentId]: 20 }; SHARES.enact(w, { kind: 'sh_staff' }); if (wk) B[wk.agentId] = 2000; const t16 = total();
      fix(0.1, () => SHARES.staffBuy(w, npcs())); out.staff = { vWorker, vOwner, law: !!M.sh.law.staff, bought: wk ? Object.keys(M.shares[K]).some(h => h !== A.agentId && h !== Bb.agentId && M.shares[K][h] === 5 && MARKET.workersOf(w, K, npcs()).some(x => x.agentId === h)) : true, drift: Math.round((total() - t16) * 100) / 100 };
      // 15) 介面
      M.shares[K] = { [A.agentId]: 60, [Bb.agentId]: 40 }; M.owners[K] = A.agentId; app._setPaused?.(true);
      const mobile = innerWidth <= 768; if (mobile && app._openKairoTab) app._openKairoTab('industry'); else { app.activeTab = 'industry'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 400));
      let sec = document.querySelector('.market-section'); if (!sec) { for (const tb of ['economy', 'industry']) { if (mobile && app._openKairoTab) app._openKairoTab(tb); else { app.activeTab = tb; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300)); sec = document.querySelector('.market-section'); if (sec) break; } }
      const txt = sec?.innerText || ''; out.ui = { sec: !!sec, holders: !!sec?.querySelector('.market-holders'), meta: !!sec?.querySelector('.shares-meta'), undef: /undefined|NaN|\{[a-z]+\}/.test(txt), cjk: (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (txt.match(/[一-鿿]+/g) || []).slice(0, 6) : [], overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      return out;
    });
    const zh = lang === 'zh';
    ok(r.syn.owner && r.syn.holders >= 2 && r.syn.sum === 100 && r.syn.lead && r.syn.drift === 0 && r.syn.st >= 1 && r.syn.log, '招股：沒人一個人買得起，帶頭的人找交情好的朋友合股買下，股份照出資、帶頭的人最多、由他當家；錢進公庫、銀幣守恆', r.syn);
    ok(Math.abs(r.div.b - r.div.expB) < 0.6 && r.div.c > 0 && r.div.drift === 0, '每週分紅：利潤的六成照股份分給股東', r.div);
    ok(r.cheat.caught && r.cheat.affDrop && Math.abs(r.cheat.gotFull - r.cheat.exp) < 1 && r.cheat.drift === 0, '做假帳：貪心的當家少分，細心的股東翻帳本抓到；不嘴硬的當家把錢補回去', r.cheat);
    ok(r.deny.angryC && r.deny.angryB, '嘴硬的當家死不認帳，其他股東也跟著生氣', r.deny);
    ok(r.oust.owner && r.oust.st >= 1 && r.oust.safe, '股東會：不滿的股東加起來比當家多就換人當家；當家股份過半拉不下來', r.oust);
    ok(r.rescue.sold && r.rescue.boss && r.rescue.unpaid && r.rescue.cash && r.rescue.buyer && r.rescue.drift === 0, '賣股週轉：當家欠薪沒錢，先賣一部分股份給有錢人發工資，自己還是當家', r.rescue);
    ok(r.buy.holders === 2 && r.buy.fan && r.buy.st >= 1 && r.buy.drift === 0, '眼紅入股：生意好，有錢又眼紅的人出高價買股份', r.buy);
    ok(r.split.only && r.split.st >= 1 && r.split.drift === 0, '拆夥：當家和股東翻臉，當家買斷對方的股份', r.split);
    ok(Math.abs(r.sold.cut - r.sold.exp) < 1 && r.sold.reset, '整家被賣給外人：舊當家把賣價照股份分給其他股東', r.sold);
    ok(r.leave.boss && r.leave.sum === 100 && r.leave.noA, '當家搬走：由股份最多的股東接手（不會直接變公營）', r.leave);
    ok(r.inh.heir && r.inh.noC && r.inh.boss, '股東過世：股份由配偶繼承', r.inh);
    ok(r.save, '存讀檔：持股和紀錄都在', r.save);
    ok(/60%/.test(r.brief.boss) && /40%/.test(r.brief.hold) && /12/.test(r.brief.hold) && /40%/.test(r.brief.card), 'AI 知道自己是當家還是股東、持股多少、上週分紅；村民卡寫出持股', r.brief);
    ok(!r.ach.length, '成就：合股做生意、股東會變天', r.ach);
    ok(!r.runErr && r.run.sums && r.run.bossIn, '真的跑 15 天：不出錯，每家持股加起來 100%、當家一定是股東', { e: r.runErr, run: r.run });
    ok(r.audit.prop && r.audit.vMinor === 'for' && r.audit.vBoss === 'against' && r.audit.law && r.audit.noCheat && r.audit.kind, '提案：做假帳醜聞後有人提「產業帳本公開」，小股東贊成、當家反對；通過後很少人敢動手腳', r.audit);
    ok(r.staff.vWorker === 'for' && r.staff.vOwner === 'against' && r.staff.law && r.staff.bought && r.staff.drift === 0, '提案：「員工認股」工人贊成、當家反對；通過後有存款的工人認購自家產業 5%', r.staff);
    ok(r.ui.sec && r.ui.holders && r.ui.meta && !r.ui.undef && !r.ui.cjk.length && !r.ui.overflow, `介面：產業列出股東與持股、股份統計（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
