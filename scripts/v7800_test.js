// v7.8.0 科技路線(第一條:電子機械):路線投票(否決三次照樣上路)、時代門檻(75%＋城市／王都)、研究點不空等、學者先挑最早時代、
// 精進改良可以一直研究、機器搶工作(職缺變少)、三級社會問題(小事／中事／核災)、核安法降低大災、核災後廢核公投、存讀檔、銀幣守恆、
// 科技分頁(從建設分出來)、AI 簡報(中英、桌機與 390px)
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const R = w.research; const P = w.proposals;
      const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const adults = () => npcs().filter(a => (a.age ?? 30) >= 18);
      const complete = (k) => { const p = R.projects[k]; p.status = 'complete'; p.progress = p.cost; }; const reset = (k) => { const p = R.projects[k]; p.status = 'locked'; p.progress = 0; };
      const avail = () => R.getAvailable().map(p => p.key); const tierTo = (n) => { TIERS.S?.(w); w.tierState.lv = n; };
      const main = (e) => Object.values(R.projects).filter(p => (p.era || 1) === e && !p.path && p.key !== 'refine').map(p => p.key);
      const elec = (e) => Object.values(R.projects).filter(p => p.era === e && TECH.onPath(p.key, 'electro')).map(p => p.key); /* v8.0.0 蒸汽動力兩條路線共用(path 是陣列) */
      // 1) 科技樹:機械歸到電子機械,電力 6 項、太空 7 項,三種新建築
      out.tree = { e4: elec(4).length, e5: elec(5).length, e6: elec(6).length, shared4: main(4).length, bldg: ['power_plant', 'nuclear_plant', 'launch_site'].every(k => BUILDING_TEMPLATES[k]), refine: !!R.projects.refine };
      // 2) 還沒決定路線:工坊時代就算研究完,機械科技也鎖著
      for (const e of [1, 2]) main(e).forEach(complete); main(3).slice(0, 5).forEach(complete); R.refreshLocks();
      out.locked = { before: !avail().some(k => elec(4).includes(k)) };
      // 3) 工坊時代 75%:鎮上提「走電子機械路線」
      main(3).forEach(complete); R.refreshLocks(); R.current = null; w.tech = null; TECH.daily(w);
      const tp = P.items.find(p => p.kind === 'tech_path'); if (w.tech) w.tech.lean = 'none'; out.debate = { made: !!tp, title: tp ? P.title(tp) : '', opts: tp?.opts || [], open: avail().some(k => elec(4).includes(k)) }; /* v7.9.0 基礎科技不用選路線就能研究;辯論是多選一 */
      // 4) 投票:研究員多半贊成、保守的裁縫反對
      const rs = adults().find(a => a.job?.key === 'researcher') || adults()[0]; const tl = adults().find(a => a !== rs) ; const keep = { j: tl.job, s: tl.techStance };
      tl.job = new Job('tailor'); tl.techStance = 'conservative'; rs.techStance = 'progressive';
      const vr = fix(0.5, () => TECH.voteRule(w, tp, rs)), vt = fix(0.5, () => TECH.voteRule(w, tp, tl)); tl.job = keep.j; tl.techStance = keep.s;
      out.vote = { rs: vr.v, rsPick: tp.pick?.[rs.agentId] || tp.refKey, tl: vt.v, tlPick: vt.v === 'for' ? (tp.pick?.[tl.agentId] || '') : '', whyT: vt.why };
      // 5) 否決三次照樣上路
      { const q = P.items.filter(p => p.kind === 'tech_path').pop(); q.status = 'rejected'; w.tech.lastProp = -99; w.tech.lastDay = null; TECH.daily(w); }
      const n1 = P.items.filter(p => p.kind === 'tech_path').length; w.tech.lastDay = null; TECH.daily(w);
      out.forced = { path: w.tech.path, tries: w.tech.tries, wait: w.tech.nextDebate - w._absDay(), again: P.items.filter(p => p.kind === 'tech_path').length > n1, open: avail().filter(k => elec(4).includes(k)).length }; /* v7.9.0 否決=維持傳統,30 天後再辯論,不再強制 */
      // 6) 正常通過的路線:提案執行
      w.tech = null; TECH.S(w); const q2 = P._createWith(w, w._absDay(), { kind: 'tech_path', key: 'tp:x', jobs: [], make: () => ({ kind: 'tech_path', key: 'tp:x', refKey: 'electro', tk: '小鎮走「{name}」路線', tp: { name: '電子機械' }, dk: 'x', dp: {}, cost: {}, category: 'economy', jobBias: [] }) }, rs);
      q2.votes = { a: 'for', b: 'for', c: 'against' }; q2.status = 'approved'; P._execute(w, q2, w._absDay()); out.chosen = { status: q2.status, path: w.tech.path, yes: w.tech.yes, no: w.tech.no, era4: TECH.eraName(w, 4).name, era5: TECH.eraName(w, 5).name, era6: TECH.eraName(w, 6).name };
      // 7) 門檻:電力要機械 75%＋城市;太空要電力 75%＋王都
      main(4).forEach(complete); tierTo(1); elec(4).forEach(complete); R.refreshLocks(); out.gate5 = { tier1: !avail().includes('electricity') }; tierTo(2); R.refreshLocks(); out.gate5.tier2 = avail().includes('electricity');
      elec(5).slice(0, 3).forEach(complete); R.refreshLocks(); tierTo(3); out.gate6 = { half: !avail().some(k => elec(6).includes(k)) }; elec(5).forEach(complete); R.refreshLocks(); tierTo(2); out.gate6.tier2 = !avail().some(k => elec(6).includes(k)); tierTo(3); out.gate6.tier3 = avail().includes('rocketry'); out.gate6.era = R.currentEra();
      // 8) 研究點不空等:沒在研究時研究員的進度先存著;學者先挑最早的時代
      reset('telegraph'); reset('radio'); R.refreshLocks(); R.current = null; R._carry = 0; R._idle = 0; w.stockpile.resources.research_points = 0;
      fix(0.99, () => R.dailyUpdate(w)); out.carry = { stored: Math.round(R._carry), none: !R.current };
      fix(0.99, () => R.dailyUpdate(w)); out.carry.picked = R.current; out.carry.pickedEra = R.projects[R.current]?.era; const c0 = R._carry; const pr0 = R.projects[R.current].progress; fix(0.99, () => R.dailyUpdate(w)); out.carry.applied = Math.round(R.projects[R.current]?.progress - pr0) >= Math.round(c0) && R._carry === 0;
      // 9) 精進改良:其他都研究完才開放,研究完再開下一級,效果照等級加
      for (const p of Object.values(R.projects)) if (p.key !== 'refine') complete(p.key); R.current = null; R.refreshLocks();
      out.refine = { onlyLeft: JSON.stringify(avail()) === '["refine"]' }; const fb0 = w.buildings.recomputeEffects(w).farm_bonus || 0;
      R.startResearch('refine'); R.projects.refine.progress = R.projects.refine.cost - 1; R._carry = 0; w.stockpile.resources.research_points = 100; R.dailyUpdate(w);
      out.refine.lv = w.tech.ref; out.refine.again = R.projects.refine.status === 'available'; out.refine.cost = R.projects.refine.cost; out.refine.fx = Math.round(((w.buildings.activeEffects.farm_bonus || 0) - fb0) * 100) / 100;
      // 10) 機器搶工作:生產線、機器人讓職缺變少
      out.jobs = { tailor: TECH.jobMult(w, 'tailor'), farmer: TECH.jobMult(w, 'farmer'), guard: TECH.jobMult(w, 'guard') };
      // 11) 三級社會問題:每一種都能發生(建一座核電廠)
      w.buildings.completed.push({ name: BUILDING_TEMPLATES.nuclear_plant.name, buildingKey: 'nuclear_plant', effects: { ...BUILDING_TEMPLATES.nuclear_plant.effects } }); w.buildings.recomputeEffects(w);
      for (const a of adults()) WALLET.get(w, a); const T0 = MONEY.total(w); const fired = {}; for (const ev of TECH.EVENTS) { if (ev.lv === 'big' || ev.path === 'bio') continue; fired[ev.id] = !!(ev.need(w) && TECH.fire(w, ev)); }
      out.events = { fired, drift: Math.round((MONEY.total(w) - T0) * 100) / 100, laid: Object.values(w.tech.mk).filter(x => x === 'laid').length, risk: Math.round(w.tech.risk * 100) / 100 };
      // 12) 核安法:徵兆多了有人提,通過後大災機率降到三分之一
      w.tech.lastDay = null; w.tech.lastLaw = -99; w.tech.risk = 2; TECH.daily(w); const lawP = P.items.find(p => p.kind === 'tech_safety'); w.tech.lastBig = -999; const b0 = TECH.bigChance(w); TECH.setLaw(w); const b1 = TECH.bigChance(w);
      out.law = { proposed: !!lawP, ratio: Math.round(b1 / b0 * 100) / 100, perYear: Math.round(0.03 * 60 / 60 * 1000) / 1000 };
      // 13) 核災:人命、輻射病、核電廠毀了、有人搬走、之後有人提廢核
      w.tech.law = 0; const pop0 = npcs().length; const nb0 = w.buildings.completed.length; const md = fix(0.3, () => TECH.fire(w, TECH.EVENTS.find(e => e.id === 'meltdown')));
      out.melt = { ok: !!md, died: w.tech.st.died, left: w.tech.st.left, popDrop: pop0 - npcs().length, plantGone: !w.buildings.completed.some(b => b.buildingKey === 'nuclear_plant') && w.buildings.completed.length === nb0 - 1, bereaved: Object.values(w.tech.mk).filter(x => x === 'bereaved').length, cool: TECH.bigChance(w) === 0 };
      w.tech.pendAbandon = w._absDay(); w.tech.lastDay = null; TECH.daily(w); const ab = P.items.find(p => p.kind === 'tech_abandon'); out.melt.abandonProp = !!ab;
      if (ab) { ab.status = 'approved'; P._execute(w, ab, w._absDay()); } out.melt.noNuke = !!w.tech.noNuke && !R.isUnlocked('nuclear_plant') && !TECH.nukeOn(w);
      // 14) 存讀檔
      w.tech.ref = 2; R._carry = 123; const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize())));
      out.save = { path: w2.tech?.path, noNuke: !!w2.tech?.noNuke, ref: w2.tech?.ref, carry: w2.research._carry, inc: (w2.tech?.inc || []).length, refName: w2.research.projects.refine.name };
      window.rimtownApp.world = w; TECH.W = w;
      // 15) AI 簡報
      const vic = npcs().find(a => w.tech.mk[a.agentId]); out.brief = { town: TECH.townBrief(w), agent: vic ? TECH.brief(w, vic) : 'none' };
      // 16) 科技分頁(建設分頁不再有研究)
      app.state = w.getState(); const mobile = window.innerWidth <= 768;
      const openTab = async (tab) => { if (mobile) app._openKairoTab(tab); else { app.activeTab = tab; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300)); };
      const pane = () => (mobile ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content')) || document.body;
      await openTab('econ-build'); const buildTxt = pane().innerText; await openTab('econ-tech');
      const el = pane(); const txt = el.innerText;
      out.ui = { buildNoResearch: !/研究點|Research points/.test(buildTxt), hasPath: /科技路線|Tech path/.test(txt), hasPower: /電力|Electric/.test(txt), hasInc: /核災|meltdown/i.test(txt), undef: /undefined|NaN|\{[a-z]+\}/.test(txt), cjk: (txt.match(/[一-鿿]+/g) || []).slice(0, 5), overflow: document.documentElement.scrollWidth > window.innerWidth + 1, tab: !!document.querySelector('[data-tab="econ-tech"], [data-subtab="econ-tech"], [data-key="econ-tech"]') || /科技|Tech/.test(document.body.innerText) };
      return out;
    });
    ok(r.tree.e4 === 6 && r.tree.e5 === 10 && r.tree.e6 === 6 && r.tree.shared4 === 5 && r.tree.bldg && r.tree.refine, '科技樹：機械 6、電力 10（v7.9.0 微電子、精密製造、機器人、核融合移下來）、太空 6 項（專屬：火箭、核子武器、衛星、太空站、量子電腦、AI），共同近代 5 項，三種新建築，精進改良', r.tree);
    ok(r.locked.before && r.debate.made && r.debate.open && r.debate.opts.length >= 2 && /電子機械|Electro/.test(r.debate.title), '工坊時代 75% 才辯論路線（多選一：電子機械、基因生物、維持傳統）；機械科技不用選路線就能研究', { l: r.locked, d: r.debate });
    ok(r.vote.rs === 'for' && r.vote.rsPick === 'electro' && (r.vote.tl === 'against' || (r.vote.tlPick && r.vote.tlPick !== 'electro')), '投票：研究員投電子機械；怕被機器搶飯碗的裁縫不會投電子機械（反對或改投別條路線）', r.vote);
    ok(!r.forced.path && r.forced.tries === 1 && r.forced.wait >= 25 && !r.forced.again && r.forced.open >= 1, '否決就是維持傳統：30 天後再辯論，不會強制上路', r.forced);
    ok(r.chosen.status === 'done' && r.chosen.path === 'electro' && r.chosen.yes === 2 && r.chosen.no === 1 && r.chosen.era5 && r.chosen.era6 && r.chosen.era5 !== r.chosen.era6, '提案通過就決定路線、記下贊成反對；時代名稱依路線', r.chosen);
    ok(r.gate5.tier1 && r.gate5.tier2, '電力時代：機械 75% 而且要城市', r.gate5);
    ok(r.gate6.half && r.gate6.tier2 && r.gate6.tier3 && r.gate6.era === 6, '太空時代：電力 75% 而且要王都', r.gate6);
    ok(r.carry.stored > 0 && r.carry.none && r.carry.picked && r.carry.pickedEra <= 5 && r.carry.applied, '研究點不空等（先存著、開始研究時補上）；學者先挑最早的時代', r.carry);
    ok(r.refine.onlyLeft && r.refine.lv === 1 && r.refine.again && r.refine.cost > 20000 && r.refine.fx >= 0.019, '精進改良：其他都研究完才開放，一級一級研究、效果累加', r.refine);
    ok(r.jobs.tailor < 1 && r.jobs.farmer < 1 && r.jobs.guard === 1 && r.jobs.farmer >= 0.5, '機器搶工作：生產線與機器人讓裁縫、農夫職缺變少（守衛不受影響）', r.jobs);
    ok(Object.values(r.events.fired).filter(Boolean).length >= 8 && r.events.fired.layoff && r.events.fired.leak && r.events.drift === 0 && r.events.risk > 1, '小事與中事都會發生（裁員、輻射外洩、砸機器…），不動銀幣，徵兆讓大災風險升高', r.events);
    ok(r.law.proposed && r.law.ratio > 0.3 && r.law.ratio < 0.36, '徵兆多了有人提核安法；通過後核災機率降到三分之一', r.law);
    ok(r.melt.ok && r.melt.died >= 1 && r.melt.popDrop >= 2 && r.melt.plantGone && r.melt.cool && r.melt.abandonProp && r.melt.noNuke, '核災：有人罹難、有人搬走、核電廠毀了、兩年內不再發生；之後有人提廢核，通過就不能再蓋', r.melt);
    ok(r.save.path === 'electro' && r.save.noNuke && r.save.ref === 2 && r.save.carry === 123 && r.save.inc > 0 && /Lv\.3/.test(r.save.refName), '存讀檔保留路線、廢核、精進等級、存著的研究點、事件紀錄', r.save);
    ok(r.brief.town.length > 5 && r.brief.agent.length > 3 && (lang === 'zh' || !/[一-鿿]/.test(r.brief.town + r.brief.agent)), 'AI 知道小鎮的路線與自己受的害', r.brief);
    ok(r.ui.buildNoResearch && r.ui.hasPath && r.ui.hasPower && !r.ui.undef && !r.ui.overflow, '科技分頁獨立出來：路線、時代、事件都看得到，沒有破版', r.ui);
    if (lang === 'en') ok(!r.ui.cjk.length, '英文科技分頁沒有中文', r.ui.cjk);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
