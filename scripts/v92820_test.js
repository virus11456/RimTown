// v9.28.2 智能體互動檢查修出來的幾件事
// 1) 誰住哪一棟跟著存檔走：重新整理後不換房，翻修過的房子還是原來的人在住；人走了房子才空出來
// 2) 問 AI 之前再確認一次處境：過時的題目不送出去；題目寫明人數
// 3) 同一類的事一天最多問 AI 兩件，名額分給不同的事
// 4) 村民自己想提案：題目不再寫死例子，改給隨機的發想方向，並附上最近提過的案子
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const open = async (browser, lang) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(1200);
  return { ctx, page, errs };
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ---------- 1) 房子 ----------
  console.log('— 誰住哪一棟');
  { const { ctx, page, errs } = await open(browser, 'zh');
    const snap = () => page.evaluate(() => { const w = window.rimtownApp.world; const H = HOUSING.S(w); const m = {}; for (const a of Object.values(w.agents)) if (!a.isPlayer && !a.isDead) m[a.agentId] = HOUSING.houseOf(w, a); return { m, home: Object.fromEntries(Object.values(w.agents).map(a => [a.agentId, a.homeLocation + (a.isDead ? '(dead)' : '')])), zones: Object.keys(window.rimtownApp.tileMap._houseSubZones || {}).length, lv: { ...H.lv }, n: Object.keys(m).length, sameObj: window.rimtownApp.tileMap._agentHouseMap === w.housing.map, saved: Object.keys(w.serialize().housing?.map || {}).length }; });
    const first = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
      const w = app.world; w.observerMode = true; for (let d = 0; d < 12; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
      const H = HOUSING.S(w); const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      /* 這十二天畫面沒在跑：先讓「夫妻住一起」「房子夠不夠」照平常那樣同步好，再記下誰住哪 */ for (let i = 0; i < 3; i++) { app._syncHousing(); for (const a of all) HOUSING.houseOf(w, a); }
      const single = all.filter(a => !String(a.agentId).startsWith('visit_') && !a.relationships?.getSpouse?.() && /_\d+$/.test(String(HOUSING.houseOf(w, a) || '')));
      const rich = single[0]; const hRich = HOUSING.houseOf(w, rich); H.lv[hRich] = 2; H.ver++;
      // 把一個人安排到加蓋的小屋：存檔裡會出現 residential_extra_N，讀檔後要蓋得回來
      const tm = app.tileMap; const n0 = Object.keys(tm._houseSubZones).length; tm.ensureHouseCapacity(n0 + 1); const extra = Object.keys(tm._houseSubZones).find(k => /^residential_extra_/.test(k) && !Object.values(H.map).includes(k)) || null; const ex = single[1]; if (extra) H.map[ex.agentId] = extra; app._syncHousing(); for (const a of all) HOUSING.houseOf(w, a);
      const ok = await app.saveGame();
      return { ok, richId: rich.agentId, hRich, exId: ex.agentId, extra };
    });
    const before = await snap();
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(2500);
    const after = await snap();
    const moved = Object.keys(before.m).filter(id => after.m[id] !== undefined && after.m[id] !== before.m[id]);
    ok(first.ok && before.n >= 15 && before.sameObj && before.saved >= before.n - 2, '誰住哪一棟記在世界狀態裡，存檔帶得走', { n: before.n, sameObj: before.sameObj, saved: before.saved });
    ok(moved.length === 0 && after.n >= before.n - 1, '存檔後重新整理：沒有人換房子', { moved: moved.slice(0, 5).map(id => `${id}: ${before.m[id]} → ${after.m[id]}`), before: before.n, after: after.n });
    ok(after.m[first.richId] === first.hRich && after.lv[first.hRich] === 2, '翻修過的房子，重新整理後還是原來那個人在住', { was: first.hRich, now: after.m[first.richId], lv: after.lv[first.hRich] });
    ok(!first.extra || after.m[first.exId] === first.extra, '住在加蓋小屋的人，重新整理後小屋蓋得回來、人還在裡面', { extra: first.extra, now: after.m[first.exId], homeBefore: before.home[first.exId], homeAfter: after.home[first.exId], zonesBefore: before.zones, zonesAfter: after.zones });
    const r2 = await page.evaluate(({ richId }) => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; const H = HOUSING.S(w); const out = {};
      // 人走了，房子空出來
      const gone = Object.values(w.agents).find(a => !a.isPlayer && !a.isDead && a.agentId !== richId && !a.relationships?.getSpouse?.() && H.map[a.agentId]); const hGone = H.map[gone.agentId];
      gone.isDead = true; HOUSING.daily(w); out.pruned = H.map[gone.agentId] === undefined; out.others = Object.keys(H.map).length;
      // 出遠門的不算走
      const away = Object.values(w.agents).find(a => !a.isPlayer && !a.isDead && H.map[a.agentId] && a.agentId !== richId); const hAway = H.map[away.agentId]; const isAway0 = w.isAway; delete w.agents[away.agentId]; w.isAway = (id) => id === away.agentId || !!isAway0?.call(w, id); HOUSING.daily(w); out.awayKept = H.map[away.agentId] === hAway; w.agents[away.agentId] = away; w.isAway = isAway0;
      // 舊存檔沒有這張表：照樣讀得進來，之後開始記
      const d = JSON.parse(JSON.stringify(w.serialize())); delete d.housing.map; const w2 = new World(); const okLoad = w2.loadSave(d); out.old = { ok: !!okLoad, map: !!w2.housing && typeof w2.housing.map === 'object' && Object.keys(w2.housing.map).length === 0, lv: Object.keys(w2.housing?.lv || {}).length > 0 };
      // 地圖重畫(換鎮、讀檔)後再接一次：同一張表、同樣的分配
      const m0 = JSON.stringify(H.map); app.tileMap._agentHouseMap = {}; HOUSING.bind(w, app.tileMap); out.rebind = app.tileMap._agentHouseMap === H.map && JSON.stringify(H.map) === m0;
      // 表裡指到不存在的房子：那一筆丟掉，重新分配
      const victim = Object.keys(H.map)[0]; H.map[victim] = 'residential_nowhere_9'; app.tileMap._agentHouseMap = {}; HOUSING.bind(w, app.tileMap); out.badDropped = H.map[victim] === undefined; const again = HOUSING.houseOf(w, w.agents[victim]); out.reassigned = !!again && again !== 'residential_nowhere_9';
      return out;
    }, { richId: first.richId });
    ok(r2.pruned, '人過世了，他的房子空出來', r2);
    ok(r2.awayKept, '出遠門的人，房子留著', r2);
    ok(r2.old.ok && r2.old.map && r2.old.lv, '舊存檔沒有這張表：照樣讀得進來，翻修等級還在', r2.old);
    ok(r2.rebind, '地圖重畫後接回同一張表，分配不變', r2);
    ok(r2.badDropped && r2.reassigned, '表裡指到不存在的房子：那一筆丟掉，重新分配', r2);
    ok(errs.length === 0, '沒有程式錯誤', errs.slice(0, 3));
    await ctx.close(); }

  // ---------- 2～4) 問 AI ----------
  for (const lang of ['zh', 'en']) {
    console.log(`— 問 AI（${lang}）`); const L = `[${lang}] `;
    const { ctx, page, errs } = await open(browser, lang);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
      const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const ce = w.conversationEngine;
      for (let d = 0; d < 2; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
      app._fullAgentOn = () => w.fullAgentMode; const X = DECIDE.S(w); const K = DECIDE.KINDS; const Bal = w.wallet.bal;
      const holder = w.election._officeHolder(w); const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const pool = all().filter(a => a !== holder && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId) && !String(a.agentId).startsWith('imm_')); const [A, B, C, D, E2] = pool;
      const R = (a, b) => a.relationships.getOrCreate(b.agentId, b.name);
      // 找一對真的吵得起來的人(年紀、在不在鎮上等條件都過)
      const hate = (x, y, v) => { R(x, y).affinity = v; R(y, x).affinity = v; }; const rest = pool.slice(5); let F = null, G = null;
      for (let i = 0; i < rest.length - 1 && !F; i++) { const x = rest[i], y = rest[i + 1]; const a0 = R(x, y).affinity, b0 = R(y, x).affinity; hate(x, y, -60); w._feudCooldown = {}; if ((w.feudCands(x) || []).some(c => c.b === y)) { F = x; G = y; } R(x, y).affinity = a0; R(y, x).affinity = b0; }
      const calm = () => { X.cool = {}; X.q = []; w._feudCooldown = {}; for (const a of all()) { Bal[a.agentId] = 60; a.mood = 60; a.moodModifier = 0; for (const r of Object.values(a.relationships.relationships)) { r.affinity = Math.max(-20, Math.min(20, r.affinity || 0)); r.romanticInterest = 0; } } };
      const only = (keep) => { const d = w._absDay(); for (const a of all()) for (const k of Object.keys(K)) if (!(keep[a.agentId] || []).includes(k)) X.cool[a.agentId + '|' + k] = d + 9; };
      const today = () => { X.lastDay = -1; DECIDE.daily(w); };
      const save = { ok: ce.fullAgentOk, ask: ce._askJson }; let prompts = []; let reply = () => null;
      ce.fullAgentOk = () => true; ce._askJson = async (p, mt) => { prompts.push(p); return reply(p); };
      const cjk = (s) => /[一-鿿]/.test(String(s || ''));
      const loc = (p) => { try { return (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? I18N.localizeNames(p, true) : p; } catch (e) { return p; } }; // 真的送出去之前名字會換成英文拼法，這裡照做

      // 2a) 題目寫明人數
      calm(); w.fullAgentMode = true; Bal[A.agentId] = 2; only({ [A.agentId]: ['pinch'] }); prompts = []; reply = () => [{ n: 1, pick: 'endure', why: 'W1' }];
      today(); await DECIDE.flush(); await DECIDE.flush();
      out.count = { asked: prompts.length, says1: /只有 1 位村民|exactly 1 villagers/.test(prompts[0] || ''), cjk: cjk(loc(prompts[0] || '')), ai: (X.log[A.agentId] || []).slice(-1)[0]?.ai };

      // 2b) 過時的題目不送：A 手頭很緊、B 碰上死對頭，兩件事分兩批問；第一批問出去的時候兩個人的處境都變了
      calm(); Bal[A.agentId] = 2; hate(F, G, -60); only({ [A.agentId]: ['pinch'], [F.agentId]: ['feud'] }); prompts = [];
      reply = () => { Bal[A.agentId] = 100; hate(F, G, 0); return [{ n: 1, pick: 'calm', why: 'W2' }, { n: 1, pick: 'endure', why: 'W2' }]; };
      const st0 = { ...X.st }; delete X.log[A.agentId]; delete X.log[F.agentId];
      today(); const queued = X._asked; await DECIDE.flush(); await DECIDE.flush();
      out.stale = { queued, sent: prompts.length, asked: X._asked, logged: (X.log[A.agentId] || []).length + (X.log[F.agentId] || []).length, miss: (X.st.aiMiss || 0) - (st0.aiMiss || 0) };
      // 隔天不會把他們當成「AI 沒回話」
      { const m0 = X.st.aiMiss || 0; w.fullAgentMode = false; X.cool = Object.fromEntries(all().flatMap(a => Object.keys(K).map(k => [a.agentId + '|' + k, w._absDay() + 9]))); X.lastDay = -1; const _d = w._absDay; w._absDay = () => _d.call(w) + 1; DECIDE.daily(w); w._absDay = _d; out.stale.stuck = (X.st.aiMiss || 0) - m0; w.fullAgentMode = true; }

      // 3) 同一類一天最多問 AI 兩件：五個人手頭很緊，另外一個人碰上死對頭
      calm(); for (const a of [A, B, C, D, E2]) Bal[a.agentId] = 2; hate(F, G, -60); Bal[F.agentId] = 8; /* 手上沒什麼錢：別人不會找他借，不然「有人來借錢」會先插隊，他碰上死對頭那件事就擱下了 */
      only({ [A.agentId]: ['pinch'], [B.agentId]: ['pinch'], [C.agentId]: ['pinch'], [D.agentId]: ['pinch'], [E2.agentId]: ['pinch'], [F.agentId]: ['feud'] }); prompts = [];
      reply = (p) => [1, 2, 3, 4, 5].map(n => ({ n, pick: /calm＝|calm=/.test(p) ? 'calm' : 'endure', why: 'W3' }));
      for (const a of [A, B, C, D, E2, F]) delete X.log[a.agentId]; const s3 = { ...X.st };
      today(); await DECIDE.flush(); await DECIDE.flush();
      const last = (a) => (X.log[a.agentId] || []).slice(-1)[0] || null; const P = [A, B, C, D, E2].map(last);
      const pinchPrompt = prompts.find(p => /endure＝|endure=/.test(p)) || '';
      out.cap = { prompts: prompts.length, pinchPrompts: prompts.filter(p => /endure＝|endure=/.test(p)).length, feudPrompts: prompts.filter(p => /calm＝|calm=/.test(p)).length, inPinch: (pinchPrompt.match(/^=== /gm) || []).length, aiPinch: P.filter(e => e?.ai).length, rulePinch: P.filter(e => e && !e.ai).length, feudAi: last(F)?.ai, ai: X.st.ai - s3.ai, rule: X.st.rule - s3.rule, max: DECIDE.AI_MAX };
      // 存檔不帶當天的計數
      out.cap.saved = Object.keys(w.serialize().decide || {}).filter(k => k.startsWith('_'));

      // 4) 村民自己想提案的題目
      calm(); const PS = w.proposals; PS.items.push({ id: 'L900', n: 900, status: 'rejected', proposerId: B.agentId, proposerName: B.name, createdDay: w._absDay() - 2, votes: {}, why: {}, kind: 'free', key: 'free:T900', tk: '測試案甲', tp: {}, dk: 'x', dp: {}, cost: {}, fx: [] }, { id: 'L901', n: 901, status: 'approved', proposerId: C.agentId, proposerName: C.name, createdDay: w._absDay() - 1, votes: {}, why: {}, kind: 'free', key: 'free:T901', tk: '測試案乙', tp: {}, dk: 'y', dp: {}, cost: {}, fx: [] });
      const ps = []; reply = () => ({ skip: true }); for (let i = 0; i < 6; i++) { prompts = []; await ce.inventProposal(w, A, [{ title: 'H', desc: 'h' }]); ps.push(prompts[0] || ''); }
      const p0 = loc(ps[0]); const dirLine = (p) => (p.match(/(?:可以從這幾個方向想[^：]*：|Some directions to think from[^:]*: )([^\n]*)/) || [])[1] || '';
      out.prop = { n: ps.filter(Boolean).length, cat: ps.some(p => /貓立雕像|statue for the cat/.test(p)), dir: !!dirLine(p0), dirs: new Set(ps.map(dirLine)).size, recent: /測試案甲/.test(p0) && /測試案乙/.test(p0), rejected: /測試案甲\s*[（(]\s*(否決|rejected)\s*[）)]/i.test(p0), seg: (p0.match(/[^\n]{0,30}測試案甲[^\n]{0,40}/) || [''])[0], tie: /跟你提的這件事直接有關|follow directly from what you are proposing/.test(p0), cjk: cjk(p0.replace(/測試案[甲乙]/g, '')), bits: (p0.replace(/測試案[甲乙]/g, '').match(/[^\n]{0,24}[一-鿿][^\n]{0,24}/g) || []).slice(0, 5) };
      PS.items = PS.items.filter(p => p.id !== 'L900' && p.id !== 'L901');
      ce.fullAgentOk = save.ok; ce._askJson = save.ask; w.fullAgentMode = false;
      let err = null; try { for (let d = 0; d < 3; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } } catch (e) { err = String(e.stack || e); }
      out.days = { err, q: X.q.length };
      return out;
    });
    const zh = lang === 'zh';
    ok(r.count.asked === 1 && r.count.says1 && r.count.ai === 1 && (zh || !r.count.cjk), L + '題目寫明「只有幾位村民、陣列只能有幾個物件」', r.count);
    ok(r.stale.queued === 2 && r.stale.sent === 1 && r.stale.asked === 1 && r.stale.logged === 0 && r.stale.miss === 0 && r.stale.stuck === 0, L + '輪到後面那一批時處境已經變了：不送出去、名額還回來，也不會被算成「AI 沒回話」', r.stale);
    ok(r.cap.inPinch === 2 && r.cap.aiPinch === 2 && r.cap.rulePinch === 3 && r.cap.feudAi === 1 && r.cap.pinchPrompts === 1 && r.cap.feudPrompts === 1, L + '五個人手頭很緊：只問 AI 兩個，其餘三個照個性；另一類的事照樣問 AI', r.cap);
    ok(r.cap.saved.length === 0, L + '當天問了幾件的計數不進存檔', r.cap.saved);
    ok(r.prop.n === 6 && !r.prop.cat && r.prop.dir && r.prop.dirs >= 3, L + '提案題目不再寫死「替貓立雕像」這類例子；每次給的發想方向不一樣', { n: r.prop.n, cat: r.prop.cat, dir: r.prop.dir, dirs: r.prop.dirs });
    ok(r.prop.recent && r.prop.rejected && r.prop.tie, L + '提案題目附上最近提過的案子與結果，並要求效果跟提案直接有關', r.prop);
    if (!zh) ok(!r.prop.cjk, L + '英文版的提案題目沒有中文', r.prop.bits);
    ok(!r.days.err && r.days.q === 0, L + '照常跑三天沒有錯誤', r.days);
    ok(errs.length === 0, L + '沒有程式錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
