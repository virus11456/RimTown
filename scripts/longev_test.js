// v8.7.0 長生:賢者之石(煉以太、療癒、驅動造物、凝石與碎裂、給誰、戴著不老、離身老去或化為塵土、被偷與抓賊)、
// 基因延壽療程(自費給醫生、晚十五年老死、舊存檔、基因失調、生育力下降)、投票、存讀檔、銀幣守恆、介面(中英、桌機與 390px)
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e.stack || e.message).slice(0, 400))); page.on('console', m => { if (m.type() === 'warning' && /\[Longev\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      WALLET.S(w); HEALTH.S(w); const L = LONGEV.S(w); const B = w.wallet.bal; const sp = w.stockpile; let d = w._absDay(); w._absDay = () => d;
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_') && (a.age ?? 30) >= 16);
      const total = () => Math.round(((sp.get('silver') || 0) + Object.values(B).reduce((s, v) => s + (v || 0), 0)) * 100) / 100;
      const setDone = (k) => { const q = w.research.projects[k]; if (q) { q.status = 'complete'; q.progress = q.cost; } };
      const tr = (a, k) => { a.personality.traits = [...new Set([...(a.personality.traits || []).filter(x => !['greedy', 'jealous', 'neurotic', 'pessimist', 'optimist'].includes(x)), ...k])]; };
      const ppl = npcs(); const [R1, R2, P, Q, E, F] = ppl; R1.job = { ...(R1.job || {}), key: 'researcher' }; R2.job = { ...(R2.job || {}), key: 'researcher' };
      for (const a of ppl.slice(2)) if (a.job?.key === 'researcher') a.job.key = 'farmer';
      setDone('philosopher_stone'); w.buildings.completed.push({ buildingKey: 'alchemy_lab', key: 'alchemy_lab', name: BUILDING_TEMPLATES.alchemy_lab?.name || 'alchemy_lab' });
      const fillMat = () => { sp.add('stone', 200, w.tickCount, 't'); sp.add('metal', 50, w.tickCount, 't'); };
      // 1) 挖以太礦:研究以太引擎以後,礦工越多挖越多
      L.ae = 0; LONGEV.mine(w, L); const before = L.ae; setDone('aether_engine'); const miners = npcs().filter(a => a.job?.key === 'miner').length; LONGEV.mine(w, L);
      out.mine = { locked: before === 0, got: Math.round(L.ae * 100) / 100, exp: Math.round((0.5 + 0.35 * Math.min(6, miners)) * 100) / 100 };
      // 2) 以太療癒:過生活模式下兩份以太治好一個傷病
      HEALTH.addAil(w, P, { p: 'h', k: 'injury', s: 2, dmg: 10 }, 'test'); L.ae = 5; L.prio = 'life'; fix(0.99, () => LONGEV.useAether(w, L, d)); out.heal = { cured: HEALTH.ails(w, P).length === 0, ae: L.ae };
      // 3) 驅動造物:供得夠就有加成;不夠就停擺
      setDone('clockwork_automaton'); L.ae = 50; L.pw = 0; L.powered = false; w.buildings.recomputeEffects(w); const bs0 = w.buildings.getEffect('build_speed', 1);
      fix(0.99, () => LONGEV.useAether(w, L, d)); const bs1 = w.buildings.getEffect('build_speed', 1); out.wonder = { powered: L.powered, pw: L.pw, boost: Math.round((bs1 - bs0) * 100) / 100 };
      L.ae = 0; fix(0.99, () => LONGEV.useAether(w, L, d)); out.wonder.off = !L.powered; w.buildings.recomputeEffects(w);
      // 4) 存起來煉石:造物只供一半,剩下全存;滿了凝石,一半機會碎掉
      fillMat(); L.prio = 'stone'; L.ae = 60; L.gw = 0; L.ready = null; L.held = null; const need = LONGEV.wondersOf(w).length * 0.8; fix(0.99, () => LONGEV.useAether(w, L, d));
      out.save2 = { half: Math.abs(L.pw - 0.5) < 0.01, stored: L.gw > 50, canStone: LONGEV.canStone(w) };
      L.ae = 0; L.gw = LONGEV.GREAT; fix(0.3, () => LONGEV.useAether(w, L, d)); out.stone = { shatter: L.gw === Math.round(LONGEV.GREAT * 0.4) && !L.ready };
      L.ae = 0; L.gw = LONGEV.GREAT; fix(0.9, () => LONGEV.useAether(w, L, d)); out.stone.ready = !!L.ready;
      // 存還是用:信徒老人想存、年輕老闆和家裡有病人的想過生活
      const _rel0 = FAITH.relOf, _pi0 = FAITH.pietyOf; FAITH.relOf = (ww, a) => a === E ? { id: 'x' } : null; FAITH.pietyOf = () => 90; E.age = 70;
      const vOld = fix(0.5, () => LONGEV.vote(w, { kind: 'ae_use', aeTo: 'stone' }, E)).v; FAITH.relOf = _rel0; FAITH.pietyOf = _pi0;
      HEALTH.addAil(w, P, { p: 'f', k: 'disease', s: 2, dmg: 5 }, 'test'); P.age = 25; const vSick = fix(0.5, () => LONGEV.vote(w, { kind: 'ae_use', aeTo: 'stone' }, P)).v;
      out.use = { vOld, vSick, kind: !!PROPOSAL_KINDS.ae_use }; L.prio = 'life'; HEALTH.S(w).a[P.agentId] = [];
      // 5) 給誰:提案;通過後戴上
      w.crown = w.crown || {}; w.crown.king = null; L.tried = []; L.lastTry = -99; w.proposals.items = (w.proposals.items || []).filter(p => p.kind !== 'ae_grant');
      fix(0.5, () => LONGEV.grantFlow(w, L, d)); const gp = (w.proposals.items || []).find(p => p.kind === 'ae_grant');
      out.grant = { prop: !!gp, why: gp?.aeWhy };
      HEALTH.addAil(w, Q, { p: 'f', k: 'injury', s: 1, dmg: 5 }, 'test'); Q.age = 40; const res = LONGEV.enact(w, { kind: 'ae_grant', aeWho: Q.agentId, aeWhy: 'elder' });
      out.grant.held = LONGEV.isImm(w, Q) && !!res && HEALTH.ails(w, Q).length === 0 && !L.ready;
      // 6) 戴著不老:生日照過,外表停住,真實年紀記著
      Q.age = 42; L.held.charge = 100; L.ae = 0; d = d - (d % 7); fix(0.99, () => LONGEV.immDaily(w, L, d)); out.frozen = { age: Q.age, real: L.held?.real, extra: L.held?.extra, ageEff: LONGEV.ageEff(w, Q) };
      // 點石成鋼:鎮上缺鋼就幫忙,但石頭的能量會掉;能量用以太補
      sp.resources.steel = 0; d = d - (d % 7) + 3; L.held.charge = 100; L.ae = 0; tr(Q, ['kind']); fix(0.1, () => LONGEV.immDaily(w, L, d)); out.steel = { got: sp.get('steel'), charge: Math.round(L.held.charge) };
      L.held.charge = 50; L.ae = 30; L.prio = 'life'; d = d - (d % 7) + 1; fix(0.99, () => LONGEV.immDaily(w, L, d)); out.steel.recharge = L.held.charge > 50 && L.ae === 29;
      // 7) 被偷:小偷戴上,原主一夜老去;幾天後被抓,石頭還回去
      tr(E, ['greedy']); E.relationships.getOrCreate(Q.agentId, Q.name).affinity = -20; const others = npcs().filter(a => a !== Q && a !== E); for (const o of others) tr(o, []);
      L.held.real = 50; L.held.vis = 40; L.held.charge = 100; d = d - (d % 7) + 1; fix(0.001, () => LONGEV.immDaily(w, L, d)); out.theft = { thief: L.held?.id === E.agentId, aged: Q.age === 50, alive: !Q.isDead };
      w.agents[R1.agentId].job.key = 'guard'; d += 4; fix(0.01, () => LONGEV.theftDaily(w, L, d)); out.theft.back = L.held?.id === Q.agentId && L.st.caught >= 1; R1.job.key = 'researcher';
      // 8) 離身:真實年紀太大當場化為塵土
      L.held.real = 95; const victim = Q; LONGEV.lose(w, L, victim, 'test'); out.dust = { dead: !!victim.isDead || !w.agents[victim.agentId] || w.agents[victim.agentId].isDead, st: L.st.dust };
      // 9) 投票:神職候選人,虔誠的贊成;眼紅的反對
      const _rel = FAITH.relOf, _pi = FAITH.pietyOf; FAITH.relOf = () => ({ id: 'x' }); FAITH.pietyOf = () => 90; F.job = { ...(F.job || {}), key: 'priest' };
      const vHoly = fix(0.5, () => LONGEV.vote(w, { kind: 'ae_grant', aeWho: F.agentId, aeWhy: 'priest' }, P)).v; FAITH.relOf = _rel; FAITH.pietyOf = _pi;
      tr(R2, ['jealous']); R2.relationships.getOrCreate(F.agentId, F.name).affinity = 0; const vEnvy = fix(0.5, () => LONGEV.vote(w, { kind: 'ae_grant', aeWho: F.agentId, aeWhy: 'rich' }, R2)).v;
      out.vote = { vHoly, vEnvy };
      // 10) 有錢人買石頭:250 銀幣進公庫,銀幣守恆
      L.ready = d; L.held = null; B[R2.agentId] = 400; const t10 = total(); const tre = sp.get('silver'); LONGEV.enact(w, { kind: 'ae_grant', aeWho: R2.agentId, aeWhy: 'rich' });
      out.buy = { held: LONGEV.isImm(w, R2), toTown: Math.round(sp.get('silver') - tre), drift: Math.round((total() - t10) * 100) / 100 };
      // 11) 基因延壽療程:舊存檔遷移、自費給醫生、晚十五年
      setDone('life_extension'); L.gene = {}; L.v87 = 0; const all = npcs(); for (const a of all) { B[a.agentId] = 100; tr(a, ['optimist']); }
      const doc = all.find(a => a.job?.key === 'doctor') || all[all.length - 1]; doc.job = { ...(doc.job || {}), key: 'doctor' }; const t11 = total(); const docB = B[doc.agentId];
      fix(0.01, () => LONGEV.geneWeekly(w, L, d)); const migrated = Object.keys(L.gene).length; d += 7; fix(0.01, () => LONGEV.geneWeekly(w, L, d));
      const tg = Object.keys(L.gene).find(id => w.agents[id] && w.agents[id] !== doc); const ta = tg && w.agents[tg];
      out.gene = { migrated: migrated >= 1, treated: L.st.treated, docPaid: B[doc.agentId] > docB, drift: Math.round((total() - t11) * 100) / 100, shift: ta ? (ta.age - LONGEV.ageEff(w, ta)) : -1 };
      // 12) 代價:基因失調、生育力下降
      const dis0 = L.st.disorder; fix(0, () => LONGEV.geneDaily(w, L)); out.cost = { disorder: L.st.disorder > dis0 };
      const n0 = Object.keys(w.agents).length; const mate = npcs().find(a => a !== ta); fix(0.1, () => w.lifecycle._birthChild(w, ta, mate, false)); out.cost.blocked = Object.keys(w.agents).length === n0 && L.st.blocked >= 1;
      // 13) 存讀檔
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = w2.longev?.held?.id === L.held?.id && Object.keys(w2.longev?.gene || {}).length === Object.keys(L.gene).length;
      // 14) 跑幾天不出錯
      try { const tick = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } }; w._absDay = World.prototype._absDay; tick(96 * 10); } catch (e) { out.runErr = e.message; }
      // 15) 介面:科技分頁的長生那一行
      app._setPaused?.(true); w.tech = w.tech || {}; TECH.S(w); const mobile = innerWidth <= 768; if (mobile && app._openKairoTab) app._openKairoTab('econ-tech'); else { app.activeTab = 'econ-tech'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 400));
      const line = document.querySelector('.longev-line'); const txt = line?.innerText || '';
      out.ui = { line: !!line, ae: /以太|Aether/.test(txt), undef: /undefined|NaN|\{[a-z]+\}/.test(txt), cjk: (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (txt.match(/[一-鿿]+/g) || []).slice(0, 6) : [], overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      return out;
    });
    const zh = lang === 'zh';
    ok(r.mine.locked && Math.abs(r.mine.got - r.mine.exp) < 0.01, '以太礦：研究以太引擎以後才挖得到，礦工越多挖越多', r.mine);
    ok(r.heal.cured && r.heal.ae <= 3 && r.heal.ae >= 2, '以太療癒：兩份以太治好一個傷病，沒有後遺症', r.heal);
    ok(r.wonder.powered && r.wonder.pw === 1 && r.wonder.boost >= 0.09 && r.wonder.off, '過生活：以太供得夠，造物運轉、建造加快；不夠就停擺', r.wonder);
    ok(r.save2.half && r.save2.stored && r.save2.canStone, '存起來煉石：造物只剩一半力氣，剩下的以太全存進賢者之石', r.save2);
    ok(r.stone.shatter && r.stone.ready, '凝石很難：存滿 300 份，最後一步一半機會碎掉（只救回一部分）', r.stone);
    ok(r.use.vOld === 'for' && r.use.vSick === 'against' && r.use.kind, '存還是用：虔誠的老人想存、家裡有病人的年輕人想先過生活', r.use);
    ok(r.grant.prop && r.grant.held, '完整的賢者之石：全鎮提案決定給誰；通過後戴上、傷病全好', r.grant);
    ok(r.frozen.age === 40 && r.frozen.real === 42 && Math.abs(r.frozen.extra - 1.5) < 0.01 && r.frozen.ageEff === 40, '戴著賢者之石老得很慢：過了兩次生日外表只老半歲，真實年紀另外記著（不是永生，照外表年紀算老死）', r.frozen);
    ok(r.steel.got === 3 && r.steel.charge < 92 && r.steel.recharge, '點石成鋼：鎮上缺鋼時大方的持有人幫忙，但石頭的能量會掉；能量用鎮上的以太補', r.steel);
    ok(r.theft.thief && r.theft.aged && r.theft.alive && r.theft.back, '被偷：小偷戴上、原主一夜老回真實年紀；守衛抓到小偷，石頭還回去', r.theft);
    ok(r.dust.dead && r.dust.st >= 1, '離身：真實年紀太大的持有人當場化為塵土', r.dust);
    ok(r.vote.vHoly === 'for' && r.vote.vEnvy === 'against', '投票：神職候選人，虔誠的人贊成（以太是神的氣息）；眼紅的人反對', r.vote);
    ok(r.buy.held && r.buy.toTown === 250 && r.buy.drift === 0, '有錢人出 250 銀幣買下賢者之石：錢進公庫，銀幣守恆', r.buy);
    ok(r.gene.migrated && r.gene.treated >= 1 && r.gene.docPaid && r.gene.drift === 0 && r.gene.shift === 15, '基因延壽：舊存檔遷移、自費做療程（錢給醫生）、做過的人老死晚十五年；銀幣守恆', r.gene);
    ok(r.cost.disorder && r.cost.blocked, '基因延壽的代價：基因失調、生育力下降', r.cost);
    ok(r.save, '存讀檔：持有人與療程名單都在', r.save);
    ok(!r.runErr, '真的跑十天不出錯', r.runErr);
    ok(r.ui.line && r.ui.ae && !r.ui.undef && !r.ui.cjk.length && !r.ui.overflow, `介面：科技分頁顯示以太、賢者之石與延壽療程（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
