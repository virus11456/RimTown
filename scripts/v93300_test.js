// v9.33.0 個人企劃。不連線、不呼叫真的 AI：AI 的回答用 DECIDE.applyAi 直接餵，其餘都是真的遊戲程式。
// 看：發起 → 找人（答應／推掉／假答應／告密）→ 當天真的走到那裡 → 成敗與後果；存讀檔；介面（桌機、手機 390px 中英）
// 用法：node scripts/v93300_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/'; const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'test-results', 'schemes');
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 600) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function open(browser, lang, vp) {
  const page = await (await browser.newContext({ viewport: vp, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  return { page, errs };
}
const stage = () => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
  const notices = []; const _cn = app._showCornerNotice.bind(app); app._showCornerNotice = (o) => { notices.push({ icon: o.icon, title: o.title, name: o.name, desc: o.desc }); return _cn(o); };
  let s = 7; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
  app._fullAgentOn = () => false; try { app._visitorMailboxTick(); } catch (e) {} w.fullAgentMode = false; // 畫面的通知接口平常每 5 秒接一次；測試一口氣跑完，這裡先接上（它會順手把 AI 開關設回帳號的設定，所以再關一次）
  const out = {}; const tickN = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } };
  const toHour = (h, m = 0) => { let g = 0; while (g++ < 200 && !((w.clock.hour === h) && (w.clock.minute >= m))) tickN(1); };
  const midnight = () => { const d = w._absDay(); let g = 0; while (g++ < 200 && w._absDay() === d) tickN(1); };
  const aff = (a, b) => a.relationships?.relationships?.[b.agentId]?.affinity || 0;
  const setAff = (a, b, v) => { const r = a.relationships.getOrCreate(b.agentId, b.name); r.modifyAffinity(v - (r.affinity || 0)); };
  const money = () => { let n = 0; try { n = WALLET.total ? WALLET.total(w) : 0; } catch (e) {} return n; };
  // 1. AI 關著跑 14 天：照個性也會有人張羅事情，整個流程自己走完
  tickN(96 * 14); const L0 = SCHEME.S(w).list;
  out.rule = { n: L0.length, stages: L0.map(P => P.stage), ai: L0.filter(P => P.ai).length, bad: L0.filter(P => !['recruit', 'set', 'done', 'dropped'].includes(P.stage) || ((P.stage === 'done' || P.stage === 'dropped') && !P.out)).length, tones: [...new Set(L0.map(P => P.tone))], view: SCHEME.view(w, 3).map(v => ({ id: v.id, title: v.title, stage: v.stageName, out: v.out?.text || '' })) };
  SCHEME.S(w).quiet = true; for (const P of SCHEME.S(w).list) if (P.stage === 'recruit' || P.stage === 'set') { P.stage = 'dropped'; P.out = { ok: false, k: '作罷', p: {} }; } // 之後只看排好的幾件
  const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId)); out.adults = A.length;
  const [a1, h1, h2, a2, foe, snitch, a3, crush, a4, cold1, a5, f5, a6, h6] = A;
  const drain = () => DECIDE.drain(w, DECIDE.S(w), w._absDay());
  // 6. 他在別的事上自己拿的主意，變成一件企劃（走決策核心）
  setAff(a5, f5, -40); let K5 = null, ctx5 = null, opts5 = null; for (const K of Object.values(DECIDE.KINDS)) { if (!K.scan) continue; let c = null; try { c = K.when(w, a5); } catch (e) {} if (!c) continue; let o = []; try { o = (K.options(w, a5, c) || []).filter(Boolean); } catch (e) {} if (o.length >= 2) { K5 = K; ctx5 = c; opts5 = o; break; } }
  if (K5) DECIDE.applyAi(w, a5, K5, ctx5, opts5, { pick: 'other', do: `在市集當眾展示新做的木雕，讓${f5.name}看看`, why: '要做就做給他看', fx: [] });
  const P6 = SCHEME.S(w).list.find(P => P.by === a5.agentId && P.from === 'idea'); out.p6 = P6 ? { tone: P6.tone, target: P6.target === f5.agentId, ai: P6.ai, title: P6.title.raw } : { noKind: !K5 };
  // 2. 熱鬧一下：兩個好朋友都答應，當天真的走到廣場
  setAff(h1, a1, 90); setAff(h2, a1, 90); setAff(a1, h1, 80); setAff(a1, h2, 80); const c0 = WALLET.get(w, a1); const tr0 = w.stockpile?.get?.('silver') ?? null;
  const P2 = SCHEME.create(w, a1, { tone: 'fun', title: '在廣場辦一場擲石頭比賽', why: '日子太悶了，想聽大家笑', helpers: [h1, h2], place: 'town_square', cost: 3, ai: true });
  out.p2a = { id: P2?.id, stage: P2?.stage, ask: P2?.ask.map(q => q.s), secret: P2?.secret }; drain(); out.p2b = P2.ask.map(q => q.s);
  // 3. 算計：幫手跟被算計的人更要好，跑去告密
  setAff(a2, foe, -60); setAff(snitch, foe, 95); setAff(snitch, a2, -5); const fa0 = aff(foe, a2), fs0 = aff(foe, snitch);
  const P3 = SCHEME.create(w, a2, { tone: 'spite', title: '在他的貨裡動手腳', why: '這口氣我嚥不下去', target: foe, helpers: [snitch], ai: true }); drain();
  out.p3a = { thanks: aff(foe, snitch) > fs0, /* 告密當下就量：這筆淡淡的好感（+6）過幾天可能被「淡忘」清掉，等事情敗露那天才量會量不到 */ secret: P3.secret, ask: P3.ask.map(q => q.s), warned: P3.warned, foeKnows: foe.memory.entries.slice(-3).some(e => /告訴我|came to tell me/.test(e.content || Memory.render(e.k, e.p || {}))) };
  // 4. 追求：對方不想去
  setAff(crush, a3, -60); const P4 = SCHEME.create(w, a3, { tone: 'court', title: '約他去河邊走走', why: '想跟他多說幾句話', target: crush, ai: true }); drain(); out.p4a = P4.ask.map(q => [q.s, !!q.guest]);
  // 5. 找不到人：想找的人都不理他
  setAff(cold1, a4, -70); const P5 = SCHEME.create(w, a4, { tone: 'bond', title: '找人結伴跑商', why: '一個人不敢走遠', helpers: [cold1], ai: true }); drain(); out.p5a = P5.ask.map(q => q.s);
  // 7. 被問的人用 AI 回答：他自己說的理由收進卡片
  const P7 = SCHEME.create(w, a6, { tone: 'fun', title: '請大家喝一杯', why: '好久沒聚了', helpers: [h6], place: 'tavern', ai: true });
  { const K = DECIDE.KINDS.schemeAsk; const ctx = { sid: P7.id }; const o = K.options(w, h6, ctx); out.p7opts = o.map(x => x.id); DECIDE.applyAi(w, h6, K, ctx, o, { pick: 'join', why: '他難得開口，我去捧個場' }); }
  out.p7 = { s: P7.ask[0].s, y: P7.ask[0].y?.raw || '', inNotes: NOTES.S(w).list.some(e => e.who === h6.agentId && /捧個場/.test(String(e.y?.raw))) };
  out.noticesNew = notices.filter(n => /P\d{3}/.test(n.title || '')).length;
  out.dbg = { hook: typeof w.onScheme, all: notices.length, titles: notices.slice(-4).map(n => String(n.title).slice(0, 40)), same: app.world === w };
  // 半夜：說定或作罷
  midnight(); tickN(1);
  out.p2c = { stage: P2.stage, when: P2.when === w._absDay(), going: (P2.going || []).length, paid: P2.cost, go: [a1, h1, h2].map(x => x._thingGo?.id === P2.id) };
  out.p4b = { stage: P4.stage, ok: P4.out?.ok, text: SCHEME.view(w, 40).find(v => v.id === P4.id)?.out?.text };
  out.p5b = { stage: P5.stage, text: SCHEME.view(w, 40).find(v => v.id === P5.id)?.out?.text };
  out.p3b = { stage: P3.stage };
  // 當天 16 點：人真的往廣場去
  toHour(16, 15); out.p2d = { at: [a1, h1, h2].map(x => x._thingAt || null), started: !!P2.started };
  try { app.state = w.getState(); app.tileMap.update?.(app.state); app.selectedAgent = a1.agentId; app.tileMap.followAgent(a1.agentId); } catch (e) {}
  out.ids = { a1: a1.agentId, P2: P2.id, P3: P3.id }; window.__S = { w, P2, P3, a1, a2, foe, snitch, fa0, toHour, midnight, tickN, aff, notices }; return out;
};
const stage2 = () => {
  const { w, P2, P3, a1, a2, foe, snitch, fa0, toHour, midnight, tickN, aff, notices } = window.__S; const app = window.rimtownApp; const out = {};
  toHour(17, 0); out.p2 = { stage: P2.stage, ok: P2.out?.ok, came: P2.came.length, text: SCHEME.view(w, 40).find(v => v.id === P2.id)?.out?.text, mem: a1.memory.entries.slice(-4).some(e => /辦成了|沒成|worked|failed/.test(e.content || Memory.render(e.k, e.p || {}))), cleared: !a1._thingGo || a1._thingGo.id === P2.id };
  toHour(21, 0); const v3 = SCHEME.view(w, 40).find(v => v.id === P3.id);
  out.p3 = { stage: P3.stage, ok: P3.out?.ok, text: v3?.out?.text, foeDown: aff(foe, a2) < fa0, ask: v3?.ask.map(q => q.label) };
  out.notices = notices.filter(n => /P\d{3}/.test(n.title || '')).length;
  // 存讀檔
  const save = JSON.parse(JSON.stringify(w.serialize())); out.saveN = save.schemes?.list?.length || 0; const n = SCHEME.S(w).list.length; w.reset(); out.afterReset = (w.schemes?.list || []).length; w.loadSave(save); out.afterLoad = SCHEME.S(w).list.length === n;
  out.note = NOTES.entriesOf(w, a1.agentId).filter(e => e.t === 'plan').map(e => e.title);
  try { app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'proposals'; app._ppTab = 'plans'; app.renderSidebar(); } catch (e) { out.renderErr = String(e); } // 手機上面板是浮動卡片，要先打開
  out.cards = SCHEME.view(w, 20).length; return out;
};
(async () => {
  const browser = await chromium.launch(); fs.mkdirSync(SHOTS, { recursive: true });
  const { page, errs } = await open(browser, 'zh', { width: 1280, height: 860 });
  const R = await page.evaluate(stage);
  ok(R.rule.n >= 2 && R.rule.bad === 0 && R.rule.ai === 0, 'AI 關著跑 14 天：照個性也有人張羅事情，每一件的狀態都合法，辦完或作罷的都有結果', R.rule);
  ok(R.rule.stages.some(s => s === 'done'), '其中有走完全程的', R.rule.stages);
  ok(R.p2a.stage === 'recruit' && R.p2a.ask.every(s => s === 'asked') && /^P\d{3}$/.test(R.p2a.id), '發起一件事：有 P 編號，先去找人', R.p2a);
  ok(R.p2b.every(s => s === 'yes'), '兩個好朋友都答應', R.p2b);
  ok(R.p3a.secret && R.p3a.ask[0] === 'told' && R.p3a.warned && R.p3a.foeKnows && R.p3a.thanks, '算計人：被找的幫手跟對方更要好，推掉並去告密，對方記下了、對告密的人多了好感', R.p3a);
  ok(R.p4a[0][0] === 'no' && R.p4a[0][1] === true, '追求：對方不想去，婉拒', R.p4a);
  ok(R.p5a[0] === 'no' || R.p5a[0] === 'fake', '想找的人不理他', R.p5a);
  ok(R.p6 && R.p6.tone === 'show' && R.p6.target && R.p6.ai, '他在別的事上自己拿的主意變成一件企劃：看得出是出風頭、衝著誰', R.p6);
  ok(R.p7opts.includes('join') && R.p7opts.includes('no') && R.p7opts.includes('fake') && R.p7.s === 'yes' && /捧個場/.test(R.p7.y) && R.p7.inNotes, '被問的人用 AI 回答：答應了，他說的原句收進企劃卡片，也進了手記', [R.p7opts, R.p7]);
  ok(R.noticesNew >= 5, '每件新企劃跳一張角落通知', [R.noticesNew, R.dbg]);
  ok(R.p2c.stage === 'set' && R.p2c.when && R.p2c.paid === 3 && R.p2c.go[0] === true, '隔天半夜說定：付了自己的錢，排好今天去', R.p2c);
  ok(R.p4b.stage === 'done' && R.p4b.ok === false && !!R.p4b.text, '追求被婉拒：當場有結果', R.p4b);
  ok(R.p5b.stage === 'dropped' || R.p5b.stage === 'set', '找不到人就作罷（假答應的話他以為有人）', R.p5b);
  ok(R.p2d.at[0] === 'town_square' && R.p2d.started, '到了時間：發起人真的往廣場去', R.p2d);
  await page.waitForTimeout(2500); await page.screenshot({ path: path.join(SHOTS, 'desktop-event.png') });
  const B = await page.evaluate(stage2);
  ok(B.p2.stage === 'done' && typeof B.p2.ok === 'boolean' && !!B.p2.text && B.p2.came >= 1 && B.p2.mem, '辦完：有成敗、記下誰到場，發起人記得這件事', B.p2);
  ok(B.p3.stage === 'done' && B.p3.ok === false && /防備|ready for it/.test(B.p3.text) && B.p3.foeDown, '走漏風聲的算計：敗露，對方更討厭他', B.p3);
  ok(B.notices > R.noticesNew, '開始與結果也有通知', [R.noticesNew, B.notices]);
  ok(B.saveN >= 6 && B.afterReset === 0 && B.afterLoad, '存檔帶著企劃；開新鎮會清掉；讀檔讀得回來', [B.saveN, B.afterReset, B.afterLoad]);
  ok(B.note.length >= 1 && /P\d{3}/.test(B.note[0]), '手記裡有他發起的企劃', B.note);
  ok(await page.locator('[data-bd-only="plans"]').count() === 1 && await page.locator('.sk-card').count() === B.cards, '「往來」分頁裡有企劃的篩選鈕（v10.1.0 起企劃併進往來），一件一張卡', [await page.locator('.sk-card').count(), B.cards]);
  const tabs = await page.evaluate(() => { const bar = document.querySelector('.proposals-panel .pp-tabs'); const rw = (b) => { const r = document.createRange(); r.selectNodeContents(b); return r.getBoundingClientRect().width; };
    return { cut: [...bar.querySelectorAll('.pp-tab')].filter(b => rw(b) > b.clientWidth + 1 || b.getBoundingClientRect().right > bar.getBoundingClientRect().right + 1).map(b => b.textContent.trim() + ':' + Math.round(rw(b)) + '/' + b.clientWidth), n: bar.querySelectorAll('.pp-tab').length }; });
  ok((tabs.n === 5 || tabs.n === 6) && tabs.cut.length === 0, '桌機：子分頁都放得下，字沒有被切掉（鎮上有店時多一個「市場」，v11.0.0）', tabs);
  const txt = await page.locator('.proposals-panel').innerText();
  ok(/擲石頭比賽/.test(txt) && /只有你看得到/.test(txt) && /走漏風聲了/.test(txt) && /到場/.test(txt), '卡片上看得到：事情、暗著來的標記、走漏風聲、誰到場', txt.slice(0, 200));
  await page.screenshot({ path: path.join(SHOTS, 'desktop-plans.png') });
  await page.evaluate(() => { document.getElementById('season-recap')?.remove(); window.rimtownApp._hideNpcCard?.(); });
  await page.locator('.sk-card [data-pv-go]:not([disabled])').first().click(); ok(!!(await page.evaluate(() => window.rimtownApp.tileMap._followAgent)), '點卡片上的名字：鏡頭跟過去');
  ok(errs.length === 0, '桌機沒有頁面錯誤', errs.slice(0, 3)); await page.context().close();
  for (const [lang, name] of [['zh', '手機中文'], ['en', '手機英文']]) {
    const m = await open(browser, lang, { width: 390, height: 844 }); await m.page.evaluate(stage); const B2 = await m.page.evaluate(stage2); await m.page.waitForTimeout(500);
    const lay = await m.page.evaluate(() => { const wide = document.documentElement.scrollWidth > window.innerWidth + 1;
      const small = [...document.querySelectorAll('.sk-card .pv-who, .pp-tab')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 36).map(b => b.className + ':' + Math.round(b.getBoundingClientRect().height));
      const over = [...document.querySelectorAll('.sk-card, .pp-tab')].filter(b => b.offsetParent && (b.getBoundingClientRect().right > window.innerWidth + 1 || b.getBoundingClientRect().left < -1)).map(b => b.className + ':' + Math.round(b.getBoundingClientRect().right));
      const shown = [...document.querySelectorAll('.sk-card')].filter(b => b.offsetParent).length; const bar = document.querySelector('.proposals-panel .pp-tabs'); const rw = (b) => { const r = document.createRange(); r.selectNodeContents(b); return r.getBoundingClientRect().width; }; const cut = bar ? [...bar.querySelectorAll('.pp-tab')].filter(b => rw(b) > b.clientWidth + 1).map(b => b.textContent.trim()) : ['no bar'];
      return { wide, small, over, shown, cut, cards: document.querySelectorAll('.sk-card').length, txt: (document.querySelector('.proposals-panel')?.innerText || '').slice(0, 500) }; });
    ok(!lay.wide && lay.over.length === 0, `${name}：五個子分頁和卡片都在畫面內，沒有橫向捲動`, lay);
    ok(lay.small.length === 0, `${name}：按鈕夠大點得到`, lay.small);
    ok(lay.cards === B2.cards && lay.cards >= 6 && lay.shown === lay.cards && lay.cut.length === 0, `${name}：面板真的打開了，卡片都看得到，子分頁沒被切掉`, [lay.cards, B2.cards, lay.shown, lay.cut]);
    if (lang === 'en') ok(/Schemes/.test(lay.txt) && !/企劃|找人中|辦完了|作罷|答應|推掉|熱鬧一下|算計|只有你看得到/.test(lay.txt), '英文模式：介面與樣板文字是英文（測試裡假裝 AI 寫的中文句子照原樣）', lay.txt.slice(0, 300));
    await m.page.screenshot({ path: path.join(SHOTS, `mobile-${lang}.png`) }); ok(m.errs.length === 0, `${name}：沒有頁面錯誤`, m.errs.slice(0, 3)); await m.page.context().close();
  }
  await browser.close(); console.log(`\n${pass} checks passed, ${fail} failed；截圖在 test-results/schemes/`); process.exit(fail ? 1 : 0);
})();
