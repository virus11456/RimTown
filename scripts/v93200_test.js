// v9.32.0 心聲卡片與地圖念頭泡泡。不連線、不呼叫真的 AI：AI 的回答由測試自己給（ce._askJson 換成假的），其餘都是真的遊戲程式。
// 看五件事：1. 送去問 AI 的那一刻地圖冒「正在想」 2. 回答回來後變成他說的話／自己拿的主意 3. 提案頁「心聲」分頁的卡片
//          4. 這些顯示不碰世界、不用亂數 5. 手機 390px 與英文
// 用法：node scripts/v93200_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/'; const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'test-results', 'voices');
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 500) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

async function open(browser, lang, vp) {
  const page = await (await browser.newContext({ viewport: vp, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  return { page, errs };
}
// 第一段：建城、AI 關著跑 12 天，再打開 AI（假的），跑到有人被送去問為止。AI 的回答先扣著不給。
const stageA = () => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
  const T = window.__T = { notices: [], prompts: [], release: null };
  const _cn = app._showCornerNotice.bind(app); app._showCornerNotice = (o) => { T.notices.push({ icon: o.icon, title: o.title, name: o.name, desc: o.desc, go: o.go || null, hasOpen: typeof o.open === 'function' }); return _cn(o); };
  let s = 7; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
  for (let i = 0; i < 96 * 12; i++) { w.paused = false; w.tick(); }
  const out = { thoughts0: Object.keys(app.tileMap._thoughts || {}).length, notes0: NOTES.count(w) };
  const ce = w.conversationEngine; const llm = ce.llm; llm.generate = () => Promise.resolve('__ERROR__'); llm._quotaLow = () => false; llm._canMakeRequest = () => true;
  const gate = new Promise(r => { T.release = r; });
  ce._askJson = async (prompt) => {
    if (!/"pick"/.test(String(prompt))) return null; const idx = T.prompts.push(String(prompt)); await gate;
    const blocks = String(prompt).split(/\n?=== \d+\. /).slice(1);
    return blocks.map((b, i) => { const m = b.match(/【可以選】\s*([^＝=\s]+)\s*[＝=]/) || b.match(/\[Options\]\s*([^＝=\s]+)\s*[＝=]/i); const code = m ? m[1].trim() : 'a';
      if (idx === 1 && i === 0) return { n: 1, pick: 'other', do: '在廣場辦一場放風箏比賽', why: '大家最近都悶，想讓孩子們笑一笑', fx: [{ t: 'mood', d: 3 }] };
      return { n: i + 1, pick: code, why: '這件事我自己想清楚了，就這麼辦' }; });
  };
  w.fullAgentMode = true; app._fullAgentOn = () => true; out.aiOn = DECIDE.aiOn(w);
  let guard = 0; while (!T.prompts.length && guard++ < 96 * 3) { w.paused = false; w.tick(); }
  out.asked = T.prompts.length; out.hasNudge = /other/.test(T.prompts[0] || '') && /(異想天開|fanciful)/.test(T.prompts[0] || '');
  const TH = app.tileMap._thoughts || {}; out.thinking = Object.entries(TH).filter(([, v]) => v.kind === 'think').map(([id, v]) => ({ id, text: v.text, name: w.agents[id]?.name }));
  try { app.state = w.getState(); app.tileMap.update?.(app.state); } catch (e) { out.err = String(e); }
  return out;
};
// 第二段：放行 AI 的回答
const stageB = async () => {
  const app = window.rimtownApp; const w = app.world; const T = window.__T; T.release(); for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 30));
  const TH = app.tileMap._thoughts || {}; const out = { prompts: T.prompts.length };
  out.th = Object.entries(TH).map(([id, v]) => ({ id, kind: v.kind, text: v.text, name: v.name }));
  out.notes = NOTES.S(w).list.map(e => ({ who: e.who, t: e.t })); out.stats = NOTES.stats(w); out.feed = NOTES.feed(w, 30); out.feedIdea = NOTES.feed(w, 30, 'idea');
  out.notices = T.notices.filter(n => n.icon === '💡'); out.ideaId = out.feedIdea[0]?.who || null; out.sayId = (out.feed.find(e => e.t === 'pick') || {}).who || null;
  // 顯示不碰世界、不用亂數：同一份世界，呼叫通知與重畫前後比對
  const snap = () => { const d = w.serialize(); delete d.savedAt; return JSON.stringify(d); };
  const keep = Object.assign({}, app.tileMap._thoughts); const keepNext = app.tileMap._thNext;
  const before = snap(); let calls = 0; const _r = Math.random; Math.random = () => { calls++; return _r(); };
  const fx = app.tileMap._floatFx; app.tileMap._floatFx = []; // 浮動特效本來就會用亂數編號，這裡只量念頭泡泡這一段
  try {
    app._onThought({ w, kind: 'think', id: out.sayId, q: '測試：在想一件事' }); app._onThought({ w, kind: 'say', id: out.sayId, name: 'x', what: 'y', text: 'z' });
    app._onThought({ w, kind: 'idea', id: out.ideaId, name: 'x', what: '測試主意', text: '測試理由' }); app._onThought({ w, kind: 'clear', id: out.sayId });
    app.tileMap.followAgent(out.ideaId); app.tileMap._updateOverlays(app.state.agents, out.ideaId); NOTES.feed(w, 30); NOTES.stats(w);
  } catch (e) { out.dispErr = String(e); }
  app.tileMap._floatFx = fx; Math.random = _r; out.rngCalls = calls; out.sameWorld = snap() === before; app.tileMap._thoughts = keep; app.tileMap._thNext = keepNext; app.tileMap.followAgent(null);
  // 別的世界來的通知不理（切換城鎮時）
  const n0 = Object.keys(app.tileMap._thoughts || {}).length; app._onThought({ w: {}, kind: 'say', id: 'nobody', name: 'x', what: 'y', text: 'z' }); out.otherWorld = Object.keys(app.tileMap._thoughts || {}).length === n0;
  out.held = Object.values(keep).filter(v => !v.on && v.kind !== 'think').length; out.asleep = out.ideaId ? w.agents[out.ideaId]?.activity : null; out.time = w.clock?.timeStr;
  try { app.state = w.getState(); app.tileMap.update?.(app.state); app._hideNpcCard?.(); app.activeTab = 'proposals'; app._ppTab = 'voices'; app.renderSidebar(); } catch (e) { out.renderErr = String(e); }
  return out;
};
// 第三段：時間走到早上，大家醒來出門；鏡頭跟著拿主意的人
const stageC = (id) => {
  const app = window.rimtownApp; const w = app.world; let guard = 0; const hour = () => { const m = String(w.clock?.timeStr || '').match(/(\d{1,2}):\d{2}\s*$/); return m ? +m[1] : 0; };
  while (guard++ < 96 && !(w.agents[id] && w.agents[id].activity !== 'sleeping' && hour() >= 8 && hour() < 18)) { w.paused = false; w.tick(); }
  app._hideNpcCard?.(); app.state = w.getState(); app.tileMap.update?.(app.state); app.selectedAgent = id; app.selectedAgentId = id; app.tileMap.followAgent(id);
  return { time: w.clock?.timeStr, act: w.agents[id]?.activity, held: Object.values(app.tileMap._thoughts || {}).filter(v => !v.on).length };
};

(async () => {
  const browser = await chromium.launch(); fs.mkdirSync(SHOTS, { recursive: true });
  const { page, errs } = await open(browser, 'zh', { width: 1280, height: 860 });
  const A = await page.evaluate(stageA);
  ok(A.thoughts0 === 0 && A.notes0 === 0, 'AI 關著跑 12 天：地圖上沒有念頭泡泡，也沒有心聲（照個性推估的不算他說的）', [A.thoughts0, A.notes0]);
  ok(A.aiOn === true && A.asked >= 1, '打開 AI 後有人被送去問', [A.aiOn, A.asked]);
  ok(A.hasNudge, '題目裡有「現成選項都不像他就自己想」這一句', A.hasNudge);
  ok(A.thinking.length >= 1 && A.thinking.every(x => x.text && x.name), '送去問的那一刻，每個人頭上掛著「正在想」和他遇到的事', A.thinking.slice(0, 3));
  await page.waitForTimeout(1200);
  // 半夜大家多半在屋裡睡覺：挑一個畫面上看得到的，鏡頭跟過去
  const seen = await page.evaluate((ids) => { const app = window.rimtownApp; const id = ids.find(i => app.tileMap._agentMeshes[i]?.visible) || null; if (id) { app.selectedAgent = id; app.selectedAgentId = id; app.tileMap.followAgent(id); } return id; }, A.thinking.map(x => x.id));
  await page.waitForTimeout(2500);
  const thinkDom = await page.evaluate(() => [...document.querySelectorAll('.t3d-thought.is-think')].filter(e => e.style.display !== 'none').map(e => e.textContent));
  ok(!!seen && thinkDom.length >= 1 && thinkDom[0].includes('💭'), '地圖上真的畫出「💭 在想什麼」', [seen, thinkDom.slice(0, 3)]);
  await page.screenshot({ path: path.join(SHOTS, 'desktop-thinking.png') });
  const B = await page.evaluate(stageB);
  ok(B.notes.length >= 2 && B.notes.filter(e => e.t === 'idea').length === 1, 'AI 回答後：一筆自己拿的主意，其餘是自己說理由的決定', B.notes);
  ok(B.stats.all === B.notes.length && B.stats.ideas === 1 && B.stats.today === B.notes.length, '心聲的統計對得上（全部、主意、今天）', B.stats);
  ok(B.feed[0] && B.feed.every(e => e.name && e.what && (e.t === 'idea' || e.text)) && B.feedIdea.length === 1 && /放風箏/.test(B.feedIdea[0].what) && /悶/.test(B.feedIdea[0].text), '卡片資料：誰、做了什麼、他說的原句；主意是他寫的那一句', B.feedIdea);
  ok(B.notices.length === 1 && /放風箏/.test(B.notices[0].name) && B.notices[0].go?.agentId === B.ideaId && B.notices[0].hasOpen, '自己拿的主意跳一張角落卡，可以帶鏡頭、可以翻手記', B.notices);
  ok(B.rngCalls === 0 && B.sameWorld === true && !B.dispErr, '念頭通知、泡泡重畫、跟拍、讀卡片：亂數用了 0 次，世界存檔逐字相同', [B.rngCalls, B.sameWorld, B.dispErr]);
  ok(B.otherWorld, '別的世界來的通知不會畫到這張地圖上');
  await page.waitForTimeout(1500);
  const night = await page.evaluate(() => ({ idea: [...document.querySelectorAll('.t3d-thought.is-idea')].filter(e => e.style.display !== 'none').length, think: [...document.querySelectorAll('.t3d-thought.is-think')].filter(e => e.style.display !== 'none').length }));
  ok(night.think === 0, '回答回來後「正在想」收掉了', night);
  ok(B.held >= 2 && (B.asleep !== 'sleeping' || night.idea === 0), '半夜拿的主意先收著，人還在睡就不冒出來', [B.held, B.asleep, night, B.time]);
  // 心聲分頁
  ok(await page.locator('[data-pp-tab="voices"]').count() === 1, '提案頁多一個「心聲」分頁');
  const cards = page.locator('.pv-card'); ok(await cards.count() === B.notes.length, '心聲分頁一筆一張卡', [await cards.count(), B.notes.length]);
  ok(await page.locator('.pv-card.pv-idea').count() === 1 && /放風箏/.test(await page.locator('.pv-card.pv-idea').innerText()), '自己拿的主意的卡片有標出來', await page.locator('.pv-card.pv-idea').count());
  await page.screenshot({ path: path.join(SHOTS, 'desktop-voices.png') });
  await page.locator('[data-pv-only="idea"]').click(); ok(await page.locator('.pv-card').count() === 1, '點「自己拿的主意」只剩那一張');
  await page.locator('[data-pv-only="all"]').click(); ok(await page.locator('.pv-card').count() === B.notes.length, '點「全部」回來');
  await page.locator('.pv-card.pv-idea [data-pv-go]').click(); const fol = await page.evaluate(() => [window.rimtownApp.tileMap._followAgent, window.rimtownApp.selectedAgentId]);
  ok(fol[0] === B.ideaId && fol[1] === B.ideaId, '點卡片上的名字：鏡頭跟到那個人', fol);
  await page.evaluate(() => window.rimtownApp._hideNpcCard?.());
  await page.locator('.pv-card.pv-idea .pv-more').click(); await page.waitForSelector('#notes-book'); ok(/放風箏/.test(await page.locator('#notes-book .nb-body').innerText()), '點「翻開他的手記」：直接翻到那個人'); await page.keyboard.press('Escape');
  // 早上：他醒來出門，收著的話才冒出來；點泡泡看那個人
  const C = await page.evaluate(stageC, B.ideaId); let dom = { idea: [] };
  for (let i = 0; i < 12 && !dom.idea.length; i++) { await page.waitForTimeout(1000); dom = await page.evaluate(() => ({ idea: [...document.querySelectorAll('.t3d-thought.is-idea')].filter(e => e.style.display !== 'none').map(e => e.textContent), say: [...document.querySelectorAll('.t3d-thought.is-say')].filter(e => e.style.display !== 'none').length })); }
  ok(C.act !== 'sleeping' && dom.idea.length === 1 && /💡/.test(dom.idea[0]) && /放風箏/.test(dom.idea[0]), '早上他醒來出門：頭上冒出 💡 和他的主意', [C, dom]);
  await page.screenshot({ path: path.join(SHOTS, 'desktop-bubble.png') });
  // 泡泡跟著人和鏡頭一直在動，所以先確認那個位置點下去真的是泡泡，再用滑鼠點
  const hit = await page.evaluate(() => { const el = [...document.querySelectorAll('.t3d-thought.is-idea')].find(e => e.style.display !== 'none'); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return { x, y, onBubble: !!top && (top === el || el.contains(top)) }; });
  await page.evaluate(() => { const app = window.rimtownApp; app._hideNpcCard?.(); app._lastCard = null; const f = app._showNpcCard.bind(app); app._showNpcCard = (id) => { app._lastCard = id; return f(id); }; });
  if (hit) await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(400);
  const opened = await page.evaluate(() => window.rimtownApp._lastCard);
  ok(!!hit && hit.onBubble && opened === B.ideaId, '點地圖上的泡泡：打開那個人的卡片', [hit, opened, B.ideaId]);
  ok(errs.length === 0, '桌機沒有頁面錯誤', errs.slice(0, 3)); await page.context().close();
  // 手機 390px、英文
  for (const [lang, name] of [['zh', '手機中文'], ['en', '手機英文']]) {
    const m = await open(browser, lang, { width: 390, height: 844 }); const A2 = await m.page.evaluate(stageA); const B2 = await m.page.evaluate(stageB);
    ok(A2.asked >= 1 && B2.notes.length >= 2, `${name}：照樣問得到、收得到`, [A2.asked, B2.notes.length]);
    await m.page.evaluate(() => { const app = window.rimtownApp; try { app._openMobileDrawer?.(); app._setDrawer?.(true); } catch (e) {} app.activeTab = 'proposals'; app._ppTab = 'voices'; app.renderSidebar(); });
    await m.page.waitForTimeout(600);
    const lay = await m.page.evaluate(() => { const tabs = document.querySelector('.pp-tabs'); const wide = document.documentElement.scrollWidth > window.innerWidth + 1; const tr = tabs ? tabs.getBoundingClientRect() : null;
      const small = [...document.querySelectorAll('.pv-chip, .pv-who, .pv-more, .pp-tab')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 36).map(b => b.className + ':' + Math.round(b.getBoundingClientRect().height));
      const over = [...document.querySelectorAll('.pv-card, .pv-chips, .pp-tab')].filter(b => b.offsetParent && b.getBoundingClientRect().right > window.innerWidth + 1).map(b => b.className);
      return { wide, tabsW: tr ? Math.round(tr.width) : -1, tabsScroll: tabs ? tabs.scrollWidth - tabs.clientWidth : -1, small, over, cards: document.querySelectorAll('.pv-card').length, txt: (document.querySelector('.proposals-panel')?.innerText || '').slice(0, 400) }; });
    ok(!lay.wide && lay.over.length === 0, `${name}：沒有橫向捲動，卡片和分頁都在畫面內`, lay);
    ok(lay.small.length === 0, `${name}：按鈕夠大點得到`, lay.small);
    ok(lay.cards === B2.notes.length, `${name}：卡片都在`, [lay.cards, B2.notes.length]);
    if (lang === 'en') ok(/Voices/.test(lay.txt) && /Own ideas/.test(lay.txt) && !/心聲|自己拿的主意|拿定主意|翻開他的手記/.test(lay.txt), '英文模式：介面文字是英文（村民寫的原句照原樣）', lay.txt.slice(0, 200));
    await m.page.screenshot({ path: path.join(SHOTS, `mobile-${lang}.png`) }); ok(m.errs.length === 0, `${name}：沒有頁面錯誤`, m.errs.slice(0, 3)); await m.page.context().close();
  }
  await browser.close(); console.log(`\n${pass} checks passed, ${fail} failed；截圖在 test-results/voices/`); process.exit(fail ? 1 : 0);
})();
