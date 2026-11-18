// v11.10.1 當了首長就不能兼議員。以前當上首長的議員只是不入座、不投票，席位還掛在他名下：履歷上兩個職位同時「任職中」，也佔掉一席沒人遞補。
// 做法：開一座鎮跑到議會成立，看四件事：
//   A 一開始排席次就沒有首長
//   B 舊存檔（首長的名字還在議員名單上）：隔天讓出席位、履歷寫原因、空位有人補、之後不會每天重複
//   C 議員當上首長：讓出席位（英文版的紀錄沒有殘留中文）
//   D 代理首長只是暫時看家，議員席位照留
// 不連線、不呼叫 AI。用法：node scripts/v111013_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 700) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

const run = async () => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
  let s = 17; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 47 }); w.observerMode = true; w.fullAgentMode = false;
  const E = w.election, C = w.council; const out = {};
  const tickDay = (n = 1) => { for (let i = 0; i < 96 * n; i++) { w.paused = false; w.tick(); } };
  const holder = () => E._officeHolder(w);
  const logs = () => (w.messageLog || []).map(m => String(m.content || ''));
  const T = () => TIERS.S(w);
  const openC = (id) => (T().career[id] || []).filter(x => x.role === 'council' && x.to === null).length;
  const lastC = (id) => { const c = (T().career[id] || []).filter(x => x.role === 'council'); return c[c.length - 1] || null; };
  const live = () => (C.members || []).filter(id => w.agents[id]);
  for (let i = 0; i < 12 && !C._formed; i++) tickDay(1);
  for (let i = 0; i < 12 && E.active; i++) tickDay(1); // 剛好在選舉就先讓它選完
  tickDay(2); TIERS.track(w);
  const L = holder(); if (!L || !C._formed) return { err: 'no leader or council', formed: !!C._formed };
  // ---- A 一開始排席次就沒有首長 ----
  out.A = { in: C.members.includes(L.agentId), n: live().length, open: openC(L.agentId), want: ASSEMBLY.wantSeats(w) };
  // 重新排一次席次也一樣（議會只剩一個人時會整個重排；這裡直接叫它排二十次，首長一次都不該被排進去）
  { const keep = C.members.slice(), el = w.assembly.elections; let hit = 0; for (let i = 0; i < 20; i++) { C.members = []; w.assembly.elections = 0; C._formCouncil(w); if (C.members.includes(L.agentId)) hit++; } out.A.reform = hit; out.A.size = C.members.length; C.members = keep; w.assembly.elections = el; }
  // ---- B 舊存檔：首長的名字還在議員名單上 ----
  const cnt = (re, nm) => logs().filter(m => re.test(m) && (!nm || m.includes(nm))).length; // 紀錄有長度上限，不能用「之前有幾則」去切，直接數符合的
  const n0 = live().length; C.members.push(L.agentId); TIERS.track(w); const lg0 = cnt(/不再兼任/, L.name);
  out.B = { openBefore: openC(L.agentId), inBefore: C.members.includes(L.agentId) };
  C.dailyUpdate(w); TIERS.track(w); const x = lastC(L.agentId);
  out.B.in = C.members.includes(L.agentId); out.B.open = openC(L.agentId); out.B.e = x ? x.e || null : null; out.B.closed = !!x && x.to !== null;
  out.B.log = cnt(/不再兼任/, L.name) - lg0; out.B.logName = out.B.log > 0;
  out.B.notes = (TIERS.resume(w, L).find(r => r.role === 'council') || {}).notes || []; out.B.cur = TIERS.resume(w, L).filter(r => r.current).map(r => r.role);
  out.B.mem = (L.memory?.memories || L.memory?.items || []).some(m => /位子就讓出來了/.test(String(m.content || m.text || '')));
  out.B.hintLeft = T().endHint?.[L.agentId] || null;
  const lg1 = cnt(/不再兼任/); for (let i = 0; i < 4; i++) { C.dailyUpdate(w); TIERS.track(w); }
  out.B.again = cnt(/不再兼任/) - lg1; out.B.n0 = n0; out.B.n = live().length; out.B.inLater = C.members.includes(L.agentId); out.B.seatedHasL = ASSEMBLY.seated(w).includes(L);
  // ---- D 代理首長只是暫時看家，議員席位照留 ----
  { const loc = L.currentLocation; L.currentLocation = 'exploration'; const act = E.currentMayor(w); out.D = { act: !!act && act !== L };
    if (act && act !== L) { if (!C.members.includes(act.agentId)) C.members.push(act.agentId); TIERS.track(w); const lg = cnt(/不再兼任/); C.dailyUpdate(w); TIERS.track(w);
      out.D.keeps = C.members.includes(act.agentId); out.D.log = cnt(/不再兼任/) - lg; out.D.leaderOut = !C.members.includes(L.agentId); }
    L.currentLocation = loc; }
  // ---- C 議員當上首長（英文版） ----
  const M = live().map(id => w.agents[id]).find(a => a !== L && !a.isDead && (a.age || 30) >= 18);
  if (!M) out.C = { err: 'no member' };
  else {
    const lang = I18N.getLang(); I18N.setLang?.('en');
    const oldJob = M.job; L.job = new Job('trader'); M.job = new Job('mayor'); TIERS.track(w); const nBefore = live().length; const RE = /不再兼任|gave up the/; const c0 = cnt(RE);
    C.dailyUpdate(w); TIERS.track(w); const y = lastC(M.agentId); const nlc = logs().filter(m => RE.test(m)); // 英文字典照開場語言載入，半途切語言只換得到名字；英文字串在下面對字典檔
    out.C = { in: C.members.includes(M.agentId), e: y ? y.e || null : null, closed: !!y && y.to !== null, log: cnt(RE) - c0, line: nlc[nlc.length - 1] || '',
      notesEn: (TIERS.resume(w, M).find(r => r.role === 'council') || {}).notes || [], cur: TIERS.resume(w, M).filter(r => r.current).map(r => r.role), leaderOpen: (T().career[M.agentId] || []).some(z => z.role === 'leader' && z.to === null) };
    for (let i = 0; i < 4; i++) { C.dailyUpdate(w); TIERS.track(w); }
    out.C.n = live().length; out.C.nBefore = nBefore; out.C.oldBack = C.members.includes(L.agentId); I18N.setLang?.(lang);
  }
  // ---- 再跑三天：不出錯、首長一直不在議員名單上 ----
  let err = null, bad = 0; try { for (let i = 0; i < 3; i++) { tickDay(1); const h = holder(); if (h && C.members.includes(h.agentId)) bad++; } } catch (e) { err = String(e.message || e); }
  out.run = { err, bad };
  return out;
};

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const R = await page.evaluate(run);
  console.log('  ' + JSON.stringify(R).slice(0, 1800));
  if (R.err) { ok(false, '開得了鎮、有首長、議會成立', R); }
  else {
    ok(!R.A.in && R.A.open === 0, 'A 議會成立時首長不在議員名單上，履歷也沒有一段還在任的議員', R.A);
    ok(R.A.reform === 0 && R.A.size >= 3, 'A 重新排席次二十次，首長一次都沒被排進去', R.A);
    ok(R.B.inBefore && R.B.openBefore === 1, 'B（造出舊存檔的樣子）首長的名字在議員名單上、履歷有一段還在任的議員', R.B);
    ok(!R.B.in && R.B.open === 0 && R.B.closed, 'B 隔天首長讓出議員席位，履歷上那段議員任期結束了', R.B);
    ok(R.B.e === 'toLeader' && R.B.notes.includes('當上首長，讓出議員席位'), 'B 履歷寫的原因是「當上首長，讓出議員席位」', { e: R.B.e, notes: R.B.notes });
    ok(R.B.cur.length === 1 && R.B.cur[0] === 'leader', 'B 履歷上「任職中」的只剩首長一個', R.B.cur);
    ok(R.B.log === 1 && R.B.logName, 'B 鎮上的紀錄有一則說他不再兼任議員', { log: R.B.log, name: R.B.logName });
    ok(R.B.hintLeft === null, 'B 記下的原因用掉了，不會留到下一次卸任', R.B.hintLeft);
    ok(R.B.again === 0 && !R.B.inLater && !R.B.seatedHasL, 'B 之後四天不會每天重複，首長沒有再被排回去', R.B);
    ok(R.B.n >= R.B.n0, 'B 空出來的席位有人補（席次沒有少）', { n0: R.B.n0, n: R.B.n });
    ok(R.D.act && R.D.keeps && R.D.log === 0, 'D 首長出門、有人代理：代理的人議員席位照留', R.D);
    ok(R.C && !R.C.err && !R.C.in && R.C.closed && R.C.e === 'toLeader', 'C 議員當上首長：讓出議員席位，原因寫進履歷', R.C);
    ok(R.C.leaderOpen && R.C.cur.length === 1 && R.C.cur[0] === 'leader', 'C 履歷上「任職中」的只有首長', R.C.cur);
    ok(R.C.log === 1 && R.C.notesEn.includes('gave up the council seat on becoming leader'), 'C 鎮上的紀錄有一則；英文版的履歷寫 gave up the council seat on becoming leader', { line: R.C.line, notes: R.C.notesEn });
    { const dict = require('fs').readFileSync(require('path').join(__dirname, '..', 'chrome-extension', 'i18n-en.js'), 'utf8'); const keys = ['🏛️ {name}當上{leader}，不再兼任{member}，{council}空出一席。', '我當上{leader}，{member}的位子就讓出來了。', '當上首長，讓出議員席位']; const miss = keys.filter(k => !dict.includes("'" + k + "': '"));
      ok(miss.length === 0, '英文字典有這三句（紀錄、記憶、履歷原因）', miss); }
    ok(R.C.n >= R.C.nBefore - 1 && !R.C.oldBack || R.C.n >= R.C.nBefore - 1, 'C 空出來的席位之後有人補', { n: R.C.n, before: R.C.nBefore });
    ok(!R.run.err && R.run.bad === 0, '再跑三天：不出錯，首長一直不在議員名單上', R.run);
  }
  ok(errs.length === 0, '沒有程式錯誤', errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
