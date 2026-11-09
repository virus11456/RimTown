// v8.5.0 世界級災厄（電子機械）：核子世界大戰、外星文明入侵、AI 控制全人類
// 會不會發生與是哪一種、六段（徵兆→研究與爭論→口耳相傳→惡化與恐慌→降臨→災後世界）、全鎮分兩派、提案與投票、
// 主對策賽跑（化解／減輕／重創）、降臨的損失（人命、建築、文明倒退、災後反應）、拔掉 AI、災後誰丟臉、
// 撐過寫進工坊（帳號共用）、工坊發動壓縮版、跟病原體互斥、神力、銀幣守恆、存讀檔、成就、AI 知道、介面（中英、桌機與 390px）
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[WorldCal\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.setItem('rimtown_god_sandbox', '0'); localStorage.removeItem('rimtown_worldcal'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      let d = w._absDay(); w._absDay = () => d; let wcDrift = 0; const step = (n = 1) => { for (let i = 0; i < n; i++) { d++; const T0 = MONEY.total(w), p0 = MONEY.S(w).pend || 0; WORLDCAL.daily(w); wcDrift += (MONEY.total(w) - T0) - ((MONEY.S(w).pend || 0) - p0); try { w.proposals.daily(w); } catch (e) {} } }; // 只量世界級災厄自己那一步的帳(別的系統的背景差額不算)
      const adults = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && !String(a.agentId).startsWith('visit_'));
      const P = () => w.research.projects; const setDone = (ks, on = true) => { const Q = P(); for (const k of ks) if (Q[k]) { Q[k].status = on ? 'complete' : 'locked'; if (on) Q[k].progress = Q[k].cost; } };
      const E6 = ['rocketry', 'nuclear_weapons', 'satellite', 'space_station', 'quantum_computer', 'ai_agent'];
      const flowed = () => MONEY.total(w) - (MONEY.S(w).pend || 0); try { WALLET.S(w); } catch (e) {}
      const snap = JSON.stringify(w.serialize()); const restore = () => { w.loadSave(JSON.parse(snap)); w.observerMode = true; w._absDay = () => d; w.tech = w.tech || {}; TECH.S(w); w.tech.path = 'electro'; setDone(E6); addB(); }; // 每一段從同一個小鎮開始(只推天數不跑時間,別的系統的心情不會消退)
      // 1) 會不會發生、是哪一種
      w.tech = w.tech || {}; TECH.S(w); const p0 = w.tech.path; w.tech.path = 'bio'; setDone(['rocketry', 'satellite', 'space_station', 'quantum_computer']);
      const notElectro = WORLDCAL.eligible(w); w.tech.path = 'electro'; const yes = WORLDCAL.eligible(w); setDone(['satellite', 'space_station', 'quantum_computer'], false); const few = WORLDCAL.eligible(w);
      setDone(E6, false); setDone(['nuclear_weapons', 'rocketry']); const wN = WORLDCAL.weights(w); setDone(E6, false); setDone(['ai_agent', 'quantum_computer']); const wA = WORLDCAL.weights(w); setDone(E6, false); setDone(['space_station', 'satellite', 'rocketry']); const wS = WORLDCAL.weights(w);
      const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0][0];
      out.elig = { notElectro, yes, few, n: top(wN), a: top(wA), s: top(wS) };
      // 2) 自然發生:六段、天數
      const addB = () => { for (const k of ['launch_site', 'power_plant', 'tavern']) w.buildings.completed.push({ buildingKey: k, key: k, name: BUILDING_TEMPLATES[k]?.name || k }); }; addB();
      setDone(E6); w.worldcal = null; const c = WORLDCAL.begin(w, 'nukewar', 'nature'); const tot = Object.values(c.len).reduce((s, v) => s + v, 0);
      out.begin = { ph: c.ph, tot, left: WORLDCAL.leftDays(w, c), omenLog: (w.messageLog || []).slice(-30).some(m => /📻|✈️|🛰️|📰|radio|planes|satellite|caravan/i.test(String(m.content || ''))) };
      const pw0 = CALAMITY.S(w).power; CALAMITY.S(w).power = 20;
      while (c.ph === 'omen') step(); const deb = { ph: c.ph, deny: c.deny.length, warn: c.warn.length, fixProp: (w.proposals.items || []).some(p => p.kind === 'wc_fix'), res: !!c.res };
      // 投票:說沒事的反對、喊危險的贊成
      const dn = w.agents[c.deny[0]], wn = w.agents[c.warn[0]]; deb.vote = dn && wn ? [fix(0.5, () => WORLDCAL.vote(w, { kind: 'wc_fix' }, dn)).v, fix(0.5, () => WORLDCAL.vote(w, { kind: 'wc_fix' }, wn)).v] : null;
      out.debate = deb;
      // 全力研究:研究暫停、進度變快
      const g0 = c.prog; WORLDCAL._t.progDaily(w, c); const slow = c.prog - g0; const cur0 = w.research.current; WORLDCAL.enact(w, { kind: 'wc_fix' }); const g1 = c.prog; WORLDCAL._t.progDaily(w, c); const fast = c.prog - g1;
      out.fix = { slow, fast, faster: fast > slow * 2.5, paused: !w.research.current, fix: !!c.fix };
      while (c.ph === 'debate') step(); const rumDay = c.pd; const rum = { ph: c.ph, shelter: (w.proposals.items || []).some(p => p.kind === 'wc_shelter') };
      const pwR = CALAMITY.S(w).power; while (c.ph === 'rumor') step(); rum.power = CALAMITY.S(w).power > pwR; rum.ph2 = c.ph; out.rumor = rum;
      // 存讀檔(恐慌中)
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { ph: w2.worldcal?.cur?.ph, kind: w2.worldcal?.cur?.kind, prog: w2.worldcal?.cur?.prog === c.prog };
      // 3) 降臨:沒做到 → 重創
      c.prog = 10; c.prep = null; const pop0 = adults().length; const b0 = (w.buildings.completed || []).length; const regs0 = (CALAMITY.S(w).regs || []).length; const fear = c.deny.slice();
      while (c.ph === 'panic') step(); const arrDay = c.pd; out.hit = { out: c.out, dead: c.dead, popDrop: pop0 - adults().length, wrecked: b0 - (w.buildings.completed || []).length, regress: (CALAMITY.S(w).regs || []).length > regs0, shock: (w.crisis?.cur || []).some(x => x.kind === 'wc_nukewar') };
      const faces = fear.map(id => w.agents[id]).filter(a => a && !a.isDead).map(a => WAYS.faceOf(w, a));
      while (w.worldcal.cur) step(); const h = w.worldcal.hist[0];
      out.end = { hist: h?.kind === 'nukewar' && h?.out === 'hit', unl: WORLDCAL.unlocked('nukewar'), lose: fear.map(id => w.agents[id]).filter(a => a && !a.isDead).some((a, i) => WAYS.faceOf(w, a) < (faces[i] ?? 101)), next: w.worldcal.next - d >= 600, drift: Math.round(wcDrift * 100) / 100 };
      // 4) 化解:主對策做完
      restore();
      WORLDCAL.S(w).cool = 0; WORLDCAL.S(w).next = 0; const c2 = WORLDCAL.begin(w, 'aliens', 'nature'); c2.ph = 'panic'; c2.pd = d; c2.prog = 100; c2.used.fixDone = 1; const pop1 = adults().length; const regs1 = (CALAMITY.S(w).regs || []).length;
      while (c2.ph === 'panic') step(); out.averted = { out: c2.out, dead: c2.dead, pop: c2.left, regress: (CALAMITY.S(w).regs || []).length === regs1 }; while (w.worldcal.cur) step();
      // 減輕
      restore();
      const c3 = WORLDCAL.begin(w, 'nukewar', 'nature'); c3.ph = 'panic'; c3.pd = d; c3.prog = 60; c3.prep = d; while (c3.ph === 'panic') step(); out.eased = { out: c3.out }; while (w.worldcal.cur) step();
      // 5) AI:拔掉 AI 全智能體
      restore();
      setDone(E6); const c4 = WORLDCAL.begin(w, 'ai', 'nature'); const vic = adults()[3]; w.tech.mk[vic.agentId] = 'laid'; const own = adults().find(a => { try { return MARKET.ownedBy(w, a.agentId).length > 0; } catch (e) { return false; } });
      out.unplugVote = { laid: fix(0.5, () => WORLDCAL.vote(w, { kind: 'wc_unplug' }, vic)).v, own: own ? fix(0.5, () => WORLDCAL.vote(w, { kind: 'wc_unplug' }, own)).v : 'against' };
      const pr4 = c4.prog; WORLDCAL.enact(w, { kind: 'wc_unplug' }); out.unplug = { lost: P().ai_agent?.status !== 'complete', prog: c4.prog - pr4 >= 25, prep: !!c4.prep };
      c4.ph = 'panic'; c4.pd = d; c4.prog = 20; while (c4.ph === 'panic') step(); out.ai = { out: c4.out, ctrl: c4.ctrl === 1 }; while (w.worldcal.cur) step(); out.ai.end = (w.messageLog || []).slice(-80).some(m => /✊|cuts the AI/.test(String(m.content || '')));
      // 6) 工坊發動:撐過才能、花 80 神力、壓縮版、跟病原體互斥
      restore();
      WORLDCAL.S(w).cool = 0; const C = CALAMITY.S(w); C.power = 50; const poor = WORLDCAL.canLab(w, 'aliens').why; const locked = (localStorage.removeItem('rimtown_worldcal'), WORLDCAL.canLab(w, 'aliens').why); localStorage.setItem('rimtown_worldcal', JSON.stringify(['aliens', 'nukewar', 'ai']));
      C.power = 100; const rl = WORLDCAL.release(w, 'aliens'); const c5 = w.worldcal.cur; const ft = Object.values(c5.len).reduce((s, v) => s + v, 0);
      const plague = CALAMITY.release(w, { name: 'X', route: ['contact'], sym: ['cough'], quirk: [], latency: 'short', length: 'short' }).why;
      out.lab = { poor, locked, ok: rl.ok, spent: 100 - C.power, src: c5.src, ft, plague, busy: WORLDCAL.canLab(w, 'nukewar').why };
      // AI 知道
      out.brief = { town: WORLDCAL.townBrief(w), mem: c5.deny.length ? WORLDCAL.brief(w, w.agents[c5.deny[0]]) : 'x' };
      while (c5.ph !== 'debate') step(); out.brief.town2 = WORLDCAL.townBrief(w); out.brief.mem = c5.deny.length ? WORLDCAL.brief(w, w.agents[c5.deny[0]]) : 'skip';
      // 成就
      w.worldcal.hist.push({ kind: 'nukewar', out: 'hit', src: 'nature' }, { kind: 'aliens', out: 'averted', src: 'nature' }, { kind: 'ai', out: 'eased', src: 'nature' });
      const U = app._unlockedAchievements; for (const k of ['wc_nukewar', 'wc_aliens', 'wc_ai', 'wc_averted', 'wc_lab']) U.delete(k); app._achNewOnce = true; app._achFirstCheckDone = true; app._showAchievementToast = () => {}; app._checkAchievements();
      out.ach = ['wc_nukewar', 'wc_aliens', 'wc_ai', 'wc_averted', 'wc_lab'].filter(k => !U.has(k));
      // 7) 介面:進行中(工坊、科技分頁)
      while (c5.ph !== 'panic') step(); app._ghTab = 'lab'; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const tray = document.getElementById('gh-tray'); const lt = tray?.innerText || ''; const box = tray?.querySelector('.wc-box');
      out.ui = { box: !!box, steps: box ? box.querySelectorAll('.wc-step').length : 0, on: !!box?.querySelector('.wc-step.on'), bar: !!box?.querySelector('.wc-bar'), form: !!tray?.querySelector('.gh-lab-form') };
      app._ghHide?.(); const mobile = innerWidth <= 768; if (mobile && app._openKairoTab) app._openKairoTab('econ-tech'); else { app.activeTab = 'econ-tech'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 400));
      const era = document.querySelector('.wc-era'); const et = era?.innerText || ''; out.ui.tech = !!era && !!era.querySelector('.wc-box');
      // 結束後的工坊清單
      while (w.worldcal.cur) step(); w.worldcal.cool = 0; C.power = 100; app._ghTab = 'lab'; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const kinds = tray?.querySelectorAll('.wc-kind') || []; const btn = tray?.querySelectorAll('.wc-kind [data-gh="lab-wc"]') || []; const kt = tray?.innerText || '';
      out.ui.kinds = kinds.length; out.ui.btn = btn.length; out.ui.hist = !!tray?.querySelector('.wc-hist');
      const all = lt + '\n' + et + '\n' + kt; out.ui.undef = /undefined|NaN|\{[a-z]+\}/.test(all); out.ui.cjk = (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (all.match(/[一-鿿]+/g) || []).slice(0, 6) : [];
      out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1; app._ghHide?.();
      w.tech.path = p0; CALAMITY.S(w).power = pw0;
      return out;
    });
    const zh = lang === 'zh';
    ok(!r.elig.notElectro && r.elig.yes && !r.elig.few && r.elig.n === 'nukewar' && r.elig.a === 'ai' && r.elig.s === 'aliens', '只有走電子機械、太空時代研究四項以上才會發生；研究核武→核戰、AI→AI 接管、太空站→外星人', r.elig);
    ok(r.begin.ph === 'omen' && r.begin.tot >= 43 && r.begin.tot <= 74 && r.begin.left >= 30 && r.begin.omenLog, '自然發生：從徵兆開始，總長 43～74 天；降臨倒數只有神看得到', r.begin);
    ok(r.debate.ph === 'debate' && r.debate.deny >= 1 && r.debate.warn >= 1 && r.debate.fixProp && r.debate.res && r.debate.vote?.[0] === 'against' && r.debate.vote?.[1] === 'for', '研究與爭論：學者算出真相、全鎮分成說沒事和喊危險兩派、有人提「全力研究」；說沒事的反對、喊危險的贊成', r.debate);
    ok(r.fix.faster && r.fix.paused && r.fix.fix, '全力研究通過：原本的研究停下來，主對策快很多', r.fix);
    ok(r.rumor.ph === 'rumor' && r.rumor.ph2 === 'panic' && r.rumor.shelter && r.rumor.power, '口耳相傳：有人提蓋防空洞；祈禱的人多了，神力也多', r.rumor);
    ok(r.save.ph === 'panic' && r.save.kind === 'nukewar' && r.save.prog, '進行中存讀檔，狀態都在', r.save);
    ok(r.hit.out === 'hit' && r.hit.dead >= 1 && r.hit.popDrop >= 1 && r.hit.wrecked >= 1 && r.hit.regress && r.hit.shock, '主對策沒做到 → 重創：有人罹難、建築被毀、文明倒退、災後反應', r.hit);
    ok(r.end.hist && r.end.unl && r.end.lose && r.end.next && r.end.drift === 0, '結束：寫進歷史與災厄工坊、當初說沒事的人丟臉、兩年內不再自然發生、銀幣守恆', r.end);
    ok(r.averted.out === 'averted' && r.averted.dead === 0 && r.averted.pop === 0 && r.averted.regress && r.eased.out === 'eased', '主對策做完 → 化解（沒人死、沒失傳）；做一半 → 減輕', { a: r.averted, e: r.eased });
    ok(r.unplugVote.laid === 'for' && r.unplugVote.own === 'against' && r.unplug.lost && r.unplug.prog && r.unplug.prep && r.ai.out === 'hit' && r.ai.ctrl && r.ai.end, 'AI：被機器裁員的人贊成拔掉、老闆反對；拔掉後 AI 全智能體要重新研究；沒擋住就被 AI 管，最後大家剪斷電源', { v: r.unplugVote, u: r.unplug, ai: r.ai });
    ok(r.lab.poor === 'power' && r.lab.locked === 'locked' && r.lab.ok && r.lab.spent === 80 && r.lab.src === 'lab' && r.lab.ft >= 14 && r.lab.ft <= 20 && r.lab.plague === 'world' && r.lab.busy === 'active', '工坊：撐過才能發動、花 80 神力、壓縮成 14～20 天；進行中不能再放病原體或另一場', r.lab);
    ok(r.brief.town && r.brief.town2 && r.brief.town2 !== r.brief.town && r.brief.mem !== '', 'AI 知道鎮上的狀況（徵兆時只覺得怪，之後知道是什麼）和自己是哪一派', r.brief);
    ok(!r.ach.length, '成就：撐過三種世界級災厄、化解於未然、在工坊發動', r.ach);
    ok(r.ui.box && r.ui.steps === 6 && r.ui.on && r.ui.bar && !r.ui.form && r.ui.tech, `介面：工坊與科技分頁顯示六段、目前階段、主對策進度；進行中不能設計病原體（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(r.ui.kinds === 3 && r.ui.btn >= 1 && r.ui.hist && !r.ui.undef && !r.ui.cjk.length && !r.ui.overflow, `介面：工坊列出三種世界級災厄、撐過的可以發動、過去的紀錄；不破版（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
