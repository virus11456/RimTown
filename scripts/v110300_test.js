// v11.3.0 空閒做什麼、去哪、找誰聊、約人可以拒絕：照個性與當下狀況，不擲骰（sim-day.js）
//   1) 去哪：害羞愛看書的人偏圖書館、朋友在哪就想去哪、仇人在的地方避開、天氣差不往外跑、行程上寫的地方優先；挑定後一陣子不換
//   2) 人真的去了挑的地方
//   3) 找誰聊：先找最要好的，聊過的往後排
//   4) 約人：對方很累就說改天（不會被硬拉走）；交情好又有精神就答應，兩個人去同一個地方待上一陣子；兩天內不重複約
//   5) 聊僵：兩個和氣又要好的人不會無故鬧僵；刻薄、心情差、宿醉的仇人會，而且同一對一天最多一次
//   6) 心動：浪漫的人聊得來會心動，隔幾天才會再有；交情不夠、性子也不特別合的不會
//   7) 沒開觀察者模式時照舊；放著跑 10 天沒有錯誤
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const out = {}; try {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerToast = () => {};
      const w = app.world; const cjk = (s) => /[一-鿿]/.test(String(s || ''));
      const fresh = (seed) => { w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, 1, { seed }); WALLET.S(w); DAY.S(w); try { if (w.weather) w.weather.moodModifier = 0; } catch (e) {} };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
      const setT = (a, ...tr) => { a.personality.traits = tr; }; const rel = (a, b) => a.relationships.getOrCreate(b.agentId, b.name);
      const clearRel = (a) => { for (const id of Object.keys(a.relationships.relationships)) a.relationships.relationships[id].affinity = 0; };
      const R0 = Math.random; const fix = (v) => { Math.random = () => v; }; const unfix = () => { Math.random = R0; };
      fresh(7); const [A, B, C, D] = npcs().filter(a => !a.personality.traits.includes('night_owl')); for (const x of [A, B, C, D]) { clearRel(x); x.needs.social = 60; x.needs.recreation = 60; x.needs.rest = 80; x.mood = 60; x.activity = 'wandering'; x.dailyPlan = null; }
      // 1) 去哪
      const PL = ['library', 'park', 'chapel'].find(k => !w.townMap?.locations || w.townMap.locations[k]) || 'park'; out.PL = PL; // 行程要去的地方：挑這個鎮真的有的
      setT(A, 'shy', 'curious'); B.currentLocation = 'x1'; C.currentLocation = 'x2'; D.currentLocation = 'x3'; const c0 = DAY.freeCtx(w, A);
      out.shy = { lib: DAY.freeScore(w, A, 'recreation', 'library', c0), tav: DAY.freeScore(w, A, 'socializing', 'tavern', c0) };
      setT(A); rel(A, B).affinity = 60; rel(A, C).affinity = 60; B.currentLocation = 'park'; C.currentLocation = 'park'; B.activity = 'wandering'; C.activity = 'wandering';
      { const c = DAY.freeCtx(w, A); out.friend = { park: DAY.freeScore(w, A, 'socializing', 'park', c), sq: DAY.freeScore(w, A, 'socializing', 'town_square', c), n: c.friends.park }; }
      rel(A, D).affinity = -60; D.currentLocation = 'tavern'; D.activity = 'wandering'; { const c = DAY.freeCtx(w, A); out.foe = { tav: DAY.freeScore(w, A, 'socializing', 'tavern', c), sq: DAY.freeScore(w, A, 'socializing', 'town_square', c), n: c.foes.tavern }; }
      { const c = DAY.freeCtx(w, A); c.bad = true; c.friends = {}; c.foes = {}; out.rain = { park: DAY.freeScore(w, A, 'wandering', 'park', c), home: DAY.freeScore(w, A, 'wandering', 'home', c) }; }
      A.dailyPlan = { key: `${w.clock.year}-${w.clock.season}-${w.clock.day}`, llm: true, goals: [], blocks: [{ time: '00:00', text: zhText(), steps: [] }] }; function zhText() { const en = typeof LLM_LANG !== 'undefined' && LLM_LANG.get && LLM_LANG.get() === 'en'; return { library: en ? 'Read at the library all day' : '整天待在圖書館看書', park: en ? 'Take a long walk in the park' : '去公園散步一整天', chapel: en ? 'Pray at the chapel' : '去禮拜堂祈禱' }[PL]; }
      rel(A, B).affinity = 0; rel(A, C).affinity = 0; rel(A, D).affinity = 0; out.planLoc = DAY.freeCtx(w, A).planLoc; fix(0.5); A._free = null; const p1 = DAY.freePick(w, A, false); const p2 = DAY.freePick(w, A, false); unfix(); out.pick = { loc: p1 && p1.loc, same: p1 === p2, led: DAY.S(w).st.planLed, top: (() => { const c = DAY.freeCtx(w, A); return [['socializing', 'tavern'], ['recreation', 'library'], ['socializing', 'town_square'], ['socializing', 'chapel'], ['socializing', 'home']].map(([x, y]) => y + ':' + Math.round(DAY.freeScore(w, A, x, y, c) * 100) / 100).join(' ') + ' habit=' + c.habit + ' piety=' + c.piety + ' fr=' + JSON.stringify(c.friends); })() };
      // 2) 人真的去了
      { let h = 0; while (!(w.clock.hour === 19 && w.clock.minute === 0) && h++ < 200) { w.paused = false; w.tick(); } A.dailyPlan = { key: `${w.clock.year}-${w.clock.season}-${w.clock.day}`, llm: true, goals: [], blocks: [{ time: '00:00', text: zhText(), steps: [] }] };
        DAY.S(w).t[A.agentId] = { wq: 1, eq: 1, eve: 'free', work: 'go' }; let at = 0, n = 0; for (let i = 0; i < 4; i++) { A.needs.hunger = 90; A.needs.rest = 80; A.needs.social = 60; A.needs.recreation = 60; A._pendingHangout = null; A._hangHold = null; w.paused = false; w.tick(); n++; if (A.currentLocation === PL) at++; } out.goes = { at, n, act: A.activity, hour: w.clock.hour }; }
      // 3) 找誰聊
      fresh(9); { const [a, b, c, d] = npcs(); for (const x of [a, b, c, d]) clearRel(x); rel(a, b).affinity = 70; rel(a, c).affinity = 20; rel(a, d).affinity = -40; fix(0.5); const seq = []; for (let i = 0; i < 4; i++) seq.push(DAY.pickTalk(w, a, [b, c, d]).agentId); unfix(); out.talk = { first: seq[0] === b.agentId, hasC: seq.includes(c.agentId), noD: !seq.includes(d.agentId), seq: seq.map(x => x === b.agentId ? 'b' : x === c.agentId ? 'c' : 'd').join('') }; }
      // 4) 約人
      fresh(11); { const [a, b] = npcs(); clearRel(a); clearRel(b); rel(a, b).affinity = 60; rel(b, a).affinity = 60; a.needs.social = 40; a.needs.rest = 80; b.needs.social = 60; b.needs.rest = 20; a._pendingHangout = b._pendingHangout = null; a._hangHold = b._hangHold = null;
        const no = DAY.invite(w, a, b); out.inviteNo = { r: no, pend: !!b._pendingHangout, st: DAY.S(w).st.inviteNo, mem: /改天|another day/.test((a.memory.entries.slice(-1)[0] || {}).content || '') };
        const again = DAY.invite(w, a, b); out.inviteCool = again;
        DAY.S(w).inv = {}; b.needs.rest = 80; const yes = DAY.invite(w, a, b); out.inviteYes = { r: yes, same: !!a._pendingHangout && a._pendingHangout.location === b._pendingHangout?.location, spot: a._pendingHangout?.location, st: DAY.S(w).st.invite };
        const R1 = Math.random; let calls = 0; Math.random = () => { calls++; return R1(); }; DAY.S(w).inv = {}; a._pendingHangout = b._pendingHangout = null; DAY.invite(w, a, b); Math.random = R1; out.inviteDice = calls; }
      // 5) 聊僵
      fresh(13); { const [a, b] = npcs(); setT(a, 'kind'); setT(b, 'kind'); clearRel(a); clearRel(b); rel(a, b).affinity = 60; rel(b, a).affinity = 60; a.mood = b.mood = 70; a.needs.hunger = b.needs.hunger = 80; a.needs.rest = b.needs.rest = 80; let n = 0; for (let i = 0; i < 60; i++) { DAY.S(w).t = {}; if (DAY.sours(w, a, b)) n++; } out.sourKind = n;
        setT(a, 'abrasive'); setT(b, 'shy'); rel(a, b).affinity = -40; rel(b, a).affinity = -40; a.mood = b.mood = 20; DAY.S(w).hang[a.agentId] = { d: DAY.S(w).d, lv: 2 }; let m = 0; for (let i = 0; i < 60; i++) { DAY.S(w).t = {}; if (DAY.sours(w, a, b)) m++; } out.sourBad = m; DAY.S(w).t = {}; const s1 = DAY.sours(w, a, b), s2 = DAY.sours(w, a, b); out.sourOnce = { s1, s2 }; }
      // 6) 心動
      fresh(15); { const [a, b, c] = npcs(); setT(a, 'romantic'); setT(b); setT(c); clearRel(a); clearRel(b); clearRel(c); rel(a, b).affinity = 30; rel(b, a).affinity = 30; out.spark = { first: DAY.sparks(w, a, b), again: DAY.sparks(w, a, b) }; setT(a); rel(b, c).affinity = 10; rel(c, b).affinity = 10; out.sparkNo = DAY.sparks(w, b, c); rel(b, c).affinity = 50; rel(c, b).affinity = 50; out.sparkClose = DAY.sparks(w, b, c); }
      // 7) 關掉時照舊；放著跑
      fresh(17); w.observerMode = false; { const a = npcs()[0]; a.activity = 'wandering'; a._dayLoc = 'x'; DAY.steer(w, a); out.off = a._dayLoc; } w.observerMode = true;
      for (let i = 0; i < 10 * 96; i++) { w.paused = false; w.tick(); if (i % 480 === 479) await new Promise(r2 => setTimeout(r2, 5)); } out.run = DAY.view(w).st; out.en = [t('跟朋友約好了'), t('想約{b}出去走走，他說改天。')];
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 600); }
    return out;
  });
  const tag = `[${lang}]`; if (r.err) console.log(r.err);
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.shy && r.shy.lib > r.shy.tav, `${tag} 害羞又愛看書的人：圖書館比酒館有吸引力`, r.shy);
  ok(r.friend && r.friend.n === 2 && r.friend.park > r.friend.sq, `${tag} 兩個好朋友在公園：公園比廣場想去`, r.friend);
  ok(r.foe && r.foe.n === 1 && r.foe.tav < r.foe.sq, `${tag} 仇人在酒館：避開酒館`, r.foe);
  ok(r.rain && r.rain.home > r.rain.park, `${tag} 天氣差：待在家比去公園好`, r.rain);
  ok(r.planLoc === r.PL && r.pick && r.pick.loc === r.PL && r.pick.same && r.pick.led >= 1, `${tag} 今天行程寫了要去的地方（${r.PL}）：就去那裡，挑定後這一陣子不換`, { p: r.planLoc, k: r.pick });
  ok(r.goes && r.goes.at >= 3, `${tag} 人真的在那個地方（四刻鐘裡至少三刻）`, r.goes);
  ok(r.talk && r.talk.first && r.talk.hasC && r.talk.noD, `${tag} 找誰聊：先找最要好的，聊過換別人，不去找仇人`, r.talk);
  ok(r.inviteNo && r.inviteNo.r === false && !r.inviteNo.pend && r.inviteNo.st === 1 && r.inviteNo.mem, `${tag} 對方很累：說改天，不會被硬拉走`, r.inviteNo);
  ok(r.inviteCool === false, `${tag} 剛被婉拒，兩天內不再約同一個人`, r.inviteCool);
  ok(r.inviteYes && r.inviteYes.r === true && r.inviteYes.same && r.inviteYes.st === 1, `${tag} 對方有精神、交情好：答應，兩個人約在同一個地方`, r.inviteYes);
  ok(r.inviteDice === 0, `${tag} 約人與答不答應都不擲骰`, r.inviteDice);
  ok(r.sourKind === 0 && r.sourBad >= 55 && r.sourOnce.s1 === true && r.sourOnce.s2 === false, `${tag} 和氣的好朋友 60 次都沒鬧僵；刻薄、心情差、宿醉的仇人幾乎每次都僵；同一對一天最多一次`, { kind: r.sourKind, bad: r.sourBad, once: r.sourOnce });
  ok(r.spark && r.spark.first === 2 && r.spark.again === 0 && r.sparkNo === 0 && r.sparkClose === 1, `${tag} 心動：浪漫的人 2 點、隔幾天才再有；交情不夠的沒有；交情夠的 1 點`, { s: r.spark, no: r.sparkNo, close: r.sparkClose });
  ok(r.off === null || r.off === 'x' ? r.off === null : false, `${tag} 沒開觀察者模式時不介入`, r.off);
  ok(r.run && r.run.free > 100 && (r.run.invite + r.run.inviteNo) > 0 && r.run.chat > 0, `${tag} 跑 10 天：空閒的選擇、約人、聊天都在發生`, r.run);
  ok(zh || !r.en.some(x => /[一-鿿]/.test(x)), `${tag} 新句子有英文`, r.en);
  if (r.run) console.log('   ', JSON.stringify(r.run));
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
