// v9.5.0 鎮上話題(醞釀→正熱→餘波→淡出、同時只關注三件、聊天會講、AI 提示詞、存讀檔)
// ＋人生劇本(心願分階段、存款大跌退回原點、心碎、和解、落選不放棄、達成寫進人生故事、村民卡與鎮況)
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(lang) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  if (lang === 'en') await page.evaluate(() => new Promise(r => I18N.ensureDict(r)));
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    try { app._visitorMailboxTick?.(); } catch (e) {}
    const logs = []; const lm = w.logMessageT; w.logMessageT = function (type, k, p, ...rest) { logs.push({ type, k, p }); return lm.call(this, type, k, p, ...rest); };
    const P = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
    const sw = w._absDay; let fd = (w._absDay?.() || 1); w._absDay = () => fd; const next = (n = 1) => { for (let i = 0; i < n; i++) { fd++; BUZZ.daily(w); } };
    // ================= 鎮上話題 =================
    w.buzz = null; BUZZ.S(w);
    const a0 = P()[0], a1 = P()[1], a2 = P()[2], a3 = P()[3];
    w.dailyNews.collectEvent('quest', '任務不算話題', 10, [a0.name]);
    w.dailyNews.collectEvent('social', '小聊天不算', 4, [a0.name]);
    out.skip = BUZZ.S(w).items.length;
    w.dailyNews.collectEvent('politics', '測試醜聞A', 9, [a0.name]);
    const A = BUZZ.S(w).items[0]; out.brew = { ph: A?.ph, heat: A?.heat };
    w.dailyNews.collectEvent('politics', '測試醜聞A又有新消息', 8, [a0.name]); // 同一個人同一類 → 疊在一起
    out.merged = BUZZ.S(w).items.length;
    next(1); out.hot = { ph: A.ph, log: logs.some(x => /全鎮都在談/.test(x.k)) };
    // 再冒出三件更大的事 → 最冷的被擠下去
    for (const [txt, who] of [['測試大火B', a1], ['測試政變C', a2], ['測試婚禮D', a3]]) { w.dailyNews.collectEvent('event', txt, 10, [who.name]); w.dailyNews.collectEvent('event', txt, 10, [who.name]); }
    next(1);
    const top = BUZZ.attended(w).map(x => x.text); out.cap = { n: top.length, hasA: top.includes(A.text), aPh: A.ph };
    for (let i = 0; i < 6 && A.ph !== 'after'; i++) next(1);
    out.crowd = { aPh: A.ph, log: logs.some(x => /漸漸沒人提了/.test(x.k)) };
    // 閒聊會講到正在熱的話題
    const r0 = Math.random; Math.random = () => 0.01; let conv = null;
    try { const ce = w.conversationEngine; const ra = P()[4].relationships.getOrCreate(P()[5].agentId, P()[5].name), rb = P()[5].relationships.getOrCreate(P()[4].agentId, P()[4].name); conv = ce._fallbackConversation(P()[4], P()[5], w, ra, rb); } catch (e) { out.convErr = String(e); } finally { Math.random = r0; }
    out.talk = { lines: (conv?.dialogue || []).map(l => l.text).slice(-2) };
    out.brief = (w.conversationEngine._agentBrief(w, P()[0], null).mem || []).find(s => /測試/.test(s)) || null;
    out.topics = (w.events.conversationTopics || []).filter(s => /測試/.test(s)).length;
    const html = app._townBlocks(null, ['buzz', 'lives']); out.buzzHtml = /pp-buzz-row/.test(html.buzz);
    // 存讀檔
    const sv = JSON.parse(JSON.stringify(w.serialize())); out.saved = !!sv.buzz && sv.buzz.items.length > 0;
    // 冷掉:一路放著 → 全部淡出,正熱過的進「最近談過」
    next(40); out.fade = { left: BUZZ.S(w).items.length, hist: BUZZ.S(w).hist.length };
    // 醞釀太久沒人理就熄掉、不進紀錄
    const h0 = BUZZ.S(w).hist.length; w.dailyNews.collectEvent('economy', '測試小事E', 7, [a0.name]); next(8); out.fizzle = { left: BUZZ.S(w).items.length, hist: BUZZ.S(w).hist.length - h0 };
    w.loadSave(sv); out.reload = (w.buzz?.items || []).length > 0;
    w._absDay = sw; fd = w._absDay?.() || fd;
    // ================= 人生劇本 =================
    if (!w.wallet) try { WALLET.S(w); } catch (e) {}
    const M = MIND.S(w); const d0 = w._absDay(); let ad = d0; w._absDay = () => ad;
    const gw = WALLET.get; const cash = {}; WALLET.get = (W, a) => (a && cash[a.agentId] != null) ? cash[a.agentId] : gw(W, a);
    const step = () => { ad += 3; ARCS.daily(w); };
    // 發財:兩階段＋賠光退回原點
    const R = P()[6]; M.amb[R.agentId] = { key: 'rich', since: ad }; cash[R.agentId] = 10; step();
    cash[R.agentId] = 70; step(); const s1 = M.amb[R.agentId].st;
    cash[R.agentId] = 170; step(); const s2 = M.amb[R.agentId].st;
    cash[R.agentId] = 10; step(); const s3 = M.amb[R.agentId].st;
    out.rich = { s1, s2, s3, beats: (M.amb[R.agentId].lg || []).length, broke: (M.amb[R.agentId].lg || []).some(x => /賠光/.test(x.k)) };
    // 心碎
    const L = P()[7], T = P()[8], O = P()[9];
    M.amb[L.agentId] = { key: 'love', target: T.agentId, since: ad }; step();
    const ro = T.relationships.getOrCreate(O.agentId, O.name); ro.status = 'dating';
    step(); out.heart = { changed: M.amb[L.agentId]?.target !== T.agentId || M.amb[L.agentId]?.key !== 'love', story: (M.story?.[L.agentId] || []).slice(-1)[0]?.end, mem: (L.memory?.entries || []).some(m => /自作多情/.test(m.k || m.content || '')) };
    ro.status = 'friend';
    // 和解
    const V = P()[10], F = P()[11]; const rv = V.relationships.getOrCreate(F.agentId, F.name); rv.affinity = -50;
    M.amb[V.agentId] = { key: 'revenge', target: F.agentId, since: ad }; step(); const vs = M.amb[V.agentId]?.st;
    rv.affinity = 30; step(); out.peace = { st: vs, end: (M.story?.[V.agentId] || []).slice(-1)[0]?.end };
    // 落選不放棄
    const E = P()[12]; const ps = w.proposals; const rec0 = ps.record.bind(ps); ps.record = (id) => id === E.agentId ? { made: 2, approved: 4, done: 1 } : rec0(id);
    M.amb[E.agentId] = { key: 'leader', since: ad }; step(); const es = M.amb[E.agentId].st;
    w.election.electionHistory.push({ day: ad + 1, winner: { agentId: P()[13].agentId, name: P()[13].name }, candidates: [{ agentId: E.agentId, name: E.name, votes: 2 }, { agentId: P()[13].agentId, name: P()[13].name, votes: 5 }] });
    step(); out.lost = { st: es, beat: (M.amb[E.agentId].lg || []).some(x => /沒有放棄/.test(x.k)), still: M.amb[E.agentId].key === 'leader' };
    ps.record = rec0;
    // 達成 → 人生故事
    cash[R.agentId] = 400; M.lastAmb = -99; MIND.daily(w); ad += 3; ARCS.daily(w);
    out.done = { end: (M.story?.[R.agentId] || []).some(s => s.end === 'done') ? 'done' : (M.story?.[R.agentId] || []).map(s => s.end).join(','), recent: (M.recent || []).length }; // 達成後新抽的心願可能當場心碎,所以看整段人生故事
    // 介面
    const H = app._townBlocks(null, ['lives']); out.livesHtml = /pp-life-row/.test(H.lives) || /最近落幕|Recently ended/.test(H.lives);
    M.amb[R.agentId] = { key: 'rich', since: ad, st: 1, lg: [{ d: ad, k: '{s}', p: { s: '存下第一筆積蓄', g: '發大財' } }] };
    out.card = ARCS.card(w, R); out.mbrief = MIND.brief(w, R);
    try { app.state = w.getState(); app._showNpcCard(R.agentId); out.cardHtml = (document.getElementById('npc-quick-card')?.textContent || ''); } catch (e) { out.cardErr = String(e); }
    WALLET.get = gw; w._absDay = sw; w.logMessageT = lm;
    // 真正跑 15 天,看有沒有錯、存檔不爆
    for (let i = 0; i < 96 * 15; i++) { w.paused = false; w.tick(); }
    out.real = { items: BUZZ.S(w).items.length + BUZZ.S(w).hist.length, size: JSON.stringify(w.buzz || {}).length };
    return out;
  });
  const cjk = /[一-鿿]/;
  console.log(`— ${lang} —`);
  if (lang === 'zh') {
    ok(r.skip === 0, '任務和小事不進話題池', r.skip);
    ok(r.brew.ph === 'brew' && r.merged === 1, '大事先醞釀；同一人同一類的後續消息疊在同一個話題', r);
    ok(r.hot.ph === 'hot' && r.hot.log, '熱度夠了就「全鎮都在談」', r.hot);
    ok(r.cap.n === 3 && !r.cap.hasA, '大家同時只關注三件事，新的大事會把舊的擠下去', r.cap);
    ok(r.crowd.aPh === 'after' && r.crowd.log, '被擠下去的話題進入餘波，日誌寫「漸漸沒人提了」', r.crowd);
    ok(r.talk.lines.length === 2 && /你聽說了嗎/.test(r.talk.lines[0]), '村民閒聊會講到正在熱的話題，另一人依個性回應', r.talk);
    ok(!!r.brief, 'AI 對話的提示詞帶上「鎮上最近大家在談」', r.brief);
    ok(r.topics >= 1, '問村民鎮上近況時會講正在熱的話題', r.topics);
    ok(r.buzzHtml, '鎮況有「鎮上在談什麼」區塊', null);
    ok(r.fade.left === 0 && r.fade.hist >= 3, '放著不管會淡出，正熱過的寫進「最近談過」', r.fade);
    ok(r.fizzle.left === 0 && r.fizzle.hist === 0, '醞釀太久沒人理就熄掉，不進紀錄', r.fizzle);
    ok(r.saved && r.reload, '話題存讀檔正常', r);
    ok(r.rich.s1 === 1 && r.rich.s2 === 2 && r.rich.s3 === 0 && r.rich.broke, '發財劇本：存下第一筆→小有身家；積蓄賠光退回原點', r.rich);
    ok(r.heart.changed && r.heart.story === 'heart' && r.heart.mem, '暗戀的人跟別人在一起 → 心碎結局、換個心願', r.heart);
    ok(r.peace.st >= 1 && r.peace.end === 'peace', '記仇的人跟仇人和好 → 放下結局', r.peace);
    ok(r.lost.st === 2 && r.lost.beat && r.lost.still, '想當首長的人落選了，但沒放棄', r.lost);
    ok(r.done.end === 'done' && r.done.recent >= 1, '心願達成會寫進人生故事', r.done);
    ok(r.livesHtml, '鎮況有「人生劇本」區塊', null);
    ok(r.card && r.card.dots === '●○○' && /小有身家/.test(r.card.next) && r.card.past.length >= 1, '村民卡：走到第幾步、下一步、以前的心願', r.card);
    ok(/目前走到第 2 步（共 3 步）/.test(r.mbrief || ''), 'AI 提示詞知道自己走到第幾步', r.mbrief);
    ok(/下一步/.test(r.cardHtml || ''), '村民卡畫面看得到下一步', (r.cardHtml || '').slice(0, 200));
  } else {
    ok(r.card && !cjk.test(r.card.next) && r.card.past.every(s => !cjk.test(s)), 'English: villager-card arc text is translated', r.card);
    ok(/Step 2 of 3/.test(r.mbrief || ''), 'English: AI brief says which step', r.mbrief);
    ok(/📖 Next: /.test(r.cardHtml || '') && !/下一步/.test(r.cardHtml || ''), 'English: villager card shows the next step', (r.cardHtml || '').replace(/\s+/g, ' ').match(/.{0,80}(📖|Goal|心願).{0,160}/g));
  }
  ok(r.real.size < 8000, `真正跑 15 天：話題資料不大（${r.real.size} 字）`, r.real);
  ok(!errs.length, '整段沒有錯誤', errs.slice(0, 5));
  await browser.close();
}
(async () => { await run('zh'); await run('en'); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
