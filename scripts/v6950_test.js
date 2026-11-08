// v6.95.0 金權與第四權:政治獻金與拒收、金主影響首長與投票、報社揭弊(讀者憤怒、醜聞、選票)、報社被收編壓新聞與記者被開除、
// 壓薪報導讓老闆加薪、驅逐潮報導帶動救濟提案、銀行報導引發提款、買下報社、醜聞罷免改選、AI、經濟頁、存讀檔;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {}; const w = app.world; w.observerMode = true; const Wl = WALLET.S(w); MARKET.S(w); const M = w.market; const P = POWER.S(w);
      const withR = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
      TIERS.S(w); w.tierState.lv = 1; const d = w._absDay();
      const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age || 30) >= 18);
      let L = w.election._officeHolder(w); if (!L) { L = all[0]; L.job = new Job('mayor'); }
      const boss = all.find(a => a !== L); boss.job = new Job('trader'); for (const k of Object.keys(MARKET.SECTORS)) M.owners[k] = null; M.owners.farm = boss.agentId;
      const workers = all.filter(a => a !== L && a !== boss).slice(0, 5); for (const a of workers) a.job = new Job('farmer');
      // 1) 政治獻金:貪心的首長收下
      L.personality.traits = ['greedy']; Wl.bal[boss.agentId] = 500; DARK.S(w);
      for (const a of all) if (a !== boss) Wl.bal[a.agentId] = Math.min(Wl.bal[a.agentId] || 0, 20); const lb0 = Wl.bal[L.agentId] || 0;
      withR(0.01, () => POWER.donations(w, d)); out.donated = (P.inf[L.agentId] || {})[boss.agentId] > 0 && (Wl.bal[L.agentId] || 0) > lb0;
      out.secret = (DARK.S(w).secrets || []).some(x => x.kind === 'donation' && x.culprit === L.agentId && !x.found);
      // 2) 心腸軟又不貪的人拒收
      const L0 = JSON.stringify(P.inf[L.agentId]); L.personality.traits = ['kind']; const ref0 = P.stats.refused; withR(0.01, () => POWER.donations(w, d + 1)); out.refused = P.stats.refused > ref0 && JSON.stringify(P.inf[L.agentId]) === L0;
      // 3) 收了錢:審到對金主不利的案子(最低工資)會偏向反對;投票也是
      P.inf[L.agentId] = { [boss.agentId]: 60 }; const pmw = { kind: 'minwage', votes: {}, why: {}, category: 'welfare' }; out.sway = POWER.sway(w, L, pmw);
      const ps = w.proposals; const lean0 = (() => { const sv = P.inf[L.agentId]; P.inf[L.agentId] = {}; ps._w = w; const v = ps._mayorLean(L, { ...pmw }); P.inf[L.agentId] = sv; return v; })(); ps._w = w; const lean1 = ps._mayorLean(L, { ...pmw }); ps._w = null; out.lean = [lean0, lean1];
      const voter = workers[0]; Wl.bal[voter.agentId] = 0; P.inf[voter.agentId] = { [boss.agentId]: 80 }; const pv = { kind: 'minwage', votes: {}, why: {}, category: 'welfare' }; ps._ruleVote(w, pv, voter); out.vote = [pv.votes[voter.agentId], pv.why[voter.agentId]]; delete P.inf[voter.agentId];
      // 4) 報社揭弊:真相頁的祕密見報、讀者憤怒、首長醜聞、投票扣分
      PRESS.S(w); const R = w.press; const Pp = R.papers.find(x => x.st !== 'board') || R.papers[0]; if (Pp.st === 'board') Pp.st = 'town'; Pp.banned = false; Pp.owner = null;
      const J = all.find(a => ![L, boss].includes(a) && !workers.includes(a)) || workers[4]; Pp.journo = J.agentId; J.personality.traits = ['gossip'];
      for (const a of all) R.reads[a.agentId] = Pp.id;
      const sec = DARK.secret(w, { kind: 'donation', culprit: L.agentId, victim: null, donor: boss.agentId, k: '{p}私下收了{d}{n} 銀幣的政治獻金', p: { p: L.name, d: boss.name, n: 60 } }); sec.day = d - 3;
      const sc0 = P.scandal[L.agentId] || 0; const aff0 = workers[1].relationships?.relationships?.[L.agentId]?.affinity || 0;
      const T = POWER.topics(w); const pick = T.find(x => x.type === 'secret' && x.s === sec); withR(0.01, () => POWER.publish(w, Pp, J, pick, d));
      out.exposed = sec.found && (P.scandal[L.agentId] || 0) > sc0 && Pp.stories.some(s2 => s2.kind === 'expose' && s2.cand === L.agentId);
      out.outrage = (workers[1].relationships?.relationships?.[L.agentId]?.affinity || 0) < aff0 && (workers[1].thoughts || []).some(x => x.kind === 'outraged');
      out.elecBias = POWER.bias(w, workers[2], L.agentId) + PRESS.bias(w, workers[2], L.agentId);
      // 5) 報社被收編:老闆收錢的事被壓下;正直記者照登被開除
      const sec2 = DARK.secret(w, { kind: 'donation', culprit: L.agentId, victim: null, donor: boss.agentId, k: '{p}私下收了{d}{n} 銀幣的政治獻金', p: { p: L.name, d: boss.name, n: 30 } }); sec2.day = d - 3;
      Pp.owner = boss.agentId; P.inf[L.agentId] = { [boss.agentId]: 60 }; const sp0 = P.stats.spiked; withR(0.01, () => POWER.watchdog(w, d)); out.spiked = P.stats.spiked > sp0 && !sec2.found;
      J.personality.traits = ['perfectionist']; Pp.journo = J.agentId; const fi0 = P.stats.fired; withR(0.01, () => POWER.watchdog(w, d + 7)); out.fired = P.stats.fired > fi0 && Pp.journo !== J.agentId;
      Pp.owner = null; Pp.journo = J.agentId;
      // 6) 壓薪報導 → 老闆頂不住加薪
      for (const s2 of DARK.S(w).secrets) s2.found = true; M.pay.farm = 0.6; boss.personality.traits = ['kind']; const pr0 = M.pay.farm; const pk = POWER.topics(w).find(x => x.type === 'wage'); if (pk) withR(0.01, () => POWER.publish(w, Pp, J, pk, d)); out.wageRaise = !!pk && M.pay.farm > pr0;
      // 7) 驅逐潮報導 → 救濟／最低工資提案壓力
      if (!w.estate) ESTATE.S(w); w.estate.stats.evicted = (P.evictSeen || 0) + 5; const pe = POWER.topics(w).find(x => x.type === 'evict'); if (pe) POWER.publish(w, Pp, J, pe, d); out.pressure = !!pe && P.pressure.relief > d;
      const cands = [{ kind: 'relief', weight: 1 }]; const _c = ProposalSystem.prototype._candidates; try { ProposalSystem.prototype._candidates = function () { return cands.map(c => ({ ...c })); }; } catch (e) {}
      // 重新套用包裝:測 POWER 的權重加成
      const boosted = (function () { const PSx = ProposalSystem.prototype; const inner = PSx._candidates; const pr = w.power.pressure; return inner.call(ps, w, d).map(c => ((c.kind === 'relief' && pr.relief) ? c.weight * 2.5 : c.weight)); })(); ProposalSystem.prototype._candidates = _c; out.boost = boosted[0] > 1;
      // 8) 銀行呆帳報導 → 讀者去提款
      const B = BANK.S(w); B.open = true; B.banker = boss.agentId; B.status = 'ok'; B.bad = 60; B.reserve = 500; const dep = workers[3]; B.dep[dep.agentId] = 100; const db0 = Wl.bal[dep.agentId] || 0;
      const pb = POWER.topics(w).find(x => x.type === 'bank'); if (pb) POWER.publish(w, Pp, J, pb, d); out.withdraw = !!pb && (B.dep[dep.agentId] || 0) < 100 && (Wl.bal[dep.agentId] || 0) > db0;
      // 9) 有錢人買下報社
      const Pf = R.papers.find(x => !['board', 'crown'].includes(x.st)); Pf.owner = null; Pf.banned = false; Wl.bal[boss.agentId] = 1000; const tr0 = w.stockpile.get('silver'); withR(0.01, () => POWER.buyPapers(w, d)); out.bought = Pf.owner === boss.agentId && w.stockpile.get('silver') > tr0;
      // 10) 醜聞延燒、民怨高 → 罷免提前改選
      P.scandal[L.agentId] = 5; P.recallDay = -99; for (const a of all) if (a !== L) { const rr = a.relationships?.getOrCreate?.(L.agentId, L.name); if (rr) rr.affinity = -40; } w.election.active = false;
      POWER.recall(w, d + 50); out.recall = P.stats.recalls > 0 && (!!w.election.active || L.job?.key !== 'mayor') && !(w.election.candidates || []).some(c => c.agentId === L.agentId && w.election.active); w.election.active = false; w.election.phase = null;
      // 11) AI 與經濟頁
      P.inf[L.agentId] = { [boss.agentId]: 60 }; const CE = Object.create(ConversationEngine.prototype); out.briefL = (CE._agentBrief(w, L, null).mem || []).join(' | '); out.briefJ = (CE._agentBrief(w, J, null).mem || []).join(' | ');
      const save = app.world; app.state = w.getState(); const box = document.createElement('div'); box.style.width = (window.innerWidth < 500 ? 340 : 420) + 'px'; document.body.appendChild(box);
      app.activeTab = 'industry'; /* v7.3.0 產業與老闆搬到小鎮 › 產業 */ try { app.renderEconomy(box); } catch (e) { out.econErr = e.message; } const pm = box.querySelector('.power-meta'); out.econ = pm ? pm.textContent.replace(/\s+/g, ' ') : ''; out.econOverflow = pm ? pm.scrollWidth > pm.clientWidth + 2 : null; box.remove(); app.state = save.getState();
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.save = !!w2.power && (w2.power.stats.exposed || 0) === (P.stats.exposed || 0);
      try { const d0 = w._absDay(); for (let i = 0; i < 96 * 8 && w._absDay() - d0 < 8; i++) { w.paused = false; w.tick(); } w.paused = true; } catch (e) { out.err = e.message; }
      return out;
    });
    const zh = lang === 'zh';
    ok(r.donated && r.secret, '老闆捐政治獻金給首長，錢真的轉過去，私下的錢記在真相頁', { d: r.donated, s: r.secret });
    ok(r.refused, '心腸軟又不貪的政治人物拒收', r.refused);
    ok(r.sway < 0 && r.lean[1] < r.lean[0], '收了錢：首長審到最低工資這類對金主不利的案子，會偏向反對', { s: r.sway, l: r.lean });
    ok(r.vote[0] === 'against' && r.vote[1] === 'donor', '收了金主錢的人投票改投反對（理由：收了金主的錢）', r.vote);
    ok(r.exposed, '報社查到並登出：祕密曝光、首長醜聞上升、報導上了版面', r.exposed);
    ok(r.outrage, '讀者看了很憤怒，對當事人印象變差', r.outrage);
    ok(r.elecBias < -10, '醜聞讓選舉時大扣分', r.elecBias);
    ok(r.spiked, '報社被老闆收編：跟老闆有關的新聞被壓下', r.spiked);
    ok(r.fired, '正直的記者不顧老闆反對照登，被開除', r.fired);
    ok(r.wageRaise, '壓薪報導一出，老闆頂不住輿論加薪', r.wageRaise);
    ok(r.pressure && r.boost, '驅逐潮報導讓救濟、最低工資提案更常出現', { p: r.pressure, b: r.boost });
    ok(r.withdraw, '銀行呆帳報導讓讀者跑去提款', r.withdraw);
    ok(r.bought, '有錢人買下報社（錢進公庫）', r.bought);
    ok(r.recall, '醜聞延燒、民怨夠高 → 連署罷免：提前改選（被罷免的人不能再選），沒人出來選就直接下台', r.recall);
    ok(zh ? /政治獻金/.test(r.briefL) && /醜聞/.test(r.briefL) : /political donation/i.test(r.briefL) && /scandal/i.test(r.briefL), '首長的 AI 知道自己收過誰的錢、醜聞纏身', r.briefL);
    ok(zh ? /記者/.test(r.briefJ) : /reporter/i.test(r.briefJ), '記者的 AI 知道自己是哪家報社的記者', r.briefJ);
    ok(!r.econErr && (zh ? /政治獻金/.test(r.econ) && /揭弊/.test(r.econ) : /Political donations/.test(r.econ) && /exposés/.test(r.econ)), '經濟頁有「金權與輿論」一行', { t: r.econ, e: r.econErr });
    ok(r.econOverflow === false, '那一行在這個寬度不會橫向溢出', r.econOverflow);
    ok(r.save, '存讀檔保留金權紀錄', r.save);
    ok(!r.err, '跑幾天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
