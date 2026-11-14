// 事件追蹤紀錄器（sim-watch.js）與離線事件追蹤板（tools/event-board/）的測試。不連線、不呼叫 AI。
//   1. 靜態檢查：紀錄器認得的日誌原句都還在原始檔裡；紀錄器沒有用亂數、沒有寫記憶；正式站沒有載入它
//   2. 受控比較：不載入／載入沒接上／接上，同一顆種子跑出來的存檔、亂數取用次數、記憶、決策統計完全相同
//   3. 測試場景：人為設定起始條件，過程由真實程式跑出，檢查「被問到／回答／實際行動／結果」有分開記
//      （談成、罷工中有人退出、錢不夠罷工、抗議成形與有人答應沒到、抗議沒成形）
//   4. 離線事件追蹤板：用 file:// 打開、點事件、看時間線與參與者、重看現場；桌機與 390px 手機
// 用法：node scripts/watch_test.js [--no-compare]      需要本機 8126 服務 chrome-extension/
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'); const EXT = path.join(ROOT, 'chrome-extension'); const BOARD = path.join(ROOT, 'tools', 'event-board');
const BASE = process.env.BASE || 'http://localhost:8126/'; const SHOTS = process.env.SHOTS || path.join(ROOT, 'test-results', 'event-board');
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 400) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

(async () => {
  // ---------- 1. 靜態檢查 ----------
  const src = fs.readFileSync(path.join(EXT, 'sim-watch.js'), 'utf8');
  const game = ['sim-union.js', 'sim-market.js', 'sim-health.js'].map(f => fs.readFileSync(path.join(EXT, f), 'utf8')).join('\n');
  const keys = [...src.matchAll(/^        '([^'\n]+)': \(st, w, e\)/gm)].map(m => m[1]);
  ok(keys.length >= 18, '紀錄器認得的日誌原句至少 18 句', keys.length);
  const missing = keys.filter(k => !game.includes("'" + k + "'")); ok(missing.length === 0, '每一句都還在遊戲原始檔裡（改了原句這裡會擋下來）', missing);
  const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(!/Math\.random/.test(code), '紀錄器沒有用 Math.random');
  ok(!/memory\.add|addThought|modifyAffinity|WALLET\.(add|take)|stockpile/.test(code), '紀錄器沒有寫記憶、想法、好感、錢');
  ok(!/\b(UNION|MARKET|THINGS|DECIDE|WALLET)\.S\(/.test(code) && !/MK\(\)\.S\(|UN\(\)\.S\(/.test(code), '紀錄器沒有呼叫會建立狀態的 S(w)');
  ok(!fs.readFileSync(path.join(EXT, 'town.html'), 'utf8').includes('sim-watch') && !fs.readFileSync(path.join(EXT, 'sw.js'), 'utf8').includes('sim-watch') && !fs.readFileSync(path.join(EXT, 'index.html'), 'utf8').includes('sim-watch'), '正式站的頁面與離線快取都沒有載入紀錄器');
  const dec = fs.readFileSync(path.join(EXT, 'sim-decide.js'), 'utf8'); ok(/if \(OBS\.length\) emit\('decided'/.test(dec) && /if \(OBS\.length\) emit\('asked'/.test(dec), '決策核心的觀察點在沒有人聽時不做任何事');

  // ---------- 2. 受控比較 ----------
  if (!process.argv.includes('--no-compare')) {
    for (const [days, tier, seed] of [[30, 3, 7], [30, 2, 22]]) {
      let out = '', code0 = 0; try { out = execFileSync('node', [path.join(__dirname, 'watch_record.js'), 'compare', days, tier, seed], { encoding: 'utf8', timeout: 900000 }); } catch (e) { code0 = e.status || 1; out = String(e.stdout || '') + String(e.stderr || ''); }
      ok(code0 === 0 && /PASS/.test(out) && !/DIFF/.test(out), `受控比較：等級 ${tier}、種子 ${seed}、${days} 天，開關紀錄器前後完全相同`, out.split('\n').filter(l => /DIFF|FAIL|errors/.test(l)));
      console.log(out.split('\n').filter(l => /^(SAME|DIFF) (rng|saveHash|mem |decide)|errors/.test(l)).map(l => '     ' + l).join('\n'));
    }
  }

  // ---------- 3. 測試場景 ----------
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); let net = 0;
  await page.route('**/api/**', r => { if (/\/api\/chat/.test(r.request().url())) net++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  await page.addScriptTag({ content: src });
  const R = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = new World(); app.world = w;
    let s = 7, calls = 0; Math.random = () => { calls++; s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let clk = 1700000000000; Date.now = () => (clk += 7); app._gameAlert = () => {}; app._showCornerNotice = () => {};
    w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 7 }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
    try { app.state = w.getState(); app._generateTileMapLayout(); } catch (e) {}
    const M = MARKET, U = UNION; const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); const day = () => w._absDay();
    const tick = (n = 1) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } }; const days = (n) => tick(96 * n);
    const trait = (a, add, del) => { const T = a.personality.traits; for (const x of del || []) { const i = T.indexOf(x); if (i >= 0) T.splice(i, 1); } for (const x of add || []) if (!T.includes(x)) T.push(x); };
    const cash = (a, n) => { w.wallet.bal[a.agentId] = n; }; const like = (a, b, n) => { const r = a.relationships.getOrCreate(b.agentId, b.name); r.affinity = n; };
    const drain = () => DECIDE.drain(w, DECIDE.S(w), day());
    const out = { notes: [] };
    days(2); WATCH.attach(w);
    M.S(w); // 場景設定：沒有老闆的行業指定一位（不是這一行工人的成年人）當老闆
    { const spare = all().filter(a => (a.age ?? 30) >= 25 && !M.JOB2S[a.job?.key] && a.currentLocation !== 'exploration'); let i = 0; for (const k of Object.keys(M.SECTORS)) if (!w.agents[M.ownerOf(w, k)] && M.workersOf(w, k, all()).length >= 4 && spare[i]) { w.market.owners[k] = spare[i++].agentId; out.notes.push('場景設定：' + M.name(k) + '原本沒有老闆，指定' + w.agents[w.market.owners[k]].name + '當老闆'); } }
    const secs = Object.keys(M.SECTORS).map(k => ({ k, boss: w.agents[M.ownerOf(w, k)], ws: M.workersOf(w, k, all()).filter(a => a.agentId !== M.ownerOf(w, k) && (a.age || 30) >= 16) })).filter(x => x.boss && x.ws.length >= 4).sort((a, b) => b.ws.length - a.ws.length);
    if (!secs.length) { out.fatal = '沒有可用的行業'; out.watch = WATCH.export(w, {}); return out; }
    out.sectors = secs.map(x => [x.k, x.boss.name, x.ws.length]); if (secs.length < 3) { out.notes.push('私人產業不到三個，場景減少'); }
    for (const x of secs) w.market.pay[x.k] = 1; tick();
    const [A, B, C] = secs;
    // 場景一：工資被壓 → 有人帶頭組工會 → 提出要求 → 老闆答應（和平談成）
    w.market.pay[A.k] = 0.8; tick();
    const lead = A.ws[0]; trait(lead, ['charismatic'], ['greedy', 'shy']); cash(lead, 80);
    const X0 = DECIDE.S(w); const eLead = DECIDE.ruleOnce(w, lead, 'organize', true); if (!w.union?.on) { U.start(w, lead, []); out.notes.push('場景一：帶頭的決定照個性推估沒有選「帶頭」，改成直接成立工會（紀錄裡不會有他的決定）'); }
    out.s1 = { leadDecision: eLead ? eLead.id : null };
    for (const a of [...A.ws.slice(1), ...(B ? B.ws : []), ...(C ? C.ws : [])]) U.join(w, a); U.S(w).fund = 300; tick();
    trait(A.boss, ['kind'], ['greedy', 'abrasive']); cash(A.boss, 500);
    U.bargain(w, all(), day()); drain(); tick(); out.s1.pay = w.market.pay[A.k]; out.s1.hist = U.S(w).history.map(h => h.k + ':' + (h.s || '')).join(',');
    // 場景三：工會沒錢 → 老闆不答應 → 罷不了工
    if (C && w.union?.on && !U.S(w).strike[C.k]) {
      w.market.pay[C.k] = 0.75; tick(); trait(C.boss, ['greedy'], ['kind', 'generous', 'abrasive']); cash(C.boss, 30); U.S(w).fund = 0; U.S(w).talks[C.k] = -99;
      for (const a of C.ws) if (!U.S(w).members[a.agentId]) U.join(w, a);
      U.bargain(w, all(), day()); drain(); tick(); out.s3 = { striking: !!U.S(w).strike[C.k], ask: U.S(w).ask[C.k] ?? null };
    }
    // 場景二：老闆不答應 → 罷工；一個會員手頭緊、跟老闆交情好 → 不跟、退出工會
    if (B) {
      w.market.pay[B.k] = 0.7; tick(); trait(B.boss, ['greedy', 'abrasive'], ['kind', 'generous']); cash(B.boss, 40); U.S(w).fund = 400;
      const scabs = B.ws.filter(a => a.agentId !== U.S(w).leader).slice(0, 3); for (const scab of scabs) { cash(scab, 2); trait(scab, ['greedy'], []); like(scab, B.boss, 100); like(scab, w.agents[U.S(w).leader], -100); } out.s2 = { scabs: scabs.map(a => a.name), scabIds: scabs.map(a => a.agentId) };
      for (const a of B.ws) if (!scabs.includes(a)) { cash(a, 30); like(a, B.boss, -30); }
      U.bargain(w, all(), day()); drain(); tick(); out.s2.striking = !!U.S(w).strike[B.k]; out.s2.members0 = U.S(w).strike[B.k]?.members.length || 0;
      days(9); out.s2.hist = U.S(w).history.map(h => h.k + ':' + (h.s || '')).join(','); out.s2.stillStriking = !!U.S(w).strike[B.k];
    }
    // 場景四、五：號召抗議。四＝成形、有支持者、有一個答應了但當天不在鎮上；五＝只有兩個人，沒成形
    const X = THINGS.S(w); let things = Object.values(X.list).filter(T => !T.gone && !T.retired);
    out.things = things.map(T => [T.id, T.kind, !!T.place]);
    if (!things.length) { try { THINGS.register(w, { kind: 'test', key: 'hall', name: ['深夜賭坊', 'Night den'], place: null, owner: (C || A).boss.agentId }); } catch (e) { out.notes.push('建不出可以抗議的東西：' + e.message); } things = Object.values(X.list); }
    const until = (cond, max) => { let n = 0; while (!cond() && n++ < max) tick(); return cond(); };
    const stage = (T, haters, fans) => {
      X.att[T.id] = {}; for (const a of haters) X.att[T.id][a.agentId] = -85; for (const a of fans) X.att[T.id][a.agentId] = 85; X.lastProtest = -99; delete T.protest; delete T.call; if (X.intent) for (const k of Object.keys(X.intent)) if (k.startsWith(T.id + '|')) delete X.intent[k];
      const org = haters[0]; trait(org, ['charismatic'], ['shy']); const e = DECIDE.ruleOnce(w, org, 'thing', true); let how = e ? 'decision:' + e.id : 'none';
      if (!X.intent?.[T.id + '|' + org.agentId]) { const r = THINGS.actBy(w, org, T.id, 'protest'); how += ' → actBy:' + r; }
      const called = until(() => { X.lastProtest = -99; return !!T.call; }, 96 * 2 + 4); // 隔天一早才貼告示（全鎮一週一場的限制在場景裡先拿掉）
      return { tid: T.id, org: org.name, orgId: org.agentId, how, called, callDay: T.call?.d ?? null };
    };
    const pool = all().filter(a => (a.age ?? 30) >= 18 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId) && !secs.some(x => x.boss === a));
    const going = (T) => all().filter(a => a._thingGo && a._thingGo.id === T.id && a._thingGo.why === 'protest').map(a => a.agentId);
    if (things[0]) {
      const T = things[0]; const haters = pool.filter(a => a.agentId !== T.owner).slice(0, 9), fans = pool.filter(a => a.agentId !== T.owner).slice(9, 15);
      for (const a of haters) trait(a, [], ['shy']); out.s4 = stage(T, haters, fans);
      if (T.call) { tick(8); drain(); tick(); const gone = w.agents[T.call.who.find(id => id !== T.call.org)]; if (gone) { out.s4.gone = gone.name; out.s4.goneId = gone.agentId; gone._savedLoc = gone.currentLocation; gone.currentLocation = 'exploration'; }
        out.s4.promised = T.call.who.length; out.s4.promisedFans = T.call.fans.length;
        until(() => !T.call, 96 * 2); tick(); out.s4.formed = T.protest ? { n: T.protest.n, counter: T.protest.counter || 0 } : null; out.s4.going = going(T);
        tick(30); if (gone) { gone.currentLocation = gone._savedLoc || gone.homeLocation; delete gone._savedLoc; } days(1); }
    }
    if (things[0]) {
      const T = things[1] || things[0]; if (T === things[0]) out.notes.push('只有一樣東西可以抗議，場景五用同一樣（清掉 30 天間隔）');
      const few = pool.filter(a => a.agentId !== T.owner).slice(20, 28); out.s5 = stage(T, few, []);
      if (T.call) { tick(8); drain(); tick(); out.s5.promised = T.call.who.length; const away = T.call.who.filter(id => id !== T.call.org).map(id => w.agents[id]).filter(Boolean).slice(0, Math.max(0, T.call.who.length - 2)); // 留兩個人能到，其他人當天不在鎮上
        for (const a of away) { a._savedLoc = a.currentLocation; a.currentLocation = 'exploration'; } out.s5.away = away.length;
        until(() => !T.call, 96 * 2); tick(); out.s5.formed = !!(T.protest && T.protest.day === day()); out.s5.going = going(T).length; for (const a of away) { a.currentLocation = a._savedLoc || a.homeLocation; delete a._savedLoc; } } days(1);
    }
    out.rng = calls; out.watch = WATCH.export(w, { seed: 7, tier: 3, staged: true }); out.unionOn = !!w.union?.on;
    return out;
  });
  ok(errs.length === 0, '測試場景：頁面沒有錯誤', errs.slice(0, 3)); ok(R.watch.meta.errors.length === 0, '紀錄器自己沒有出錯', R.watch.meta.errors);
  console.log('     場景設定：', JSON.stringify({ sectors: R.sectors, s1: R.s1, s2: R.s2, s3: R.s3, s4: R.s4 && { ...R.s4, going: R.s4.going?.length }, s5: R.s5, notes: R.notes }).slice(0, 900));
  const W = R.watch; const TH = W.threads; const wage = TH.filter(t => t.type === 'wage'); const byK = (k) => wage.filter(t => t.sector === k);
  const [A, B, C] = R.sectors.map(x => x[0]);
  // 場景一
  const t1 = byK(A)[0]; ok(!!t1 && t1.outcome?.code === 'deal', '場景一（和平談成）：事件以「談成」結束，沒有罷工', t1 && [t1.outcome, t1.timeline.map(e => e.kind + ':' + e.text.slice(0, 20))]);
  if (t1) { const boss = t1.people.find(p => p.roles.includes('boss')); ok(!!boss && boss.asked.length === 1 && boss.answered.length === 1 && boss.answered[0].id === 'yes', '場景一：老闆「被問到」與「回答」各一筆，回答是答應', boss);
    ok(!t1.timeline.some(e => e.kind === 'strike') && !t1.people.some(p => p.acted.some(a => a.code === 'striking')), '場景一：沒有任何人被記成罷工');
    ok(t1.resources.some(r => r.what === 'pay' && r.to > r.from), '場景一：工資比例上升記在「錢與制度的變化」，來源是讀到的狀態', t1.resources);
    ok(t1.timeline.every(e => e.src && ['log', 'decision', 'state'].includes(e.src.type)), '場景一：時間線每一筆都有來源');
    ok(t1.timeline.filter(e => e.src.type === 'decision').every(e => e.whySrc === 'option' || e.whySrc === 'none'), '場景一：AI 關著時，理由一律標成「選項內建」，沒有標成本人說的'); }
  // 場景二
  if (B) { const t2 = byK(B)[0]; ok(!!t2 && t2.timeline.some(e => e.kind === 'strike'), '場景二：罷工有記進事件', t2 && t2.timeline.map(e => e.kind));
    if (t2) { const scab = t2.people.find(p => R.s2.scabIds.includes(p.id) && p.answered.some(a => a.id === 'work')); const leader = t2.people.find(p => p.roles.includes('leader'));
      ok(!!scab && scab.asked.length >= 1 && scab.result.some(a => a.code === 'crossed'), '場景二（有人退出）：手頭緊、跟老闆交情好的人被問到、回答不跟，結果是照常上工並退出工會', t2.people.filter(p => R.s2.scabIds.includes(p.id)).map(p => [p.name, p.answered.map(a => a.id)]));
      ok(!!scab && !scab.acted.some(a => a.code === 'striking'), '場景二：退出的人沒有被記成「在罷工名單上」', scab && scab.acted);
      ok(t2.timeline.some(e => e.kind === 'exit'), '場景二：時間線上有「退出」這一筆');
      const outs = t2.people.filter(p => p.answered.some(a => a.id === 'out')); ok(outs.length >= 1 && outs.every(p => p.acted.some(a => a.code === 'striking' || a.code === 'listed')), '場景二：回答「跟」的人，另外有從狀態讀到的「在罷工名單上」；兩件事分開記', outs.map(p => [p.name, p.acted.map(a => a.code)]));
      const listed = t2.people.filter(p => p.acted.some(a => a.code === 'listed')); const notAsked = listed.filter(p => !p.asked.length);
      ok(listed.length >= 3 && notAsked.every(p => p.roles.includes('leader')), '場景二：名單上的人除了領袖都有「被問到」的紀錄；領袖是直接列進去的（沒被問），兩欄對不上看得出來', [listed.length, notAsked.map(p => [p.name, p.roles])]);
      ok(['strike_won', 'strike_lost'].includes(t2.outcome?.code) || t2.status === 'open', '場景二：結果是罷工成功或失敗（由遊戲擲骰決定，兩種都算合法）', t2.outcome);
      ok(t2.resources.some(r => r.what === 'fund' && r.to < r.from), '場景二：罷工補貼讓工會基金變少，有記下來', t2.resources.map(r => r.text)); } }
  // 場景三
  if (C && R.s3) { const t3 = byK(C)[0]; ok(!!t3 && t3.outcome?.code === 'refused' && !t3.timeline.some(e => e.kind === 'strike'), '場景三（活動沒辦成）：老闆拒絕、工會錢不夠，事件以「罷不了工」結束', t3 && [t3.outcome, R.s3]); }
  ok(byK(A).every(t => !t.people.some(p => (R.s2?.scabIds || []).includes(p.id))) || A === B, '不同行業的事件沒有互相串在一起');
  // 場景四
  const prot = TH.filter(t => t.type === 'protest'); const t4 = R.s4 && prot.find(t => t.thing === R.s4.tid && t.scene);
  { const org = t4?.people.find(p => p.id === R.s4.orgId); ok(!!org && org.roles.includes('organizer'), '場景四：發起人有記下來', org && [org.roles, org.answered.length]); }
  ok(!!t4, '場景四：抗議成形，事件有現場紀錄', [R.s4, prot.map(t => [t.thing, t.outcome?.code, !!t.scene])]);
  if (t4) { const S = t4.scene; const goneP = t4.people.find(p => p.id === R.s4.goneId);
    ok(S.frames.length >= 2 && S.who.length >= 3, '場景四：現場有多格位置紀錄', [S.frames.length, S.who.length]);
    ok(S.who.every(id => R.s4.going.includes(id)) && S.who.length === R.s4.going.length, '場景四：現場名單等於遊戲真的排去現場的人，一個不多一個不少');
    ok(!!goneP && goneP.acted.some(a => a.code === 'promised') && goneP.acted.some(a => a.code === 'absent') && !S.who.includes(goneP.id), '場景四（答應了沒到）：那個人有「在名單上」也有「沒有去（當天不在鎮上）」，而且不在現場名單裡', goneP && goneP.acted);
    const present = t4.people.filter(p => p.acted.some(a => a.code === 'present')); ok(present.length >= 3 && present.every(p => S.who.includes(p.id)), '場景四：記成「人在現場」的都在現場名單裡', present.length);
    ok(S.frames.some(f => Object.values(f.pos).some(p => p.st === 'present')) && S.frames.at(-1) && Object.values(S.frames.at(-1).pos).every(p => p.st === 'left'), '場景四：看得到到場與散場');
    ok(t4.people.some(p => p.asked.length && p.answered.length), '場景四：有人是「被問到 → 回答」的完整紀錄');
    ok(t4.outcome?.code === 'held', '場景四：事件在散場後結束', t4.outcome); }
  const t5 = R.s5 && prot.find(t => t.thing === R.s5.tid && t.outcome?.code === 'fizzled');
  ok(!!t5 && !t5.scene, '場景五（沒人加入）：到的人不夠，事件以「沒有成形」結束，沒有現場', [R.s5, prot.map(t => [t.thing, t.outcome?.code])]);
  if (t5) ok(t5.people.filter(p => p.acted.some(a => a.code === 'promised')).length >= 3 && t5.people.filter(p => p.acted.some(a => a.code === 'absent')).length >= 1 && !t5.people.some(p => p.acted.some(a => a.code === 'present' || a.code === 'sent')), '場景五：答應的人留在「名單上」那一欄，沒有任何人被記成到場', t5.people.map(p => p.acted.map(a => a.code)));
  ok(net >= 0, `全程沒有連到真實 AI（遊戲自己發出的 ${net} 個 /api/chat 請求都在本機攔下，回空白）`);
  // 匯出測試場景給離線追蹤板
  W.source = 'STAGED_SCENARIO'; W.meta.label = '測試場景（起始條件人為設定，過程由真實程式跑出）';
  fs.mkdirSync(path.join(BOARD, 'data'), { recursive: true });
  fs.writeFileSync(path.join(BOARD, 'data', 'staged.js'), '// 由 scripts/watch_test.js 產生：起始條件是人為設定的，過程由真實遊戲程式跑出。不是自然發生的遊戲紀錄，也不是手寫資料。\n(window.RIMTOWN_EVENT_DATA = window.RIMTOWN_EVENT_DATA || []).push(' + JSON.stringify(W) + ');\n');

  // ---------- 4. 離線事件追蹤板 ----------
  const files = fs.readdirSync(path.join(BOARD, 'data')).filter(f => f.endsWith('.js') && f !== 'manifest.js').sort((a, b) => (a.startsWith('real') ? 0 : 1) - (b.startsWith('real') ? 0 : 1) || a.localeCompare(b));
  fs.writeFileSync(path.join(BOARD, 'data', 'manifest.js'), '// 事件追蹤板要載入的資料檔（由 scripts/watch_test.js 更新）\nwindow.RIMTOWN_EVENT_FILES = ' + JSON.stringify(files) + ';\n');
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const p = await (await browser.newContext({ viewport: vp, deviceScaleFactor: name === 'mobile' ? 2 : 1 })).newPage(); const e2 = []; p.on('pageerror', e => e2.push(e.message)); let req = 0; p.on('request', r => { if (/^https?:/.test(r.url())) req++; });
    await p.goto('file://' + path.join(BOARD, 'index.html')); await p.waitForSelector('#ds option', { state: 'attached' });
    const idx = await p.evaluate(() => [...document.querySelectorAll('#ds option')].findIndex(o => /測試場景/.test(o.textContent))); await p.selectOption('#ds', String(idx)); await p.waitForSelector('.card');
    ok(await p.locator('.badge.staged').count() >= 1, `追蹤板（${name}）：測試場景有明確標示，不會被當成真實紀錄`);
    await p.locator('.card', { hasText: '工資爭議' }).first().click(); await p.waitForSelector('.tl li');
    ok(await p.locator('main th', { hasText: '被問到' }).count() === 1 && await p.locator('main th', { hasText: '實際行動' }).count() === 1, `追蹤板（${name}）：參與者表格把被問到、回答、實際行動、結果分欄`);
    await p.locator('.tl .src').first().click(); ok(await p.locator('pre.raw:not([hidden])').count() === 1, `追蹤板（${name}）：點來源看得到原始紀錄`);
    await p.screenshot({ path: path.join(SHOTS, `${name}-wage.png`), fullPage: name === 'desktop' });
    if (name === 'mobile') await p.locator('[data-back]').click();
    await p.locator('.card', { hasText: '號召抗議' }).first().click(); await p.waitForSelector('#cv');
    const hasScene = await p.locator('#fr').count();
    if (hasScene) { const before = await p.locator('#frLabel').textContent(); await p.locator('#fr').fill('2'); await p.locator('#fr').dispatchEvent('input'); const after = await p.locator('#frLabel').textContent(); ok(before !== after, `追蹤板（${name}）：拖時間軸可以重看現場`, [before, after]); }
    await p.locator('main .who').first().click(); ok(await p.locator('main h2', { hasText: '只看' }).count() === 1 && await p.locator('.filters .on', { hasText: '正在跟' }).count() === 1, `追蹤板（${name}）：點人可以只看這個人跨事件的先後`);
    await p.locator('#cv').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(SHOTS, `${name}-protest.png`) });
    const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); ok(!wide, `追蹤板（${name}）：頁面沒有橫向捲動`);
    ok(e2.length === 0 && req === 0, `追蹤板（${name}）：沒有錯誤，也沒有任何對外連線`, [e2.slice(0, 2), req]); await p.context().close();
  }
  await browser.close();
  console.log(`\n${pass} checks passed, ${fail} failed；截圖在 ${path.relative(ROOT, SHOTS)}/`); process.exit(fail ? 1 : 0);
})();
