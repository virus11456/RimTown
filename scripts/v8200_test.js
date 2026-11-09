// v8.2.0 災厄工坊開放＋疫情裡的人情世故
// 工坊預設開放（分頁、首頁段落 8.2）、固定地點傳染（同時段同地點的人互傳、關酒館市集就斷、偷溜的人照樣去）、怕得待在家（點頭之交也斷）、
// 偷溜與防疫疲乏（越久越多人撐不住、死了人又收斂、投贊成的人偷溜算說一套做一套、被抓或病倒後被醫生問出來）、關太久提議重開（做生意的贊成、醫生反對）、
// 送飯（欠人情、送飯的人也冒險）、嘴硬（防疫被否決後又死人：認錯或嘴硬、提案人被說早該聽他的）、怪罪與平反、老地方重新熱鬧與空位子、
// 集體記憶（上次死過人：早發現、早防疫、經歷過的人更配合；兩年後淡掉；上次沒事反而輕忽）、週年點蠟燭、煤煙與肺病、
// 萬靈藥（銀幣守恆、喝了照樣病倒就拆穿、退錢、上次被騙過的不買、被拆穿的人不敢再賣）、疫情期間成效不算提案功過、存讀檔、AI 摘要、介面（中英、桌機與 390px）
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[(Calamity|PlagueWays|Ways)\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.removeItem('rimtown_lab'); }, { jwt, lang });
    // 首頁:災厄工坊段落回來了(8.2 新)
    await page.goto(BASE + 'index.html', { waitUntil: 'load' }); await page.waitForTimeout(1200);
    const land = await page.evaluate(() => { const b = document.getElementById('lp-lab'); return { band: !!b, isNew: !!b?.querySelector('.lp-new') && /8\.2/.test(b.querySelector('.lp-new').textContent), bands: document.querySelectorAll('#landing-features .lp-band').length, recent: /v8\.2/.test(document.getElementById('landing')?.textContent || ''), overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
    ok(land.band && land.isNew && land.bands === 17 && land.recent && !land.overflow, '首頁：災厄工坊段落回來了（標 8.2 新）、路線圖寫上 v8.2', land);
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const A = () => npcs().filter(a => (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
      for (const a of npcs()) WALLET.get(w, a);
      let d0 = w._absDay(); const setDay = (n) => { d0 = n; w._absDay = () => n; }; const next = () => setDay(d0 + 1);
      const C = CALAMITY.S(w); const PW = PLAGUEWAYS; const T = PW._t; const H = CALAMITY.H; const WX = WAYS.S(w);
      const logs = () => (w.messageLog || []).slice(-80).map(m => m.content || m.text || '').join('\n');
      const traits = (a, list) => { a.personality.traits = list.slice(); }; const vals = (a, list) => { a.personality.values = list.slice(); };
      const rel = (a, b) => a.relationships.getOrCreate(b.agentId, b.name); const setAff = (a, b, v) => { rel(a, b).affinity = v; }; const aff = (a, b) => a.relationships.relationships?.[b.agentId]?.affinity || 0;
      const spec = { name: (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? 'Grey Cough' : '灰咳病', route: ['droplet', 'contact'], sym: ['cough', 'fever'], latency: 'short', speed: 'mid', length: 'mid', lethal: 'mid' };
      const fresh = () => { C.cur = null; C.coolTo = 0; C.power = 100; const z = A()[0]; CALAMITY.release(w, spec, z.agentId); const X = C.cur; X.st = {}; X.inf = 0; X.found = d0; X.phase = 'found'; PW.P(X); return X; };
      out.open = { lab: CALAMITY.labOpen() };
      // 1) 固定地點傳染
      { const X = fresh(); const [a, b, c, e] = A(); const rt = WX.rt; rt[a.agentId] = { s: 'tavern', t: 'pm' }; rt[b.agentId] = { s: 'tavern', t: 'pm' }; rt[c.agentId] = { s: 'park', t: 'pm' }; rt[e.agentId] = { s: 'tavern', t: 'am' };
        X.st[a.agentId] = { s: 'I', d: d0, on: d0, end: d0 + 5 }; next(); const r1 = H.reg(w, X, a, true).map(x => x.agentId);
        X.ms.close = d0; next(); const r2 = H.reg(w, X, a, true).length; next(); X.pw.brk[a.agentId] = d0; X.pw.brk[b.agentId] = d0; const r3 = H.reg(w, X, a, true).map(x => x.agentId); delete X.ms.close;
        X.ms.quar = d0; next(); const r4 = H.reg(w, X, a, true).length; delete X.ms.quar;
        out.reg = { mate: r1.includes(b.agentId), notPark: !r1.includes(c.agentId), notAm: !r1.includes(e.agentId), closed: r2, sneakers: r3.includes(b.agentId), quar: r4 }; }
      // 2) 怕得待在家:恐慌時悲觀的人不出門,點頭之交也斷了
      { const X = fresh(); X.phase = 'panic'; const a = A()[1]; traits(a, ['pessimist']); fix(0, () => T.stayDaily(w, X, d0)); out.stay = { home: X.pw.home[a.agentId] > d0, absent: WAYS.ABSENT.some(f => f(w, a)) }; X.pw.home = {}; out.stay.back = !WAYS.ABSENT.some(f => f(w, a)); }
      // 3) 偷溜與防疫疲乏
      { const X = fresh(); X.ms.close = d0; const f1 = PW.fatigue(w, X); setDay(d0 + 30); const f30 = PW.fatigue(w, X); const m30 = H.mask(w, X); X.ms.mask = d0 - 30; const mask30 = H.mask(w, X); const zz = A().find(x => !X.st[x.agentId]);
        H.die[0](w, X, zz); const fDeath = PW.fatigue(w, X); delete X.ms.mask;
        out.fatigue = { f1, f30, fDeath, mask1: 0.5, mask30 };
        // 投贊成票、愛熱鬧又懶的人:最容易偷溜;被抓 → 說一套做一套被拆穿
        const a = A().find(x => !X.st[x.agentId]); traits(a, ['glutton', 'lazy']); vals(a, ['自由']); WX.rt[a.agentId] = { s: 'tavern', t: 'pm' }; X.pw.fear = -99; X.pw.shame = -99; X.ms.close = d0 - 30;
        const pp = { id: 'LT' + Math.floor(Math.random() * 1e6), kind: 'cal_close', createdDay: X.day, proposerId: A()[2].agentId, votes: { [a.agentId]: 'for' }, why: {}, status: 'approved' }; w.proposals.items.push(pp);
        next(); fix(0.1, () => T.sneakDaily(w, X, d0)); const hyp = WX.hyp.find(h => h.a === a.agentId && h.k === 'cal_close');
        const face0 = WAYS.faceOf(w, a), tr0 = WX.trust; PW.caught(w, X, a, 'close', d0, false); const L = logs();
        out.sneak = { brk: X.pw.brk[a.agentId] === d0, hyp: !!hyp, exposed: !!hyp?.exp, face: face0 - WAYS.faceOf(w, a), trust: Math.round((tr0 - WX.trust) * 10) / 10, log: /🤫/.test(L), shame: X.pw.shame === d0, after: PW.fatigue(w, X) };
        // 偷溜的人病倒 → 醫生問出來
        const b = A().find(x => x !== a && !X.st[x.agentId]); X.pw.brk[b.agentId] = d0 - 2; X.st[b.agentId] = { s: 'I', d: d0, on: d0, end: d0 + 5 }; const tr1 = X.pw.traced; fix(0, () => T.traceDaily(w, X, d0)); out.sneak.traced = X.pw.traced - tr1; out.sneak.traceLog = /🔍/.test(logs());
        // 偷溜的人比較容易染上
        out.sneak.sus = H.sus(w, X, b); }
      // 4) 關太久:做生意的人提議重開;醫生反對、廚師贊成;通過後酒館市集重開
      { const X = fresh(); for (const id of Object.keys(X.st)) X.st[id].s = 'R'; X.ms.close = d0 - 25; X.pw.fear = d0 - 15; X.asked = { vax: d0, quar: d0, mask: d0, close: d0, lock: d0 }; X.vax = { p: 0, need: 999, done: 0 }; X.lastDay = null;
        w.proposals.items = w.proposals.items.filter(p => p.kind !== 'cal_reopen'); fix(0.9, () => CALAMITY.daily(w)); const p = w.proposals.items.find(q => q.kind === 'cal_reopen');
        const cook = A().find(a => a.job?.key !== 'doctor'); const doc = A().find(a => a !== cook); const ck = cook.job; const dk = doc.job; cook.job = Object.assign({}, ck || {}, { key: 'cook' }); doc.job = Object.assign({}, dk || {}, { key: 'doctor' }); traits(doc, []); traits(cook, []);
        const vc = p ? fix(0.5, () => CALAMITY.vote(w, p, cook)) : null, vd = p ? fix(0.5, () => CALAMITY.vote(w, p, doc)) : null; cook.job = ck; doc.job = dk;
        const res = CALAMITY.enact(w, 'cal_reopen'); out.reopen = { made: !!p, cook: vc?.v, cookWhy: vc?.why, doc: vd?.v, res: !!res, open: !X.ms.close, log: /🍻/.test(logs()) }; }
      // 5) 送飯:欠人情,送飯的人也冒險
      { const X = fresh(); const s = A().filter(a => a.agentId !== A()[0].agentId)[0]; const famS = (MONEY.familyOf?.(w, s) || []).map(x => x.agentId); const h = A().filter(a => a.agentId !== A()[0].agentId && a !== s && !famS.includes(a.agentId) && !(a.personality?.traits || []).includes('pessimist'))[0]; /* 家人送飯不算,要挑非家人 */ X.st[s.agentId] = { s: 'I', d: d0, on: d0, end: d0 + 5 }; X.ms.quar = d0; traits(h, ['kind']); setAff(h, s, 95); X.pw.home = {};
        for (const o of A()) if (o !== h && o !== s) setAff(o, s, 0);
        const ow0 = WX.owe[s.agentId]?.[h.agentId] || 0; fix(0.01, () => T.foodDaily(w, X, d0));
        out.food = { n: X.pw.food, owe: (WX.owe[s.agentId]?.[h.agentId] || 0) - ow0, risk: !!X.st[h.agentId], log: /🍲/.test(logs()) }; }
      // 6) 嘴硬:防疫被否決,之後又死了兩個人
      { const X = fresh(); const [pr, x1, x2] = A(); traits(x1, ['kind']); traits(x2, ['kind']);
        const p = { id: 'LT' + Math.floor(Math.random() * 1e6), kind: 'cal_quar', createdDay: d0 - 5, proposerId: pr.agentId, proposerName: pr.name, votes: { [x1.agentId]: 'against', [x2.agentId]: 'against', [pr.agentId]: 'for' }, why: {}, status: 'rejected' };
        X.day = d0 - 6; w.proposals.items.push(p); X.pw.deaths = [d0 - 3, d0 - 2]; const f1 = WAYS.faceOf(w, x1), fp = WAYS.faceOf(w, pr); fix(0, () => T.stubDaily(w, X, d0));
        out.stub = { said: !!X.pw.said[p.id], oppFace: f1 - WAYS.faceOf(w, x1), propFace: WAYS.faceOf(w, pr) - fp, admit: X.pw.admit, log: /😔/.test(logs()) };
        X.pw.said = {}; traits(x1, ['stubborn']); traits(x2, ['stubborn']); x1.personality.honesty = 0; x2.personality.honesty = 0; const st0 = X.pw.stub; fix(0.99, () => T.stubDaily(w, X, d0)); out.stub.stub = X.pw.stub - st0 + X.pw.admit; }
      // 7) 萬靈藥:錢只在村民之間移動;喝了照樣病倒就拆穿;退錢;被騙過的不買、拆穿過的不敢再賣
      { const X = fresh(); X.phase = 'panic'; C.burned = []; C.sold = []; const ppl = A(); const s = ppl[1]; traits(s, ['greedy']); for (const o of ppl) if (o !== s && o.personality.traits.includes('greedy')) traits(o, []); WALLET.S(w).bal[s.agentId] = 100;
        for (const b of ppl.slice(2, 9)) { traits(b, ['pessimist']); WALLET.S(w).bal[b.agentId] = 60; }
        const T0 = MONEY.total(w); fix(0, () => T.panaceaDaily(w, X, d0)); const pn = X.pw.pan; const T1 = MONEY.total(w);
        const buyer = pn && w.agents[pn.b[0][0]]; if (buyer) X.st[buyer.agentId] = { s: 'I', d: d0, on: d0, end: d0 + 5 };
        const sf = WAYS.faceOf(w, s); fix(0, () => T.panaceaCheck(w, X, d0, false)); const T2 = MONEY.total(w);
        out.pan = { made: !!pn, n: pn?.b?.length || 0, sum: pn?.sum || 0, seller: pn?.s === s.agentId, money1: Math.round((T1 - T0) * 100) / 100, exp: pn?.exp > 0, face: sf - WAYS.faceOf(w, s), back: pn?.back || 0, money2: Math.round((T2 - T0) * 100) / 100, burned: (C.burned || []).length, sold: (C.sold || []).includes(s.agentId), log: /🧴/.test(logs()) };
        // 下一場:被騙過的人不買、拆穿過的人不賣
        const X2 = fresh(); X2.phase = 'panic'; C.hist.unshift({ name: 'x', end: d0, died: 0, pw: { pan: 'none' } }); fix(0, () => T.panaceaDaily(w, X2, d0)); const p2 = X2.pw.pan; C.hist.shift();
        out.pan.again = { seller2: p2 ? p2.s !== s.agentId : true, noBurned: p2 ? !p2.b.some(([id]) => C.burned.includes(id)) : true }; }
      // 8) 集體記憶
      { const X = fresh(); const ppl = A(); const lived = ppl.slice(0, Math.max(3, ppl.length - 2)).map(a => a.agentId); const newbie = ppl[ppl.length - 1];
        C.hist.unshift({ name: '舊咳病', day: d0 - 150, end: d0 - 100, died: 4, inf: 12, ppl: lived });
        const L = PW.lessonOf(w, X); const f = H.lesson(w, X); const thr = H.thr(w, X); const va = H.vote(w, X, w.agents[lived[0]], 'quar'); const vn = H.vote(w, X, newbie, 'quar');
        C.hist[0].end = d0 - 800; const Lold = PW.lessonOf(w, X).L; C.hist[0].end = d0 - 100; C.hist[0].died = 0; const calm = PW.lessonOf(w, X); const vc = H.vote(w, X, w.agents[lived[0]], 'mask');
        C.hist[0].died = 4; X.pw.L0 = 0; fix(0.99, () => H.daily(w, X, d0)); const said = /📖/.test(logs()); const tb = CALAMITY.townBrief(w);
        out.lesson = { L: L.L, f, thr, va: va?.s > 0 && va?.why === 'cal_lesson', vn: vn === null || !vn.s, Lold, calm: calm.calm, vc: vc?.s < 0 && vc?.why === 'cal_calm', said, tb: tb.length > 0 && /舊咳病/.test(tb) };
        C.hist.shift(); }
      // 9) 煤煙與肺病
      { const X = fresh(); w.tech = w.tech || TECH.S(w); const sm0 = w.tech.steam?.smog; w.tech.steam = w.tech.steam || {}; w.tech.steam.smog = 50; const md = H.mult(w, X, 'droplet'), mw = H.mult(w, X, 'water'); w.tech.steam.smog = 5; const m5 = H.mult(w, X, 'droplet'); w.tech.steam.smog = sm0 || 0;
        const a = A()[2]; const mk0 = w.tech.mk?.[a.agentId]; w.tech.mk = w.tech.mk || {}; w.tech.mk[a.agentId] = 'lung'; X.pw.brk = {}; const lung = H.sus(w, X, a); if (mk0) w.tech.mk[a.agentId] = mk0; else delete w.tech.mk[a.agentId];
        out.smog = { md, mw, m5, lung }; }
      // 10) 疫情過去:記得誰經歷過、平反、老地方重新熱鬧、空位子
      { const X = fresh(); const ppl = A(); const sc = ppl[3]; X.scape = sc.agentId; for (const o of ppl.slice(4, 7)) setAff(o, sc, -20);
        const dead = { id: 'gone1', n: ppl[5].name, s: WAYS.routineOf(w, ppl[4]).s, t: WAYS.routineOf(w, ppl[4]).t }; X.pw.lost = [dead];
        C.hist = C.hist || []; if (C.hist[0]) C.hist[0].ppl = ['old']; const before = aff(ppl[4], sc);
        X.st = {}; X.quiet = 5; fix(0, () => { X.lastDay = null; CALAMITY.daily(w); }); const h = C.hist[0];
        out.end = { over: !C.cur, ppl: (h?.ppl || []).length, oldClear: !(C.hist[1]?.ppl), sorry: aff(ppl[4], sc) > before || /🙇/.test(logs()), reunion: /🍻/.test(logs()), seat: /🪑/.test(logs()), pw: !!h?.pw }; }
      // 11) 週年點蠟燭(死過人的)
      { C.hist.unshift({ name: '舊咳病', day: d0 - 400, end: d0 - 360, died: 3, inf: 9, ppl: A().map(a => a.agentId) }); PW.anniv(w); out.anniv = /🕯️/.test(logs()); C.hist.shift(); }
      // 12) 疫情期間成效不算提案功過
      { const X = fresh(); const pr = A()[0]; const p = { id: 'LT' + Math.floor(Math.random() * 1e6), kind: 'build', proposerId: pr.agentId, status: 'done', outcome: { mood: -10, pop: -5, silver: 0, food: 0 }, votes: {} };
        const b0 = WX.st.bad || 0; w.proposals._notify(w, 'outcome', p); const b1 = WX.st.bad || 0; C.cur = null; C.hist.unshift({ name: 'y', end: d0 - 40, died: 0 }); w.proposals._notify(w, 'outcome', p); const b2 = WX.st.bad || 0; C.hist.shift();
        out.credit = { during: b1 - b0, after: b2 - b1 }; }
      // 13) 存讀檔、AI 摘要
      { const X = fresh(); X.pw.food = 3; X.pw.hyp = { [A()[0].agentId]: 1 }; C.burned = ['q1']; C.sold = ['q2']; const d = JSON.parse(JSON.stringify(w.serialize())); const X2 = d.calamity?.cur;
        const P2 = X2 ? PW.P(X2) : null; out.save = { pw: X2?.pw?.food === 3, burned: d.calamity?.burned?.[0] === 'q1', sold: d.calamity?.sold?.[0] === 'q2', ok: !!P2 && Array.isArray(P2.deaths) };
        out.brief = { hyp: CALAMITY.brief(w, A()[0]).length > 0 }; }
      // 14) 介面:工坊分頁、疫情裡的人、上次疫情的記憶
      { const X = fresh(); X.pw.sneak = 5; X.pw.caught = 2; X.pw.traced = 1; X.pw.food = 4; X.pw.admit = 1; X.pw.stub = 1; X.pw.hyp = { [A()[0].agentId]: 1 }; X.pw.pan = { s: A()[1].agentId, b: [[A()[2].agentId, 9]], sum: 9, nm: '萬靈藥', exp: d0, back: 9 }; X.ms.close = d0 - 40; X.pw.fear = -99; X.pw.shame = -99;
        app._ghLab = null; app._ghTab = 'lab'; app._ghShow(); await new Promise(r => setTimeout(r, 300)); const tray = document.getElementById('gh-tray');
        const tab = !!tray.querySelector('[data-gh="tab"][data-v="lab"]'); const box = tray.querySelector('.gh-lab-ways'); const txt = box?.innerText || '';
        const ui = { tab, box: !!box, lines: box ? box.querySelectorAll('div').length : 0, undef: /undefined|NaN|\{[a-z]+\}/.test(tray.innerText), cjk: (/en/.test(document.documentElement.lang || '') || (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en')) ? (txt.match(/[一-鿿]+/g) || []).slice(0, 4) : [], overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        const boxW = box ? box.getBoundingClientRect() : null; ui.fit = !boxW || boxW.right <= innerWidth + 1;
        C.cur = null; C.coolTo = 0; C.hist.unshift({ name: spec.name, day: d0 - 60, end: d0 - 30, died: 3, inf: 9, ppl: A().map(a => a.agentId) }); app._ghShow(); await new Promise(r => setTimeout(r, 200));
        ui.lesson = !!tray.querySelector('.gh-lesson'); ui.undef2 = /undefined|NaN|\{[a-z]+\}/.test(tray.innerText); C.hist.shift(); app._ghHide?.();
        // 科技分頁:研究完的時代折疊,點開後刷新也記得
        const RP = w.research.projects; for (const q of Object.values(RP)) if ((q.era || 1) <= 2) { q.status = 'complete'; q.progress = q.cost; } w.research.refreshLocks(); app.state = w.getState(); app._techOpen = {};
        const mobile = innerWidth <= 768; const openTab = async (tab) => { if (mobile) app._openKairoTab(tab); else { app.activeTab = tab; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300)); };
        const pane = () => (mobile ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content')) || document.body;
        await openTab('econ-tech'); const fs = [...pane().querySelectorAll('details.tech-era-fold')]; ui.fold = fs.length >= 2 && fs.every(d => !d.open) && /12\/12|\d+\/\d+/.test(fs[0].querySelector('summary').innerText);
        fs[0]?.querySelector('summary').click(); await new Promise(r => setTimeout(r, 80)); await openTab('econ-tech'); const f2 = pane().querySelectorAll('details.tech-era-fold'); ui.keep = !!f2[0]?.open && !f2[1]?.open; ui.foldOverflow = document.documentElement.scrollWidth > innerWidth + 1;
        out.ui = ui; }
      return out;
    });
    const zh = lang === 'zh';
    ok(r.open.lab, '災厄工坊預設開放（不用再開隱藏開關）', r.open);
    ok(r.reg.mate && r.reg.notPark && r.reg.notAm && r.reg.closed === 0 && r.reg.sneakers && r.reg.quar === 0, '固定地點傳染：同時段同地點的人互傳；關酒館就斷，偷溜的人照樣碰面；隔離中的病人不出門', r.reg);
    ok(r.stay.home && r.stay.absent && r.stay.back, '恐慌時悲觀的人待在家，日常的點頭之交也斷了；之後恢復', r.stay);
    ok(r.fatigue.f1 === 1 && r.fatigue.f30 >= 2.9 && r.fatigue.fDeath === 1 && r.fatigue.mask30 > 0.6, '防疫疲乏：規定越久越多人撐不住（口罩效果變差）；死了人大家又收斂', r.fatigue);
    ok(r.sneak.brk && r.sneak.hyp && r.sneak.exposed && r.sneak.face >= 20 && r.sneak.trust > 0 && r.sneak.trust <= 3.5 && r.sneak.log && r.sneak.shame && r.sneak.after === 1, '偷溜：投贊成的人自己偷溜算說一套做一套，被抓到丟臉、全鎮信任小降、大家又收斂', r.sneak);
    ok(r.sneak.traced === 1 && r.sneak.traceLog && r.sneak.sus > 1, '偷溜的人比較容易染上，病倒後醫生一問就露餡', r.sneak);
    ok(r.reopen.made && r.reopen.cook === 'for' && r.reopen.cookWhy === 'cal_business' && r.reopen.doc === 'against' && r.reopen.res && r.reopen.open && r.reopen.log, '關太久：做生意的人提議重開酒館市集，廚師贊成、醫生反對；通過後重開', r.reopen);
    ok(r.food.n >= 1 && r.food.owe >= 2 && r.food.risk && r.food.log, '送飯：朋友把飯放門口，病人欠下人情；送飯的人自己也冒險', r.food);
    ok(r.stub.said && r.stub.oppFace > 0 && r.stub.propFace > 0 && r.stub.admit >= 1 && r.stub.log && r.stub.stub >= 2, '嘴硬：防疫被否決後又死人，反對的人丟臉（有人認錯、有人嘴硬），提案的人被說早該聽他的', r.stub);
    ok(r.pan.made && r.pan.n >= 2 && r.pan.sum > 0 && r.pan.seller && r.pan.money1 === 0 && r.pan.exp && r.pan.face >= 10 && r.pan.back > 0 && r.pan.money2 === 0 && r.pan.burned >= 2 && r.pan.sold && r.pan.log, '萬靈藥：錢只在村民之間移動，喝了照樣病倒就拆穿、賣的人丟臉退錢', r.pan);
    ok(r.pan.again.seller2 && r.pan.again.noBurned, '萬靈藥：上次被騙過的人不買、被拆穿過的人不敢再賣', r.pan.again);
    ok(r.lesson.L > 0.4 && r.lesson.f < 0.85 && r.lesson.thr === 1 && r.lesson.va && r.lesson.vn && r.lesson.Lold === 0 && r.lesson.calm && r.lesson.vc && r.lesson.said && r.lesson.tb, '集體記憶：上次死過人 → 早發現、早防疫、經歷過的人更配合；兩年後淡掉；上次沒事反而輕忽', r.lesson);
    ok(r.smog.md > 1.25 && r.smog.mw === 1 && r.smog.m5 === 1 && r.smog.lung >= 1.4, '煤煙讓飛沫傳得更兇、肺不好的人更容易染上', r.smog);
    ok(r.end.over && r.end.ppl > 0 && r.end.oldClear && r.end.sorry && r.end.reunion && r.end.seat && r.end.pw, '疫情過去：記得誰經歷過、有人去跟被冤枉的人道歉、老地方重新熱鬧、少了的人留下空位子', r.end);
    ok(r.anniv, '週年：死過人的疫情，鎮上點蠟燭', r.anniv);
    ok(r.credit.during === 0 && r.credit.after === 1, '疫情期間鎮上變差算在疫情頭上，不算提案的錯；過了就照常', r.credit);
    ok(r.save.pw && r.save.burned && r.save.sold && r.save.ok && r.brief.hyp, '存讀檔（疫情裡的人、被騙過的名單）、AI 知道自己偷偷沒守規定', { s: r.save, b: r.brief });
    ok(r.ui.tab && r.ui.box && r.ui.lines >= 5 && !r.ui.undef && !r.ui.cjk.length && !r.ui.overflow && r.ui.fit && r.ui.lesson && !r.ui.undef2, `介面：工坊分頁、「疫情裡的人」、上次疫情的記憶（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(r.ui.fold && r.ui.keep && !r.ui.foldOverflow, '科技分頁：研究完的時代折疊成一行，點開後畫面刷新也記得', { fold: r.ui.fold, keep: r.ui.keep, of: r.ui.foldOverflow });
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
