// v7.9.0 災厄工坊（病原體）＋神力：神力累積與上限、沙盒、設計與成本、釋放、潛伏→發病→被發現、擴散、小鎮提案與投票（家人反對隔離、商人反對封城）、
// 隔離／封城／疫苗（研究暫停、疫苗研究出來後打針）、醫生看診（醫療金流、銀幣守恆）、推一把、剩五人自然免疫、結束紀錄（靠疫苗撐過／硬撐過來）、
// 存讀檔、AI 簡報、工坊介面（設計、釋放、疫情面板；中英、桌機與 390px）
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
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_lab', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.setItem('rimtown_god_sandbox', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const adults = () => npcs().filter(a => (a.age ?? 30) >= 18);
      const C = CALAMITY.S(w); let d0 = w._absDay(); const setDay = (n) => { w._absDay = () => n; }; const realDay = w._absDay.bind(w);
      // 1) 神力:一開始 20,每天 +1(興旺 +0.5),上限 100;沙盒無限
      C.power = 20; C.pDay = null; setDay(d0 + 1); w.prosperity.prosperity = 30; CALAMITY.daily(w); const p1 = C.power; setDay(d0 + 2); w.prosperity.prosperity = 70; CALAMITY.daily(w); const p2 = C.power;
      C.power = 99.8; setDay(d0 + 3); CALAMITY.daily(w); out.power = { p1, p2, cap: C.power, inf: (localStorage.setItem('rimtown_god_sandbox', '1'), CALAMITY.power(w)) }; localStorage.setItem('rimtown_god_sandbox', '0');
      // 2) 設計:最多 2 條途徑、4 個症狀,名字去掉怪字元;成本與預覽
      const n = CALAMITY.norm({ name: '<b>灰咳病</b>超過十二個字的名字啊', route: ['droplet', 'water', 'insect'], sym: ['cough', 'fever', 'rash', 'blind', 'heart'] });
      const cheap = CALAMITY.cost({ route: ['contact'], sym: ['rash'], latency: 'short', speed: 'slow', length: 'short', lethal: 'low' }), dear = CALAMITY.cost({ route: ['droplet', 'water'], sym: ['heart', 'blind', 'delirium', 'fever'], latency: 'long', speed: 'fast', length: 'long', lethal: 'high', resist: 'on' });
      const pvA = CALAMITY.preview({ route: ['contact'], sym: ['rash'], latency: 'short', speed: 'slow', lethal: 'low' }), pvB = CALAMITY.preview({ route: ['droplet', 'water'], sym: ['cough', 'heart'], latency: 'long', speed: 'fast', lethal: 'high' });
      out.design = { routes: n.route.length, syms: n.sym.length, name: n.name, cheap, dear, spread: [pvA.spread, pvB.spread], death: [pvA.death, pvB.death], stealth: [pvA.stealth, pvB.stealth] };
      // 3) 釋放:神力不夠不行;夠的話扣神力、第一個病人進入潛伏;同時只能一場
      const spec = { name: (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? 'Grey Cough' : '灰咳病', route: ['droplet', 'contact'], sym: ['cough', 'fever', 'rash'], latency: 'short', speed: 'fast', length: 'long', lethal: 'mid' };
      C.power = 10; const r0 = CALAMITY.release(w, spec); C.power = 100; const zero = adults()[0]; const r1 = CALAMITY.release(w, spec, zero.agentId); const r2 = CALAMITY.release(w, spec);
      out.release = { poor: r0.ok === false && r0.why === 'power', ok: r1.ok, left: C.power, zeroE: C.cur?.st?.[zero.agentId]?.s, busy: r2.why, hidden: C.cur.phase };
      // 4) 潛伏 → 發病 → 擴散 → 被發現
      const X = C.cur; let day = d0 + 10; let foundDay = null;
      for (let i = 0; i < 12 && !X.found; i++) { day++; setDay(day); CALAMITY.daily(w); if (X.found && foundDay == null) foundDay = i; }
      for (let i = 0; i < 3; i++) { day++; setDay(day); CALAMITY.daily(w); } out.spread = { inf: X.inf, found: !!X.found, foundIn: foundDay, phase: X.phase, I: CALAMITY.count(X, 'I'), curve: X.curve.length };
      // 5) 被發現後有人提案:研究對策、隔離;投票:家人在生病的反對隔離、商人反對封城
      for (const a of adults().slice(1, 4)) if (X.st[a.agentId]?.s !== 'I') X.st[a.agentId] = { s: 'I', d: day, on: day, end: day + 30 }; X.quiet = 0; // 讓疫情撐到後面的步驟
      day++; setDay(day); CALAMITY.daily(w); const kinds = w.proposals.items.filter(p => /^cal_/.test(p.kind)).map(p => p.kind);
      const sick = adults().find(a => X.st[a.agentId]?.s === 'I'); const fam = sick ? (MONEY.familyOf(w, sick)[0] || sick) : adults()[1];
      if (!X.st[fam.agentId] || fam === sick) { X.st[fam.agentId] = { s: 'I', d: day, on: day, end: day + 5 }; }
      const qp = { kind: 'cal_quar', votes: {}, why: {} }, lp = { kind: 'cal_lock', votes: {}, why: {} };
      const tr = adults().find(a => a.job?.key === 'trader') || adults()[2]; const keepJ = tr.job; tr.job = new Job('trader');
      const vq = fix(0.5, () => CALAMITY.vote(w, qp, fam)), vl = fix(0.5, () => CALAMITY.vote(w, lp, tr)); tr.job = keepJ;
      out.props = { vax: kinds.includes('cal_vax'), quar: kinds.includes('cal_quar'), vq: vq.v + ':' + vq.why, vl: vl.v + ':' + vl.why };
      if (C.cur !== X) { out.endedEarly = true; C.cur = X; }
      // 6) 通過:隔離、封城(商人進不來)、研究疫苗(平常的研究暫停)
      CALAMITY.enact(w, 'cal_quar'); CALAMITY.enact(w, 'cal_lock'); w.trade.merchant = null; w.trade._spawnMerchant(w); const blocked = !w.trade.merchant;
      const R = w.research; const cur = R.current || (R.getAvailable()[0] && (R.startResearch(R.getAvailable()[0].key), R.current)); const pr0 = R.projects[cur]?.progress || 0;
      CALAMITY.enact(w, 'cal_vax'); R.dailyUpdate(w); const paused = (R.projects[cur]?.progress || 0) === pr0;
      day++; setDay(day); CALAMITY.daily(w); const vp = X.vax.p;
      out.measures = { ms: Object.keys(X.ms).sort().join(','), blocked, paused, vaxGrow: vp > 0, need: X.vax.need };
      X.vax.p = X.vax.need; day++; setDay(day); CALAMITY.daily(w); day++; setDay(day); fix(0.1, () => CALAMITY.daily(w)); out.measures.vaxDone = !!X.vax.done; out.measures.shots = Object.keys(X.vx || {}).length; out.measures.sus = npcs().filter(a => !X.st[a.agentId]).length;
      // 7) 醫生看診走醫療金流:銀幣總數不變
      const T0 = MONEY.total(w); for (let i = 0; i < 3; i++) { day++; setDay(day); fix(0.99, () => CALAMITY.daily(w)); } out.money = { drift: Math.round((MONEY.total(w) - T0) * 100) / 100 };
      // 8) 推一把:花 15 神力、三天加速
      C.power = 50; const b1 = CALAMITY.boost(w); out.boost = { ok: b1.ok, power: C.power, on: X.boost > day };
      // 9) AI 簡報
      const vic = adults().find(a => X.st[a.agentId]?.s === 'I' || X.st[a.agentId]?.s === 'R'); out.brief = { town: CALAMITY.townBrief(w), agent: vic ? CALAMITY.brief(w, vic) : '' };
      // 10) 存讀檔(疫情進行中)
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = { name: w2.calamity?.cur?.spec?.name, st: Object.keys(w2.calamity?.cur?.st || {}).length, power: w2.calamity?.power };
      window.rimtownApp.world = w; CALAMITY.W = w;
      // 11) 剩五個人時不會再死人
      const keep = {}; const all = npcs(); for (const a of all.slice(5)) { keep[a.agentId] = a.isDead; a.isDead = true; }
      const five = npcs(); for (const a of five) X.st[a.agentId] = { s: 'I', d: day, on: day, end: day }; const L = X.spec.lethal; X.spec.lethal = 'high'; day++; setDay(day); fix(0.0001, () => CALAMITY.daily(w)); X.spec.lethal = L;
      out.floor = { alive: npcs().length, died: five.filter(a => a.isDead).length }; for (const [id, v] of Object.entries(keep)) w.agents[id].isDead = v;
      // 12) 結束:沒有人潛伏或發病兩天 → 紀錄(靠疫苗撐過)、冷卻、規定解除
      for (const x of Object.values(X.st)) if (x.s === 'E' || x.s === 'I') x.s = 'R';
      day++; setDay(day); CALAMITY.daily(w); day++; setDay(day); CALAMITY.daily(w);
      const h = C.hist[0]; out.end = { over: !C.cur, name: h?.name, survived: h?.survived, how: h?.how, cool: CALAMITY.canRelease(w).why, inf: h?.inf };
      // 13) 怪病特性:最多 2 個、加成本;謊言病冒煙→爆炸、戀愛、失憶、換性格與復原、守財、長眠被家人叫醒、怒火吵架、藏不住話說出秘密
      const nq = CALAMITY.norm({ quirk: ['liar', 'love', 'rage'] }); const qc = CALAMITY.cost({ route: ['contact'], sym: ['rash'], quirk: ['liar'] }) - CALAMITY.cost({ route: ['contact'], sym: ['rash'] });
      C.coolTo = 0; C.cur = null; C.power = 100; const rq = CALAMITY.release(w, { name: 'Q', route: ['contact'], sym: ['rash'], quirk: ['liar', 'love'], latency: 'short', length: 'long' }); const Y = C.cur; const Q = CALAMITY._q;
      const pool = adults().filter(a => (a.personality?.traits || []).some(k => ['kind', 'shy', 'lazy', 'hardworking', 'optimist', 'pessimist'].includes(k)));
      const liar = adults()[3], lover = adults()[4], amn = adults()[5], flipA = pool.find(a => ![liar, lover, amn].includes(a)) || adults()[6], miser = adults()[7], sleeper = adults()[8];
      const mk = (a) => { Y.st[a.agentId] = { s: 'I', d: day, on: day, end: day + 20 }; return Y.st[a.agentId]; };
      mk(liar); Q.strike(w, Y, liar, day); const smoke = !!w.agents[liar.agentId] && Y.st[liar.agentId].lies === 1; Q.strike(w, Y, liar, day); const boom = !w.agents[liar.agentId] && Y.boom === 1;
      const xl = mk(lover); Q.onset(w, Y, lover, xl, day); const lv = xl.lv && (lover.relationships.relationships[xl.lv]?.romanticInterest || 0) >= 70;
      Y.spec.quirk = ['amnesia', 'flip']; const rel0 = Object.values(amn.relationships.relationships).filter(r => r.status !== 'married').map(r => Math.abs(r.affinity || 0)).reduce((a, b) => a + b, 0); const xa = mk(amn); Q.onset(w, Y, amn, xa, day); const rel1 = Object.values(amn.relationships.relationships).filter(r => r.status !== 'married').map(r => Math.abs(r.affinity || 0)).reduce((a, b) => a + b, 0);
      const tr0 = (flipA.personality.traits || []).join(','); const xf = mk(flipA); Q.onset(w, Y, flipA, xf, day); const tr1 = flipA.personality.traits.join(','); Q.end(w, Y, flipA, xf); const tr2 = flipA.personality.traits.join(',');
      Y.spec.quirk = ['miser', 'sleep']; const xm = mk(miser); Q.onset(w, Y, miser, xm, day); const greedyOn = miser.personality.traits.includes('greedy'); Q.end(w, Y, miser, xm); const greedyOff = !miser.personality.traits.includes('greedy');
      const xs = mk(sleeper); const wm = HEALTH.workMult(w, sleeper); { const f = adults().find(a => a !== sleeper && !Y.st[a.agentId] && !w.isAway?.(a.agentId)); f.homeLocation = sleeper.homeLocation; sleeper.relationships.getOrCreate(f.agentId, f.name).status = 'married'; f.relationships.getOrCreate(sleeper.agentId, sleeper.name).status = 'married'; }
      fix(0.1, () => Q.daily(w, Y, day)); const woke = xs.end <= day;
      Y.spec.quirk = ['rage', 'blurt']; const ra = adults().find(a => !Y.st[a.agentId] && !a.isDead); const xr = mk(ra); const end0 = xr.end;
      const sc = DARK.secret(w, { kind: 'cover', culprit: ra.agentId, victim: null, k: '{a}偷吃了倉庫的食物', p: { a: ra.name } });
      fix(0.05, () => Q.daily(w, Y, day)); const raged = xr.end > end0; const blurted = sc.found;
      out.quirk = { max: nq.quirk.length, cost: qc, rel: rq.ok, smoke, boom, love: !!lv, amnesia: rel1 <= rel0 * 0.5 + 1, flip: tr1 !== tr0 && tr2 === tr0, miser: greedyOn && greedyOff, sleepWork: Math.round(wm * 100) / 100, woke, raged, blurted };
      C.cur = null;
      w._absDay = realDay;
      // 14) 工坊介面:設計 → 釋放 → 疫情面板
      C.coolTo = 0; C.power = 100; app._ghLab = null; app._ghTab = 'lab'; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const tray = document.getElementById('gh-tray'); const ui = { form: !!tray.querySelector('#gh-lab-name'), chips: tray.querySelectorAll('.gh-chip').length, bars: tray.querySelectorAll('.gh-bar').length };
      tray.querySelector('[data-gh="lab-multi"][data-g="sym"][data-v="fever"]')?.click(); await new Promise(r => setTimeout(r, 50)); ui.picked = app._ghLab.sym.includes('fever');
      const nameEl = tray.querySelector('#gh-lab-name'); nameEl.value = 'Test'; nameEl.dispatchEvent(new Event('input', { bubbles: true }));
      tray.querySelector('[data-gh="lab-release"]')?.click(); await new Promise(r => setTimeout(r, 300));
      ui.released = !!C.cur && C.cur.spec.name === 'Test'; ui.dash = !!tray.querySelector('.gh-lab-cur'); ui.boostBtn = !!tray.querySelector('[data-gh="lab-boost"]');
      const txt = tray.innerText; ui.cjk = (txt.match(/[一-鿿]+/g) || []).slice(0, 6); ui.undef = /undefined|NaN|\{[a-z]+\}/.test(txt); ui.overflow = document.documentElement.scrollWidth > innerWidth + 1;
      out.ui = ui;
      return out;
    });
    ok(r.power.p1 === 21 && r.power.p2 === 22.5 && r.power.cap === 100 && r.power.inf === Infinity, '神力每天 +1（小鎮興旺 +1.5），上限 100；沙盒模式無限', r.power);
    ok(r.design.routes === 2 && r.design.syms === 4 && !/[<>]/.test(r.design.name) && [...r.design.name].length <= 12 && r.design.dear > r.design.cheap * 3 && r.design.spread[1] > r.design.spread[0] && r.design.death[1] > r.design.death[0] && r.design.stealth[1] > r.design.stealth[0], '設計：最多 2 條途徑、4 個症狀，名字過濾；越強越貴，預覽隨設計變化', r.design);
    ok(r.release.poor && r.release.ok && r.release.left < 100 && r.release.zeroE === 'E' && r.release.busy === 'active' && r.release.hidden === 'hidden', '釋放：神力不夠不行；扣神力、第一個病人潛伏、一開始只有你知道；同時只能一場', r.release);
    ok(r.spread.inf >= 2 && r.spread.found && r.spread.curve > 0, '潛伏 → 發病 → 傳給別人 → 被醫生發現', r.spread);
    ok(r.props.vax && r.props.quar && /^against:cal_family/.test(r.props.vq) && /^against:cal_business/.test(r.props.vl), '被發現後有人提研究對策與隔離；家人在生病的反對隔離、商人反對封城', r.props);
    ok(r.measures.ms === 'lock,quar' && r.measures.blocked && r.measures.paused && r.measures.vaxGrow && r.measures.vaxDone && (r.measures.shots > 0 || r.measures.sus === 0), '隔離與封城生效（商人進不來）；研究疫苗時平常研究暫停，疫苗出來後開始打針', r.measures);
    ok(Math.abs(r.money.drift) < 0.01, '看診費走醫療金流，銀幣總數不變', r.money);
    ok(r.boost.ok && r.boost.power === 35 && r.boost.on, '推一把：花 15 神力，三天內傳得更快（只能更糟、不能阻止）', r.boost);
    ok(r.brief.town.length > 5 && r.brief.agent.length > 3 && (lang === 'zh' || !/[一-鿿]/.test(r.brief.town + r.brief.agent)), 'AI 知道鎮上在流行什麼、自己得過病', r.brief);
    ok((r.save.name === '灰咳病' || r.save.name === 'Grey Cough') && r.save.st >= 2 && r.save.power === 35, '疫情進行中存讀檔，狀態都在', r.save);
    ok(r.floor.alive === 5 && r.floor.died === 0, '鎮上只剩五個人時，剩下的人自然免疫（不會滅村）', r.floor);
    ok(r.end.over && r.end.survived === true && r.end.how === 'cure' && r.end.cool === 'cooldown', '疫情結束：記下靠疫苗撐過、進入冷卻', r.end);
    ok(r.quirk.max === 2 && r.quirk.cost === 14 && r.quirk.rel && r.quirk.smoke && r.quirk.boom && r.quirk.love && r.quirk.amnesia && r.quirk.flip && r.quirk.miser && r.quirk.sleepWork < 0.1 && r.quirk.woke && r.quirk.raged && r.quirk.blurted, '怪病特性：謊言病冒煙再爆炸、戀愛病愛上別人、失憶、換性格（病好變回來）、守財、長眠（家人叫醒）、怒火吵架、藏不住話說出秘密', r.quirk);
    ok(r.ui.form && r.ui.chips > 20 && r.ui.bars === 4 && r.ui.picked && r.ui.released && r.ui.dash && r.ui.boostBtn && !r.ui.undef && !r.ui.overflow, '工坊介面：選零件、取名、釋放後變成疫情面板（推一把按鈕），沒有破版', r.ui);
    if (lang === 'en') ok(!r.ui.cjk.length, '英文工坊沒有中文', r.ui.cjk);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
