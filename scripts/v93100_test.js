// v9.31.0 鎮民手記：把村民自己想出來的東西收成一本書。不連線、不呼叫 AI。
// AI 的回答用 DECIDE.applyAi 直接餵進去模擬（等於 AI 回了這一句），其餘都是真的遊戲程式。
// 用法：node scripts/v93100_test.js     需要本機 8126 服務 chrome-extension/
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/'; const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'test-results', 'notes');
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 400) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

async function open(browser, lang, vp) {
  const page = await (await browser.newContext({ viewport: vp, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  return { page, errs };
}
// 建一座城、跑幾天（AI 關），再模擬三個人各自的 AI 回答
const stage = () => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {}; app._showCornerNotice = () => {};
  let s = 7; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
  for (let i = 0; i < 96 * 12; i++) { w.paused = false; w.tick(); }
  const out = { ruleOnly: NOTES.count(w), saveHasNotes0: 'notes' in w.serialize() };
  const all = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
  const pairs = []; for (const a of all) { for (const K of Object.values(DECIDE.KINDS)) { if (!K.scan) continue; let ctx = null; try { ctx = K.when(w, a); } catch (e) {} if (!ctx) continue; let opts = []; try { opts = (K.options(w, a, ctx) || []).filter(Boolean); } catch (e) {} if (opts.length >= 2) { pairs.push({ a, K, ctx, opts }); break; } } if (pairs.length >= 3) break; }
  out.found = pairs.length; if (pairs.length < 3) return out;
  const [p1, p2, p3] = pairs; const mem0 = all.reduce((n, a) => n + a.memory.entries.length, 0);
  DECIDE.applyAi(w, p1.a, p1.K, p1.ctx, p1.opts, { pick: 'z', do: '在廣場辦一場放風箏比賽', why: '大家最近都悶，想讓孩子們笑一笑', fx: [] });           // 自己拿的主意
  DECIDE.applyAi(w, p2.a, p2.K, p2.ctx, p2.opts, { pick: 'a', why: '上次他幫過我，這次我不能裝沒看見' });                                     // 選現成選項，但理由是自己寫的
  DECIDE.applyAi(w, p3.a, p3.K, p3.ctx, p3.opts, { pick: 'a' });                                                                              // 沒寫理由：用的是選項內建的句子，不該收
  out.ids = [p1.a.agentId, p2.a.agentId, p3.a.agentId]; out.names = [p1.a.name, p2.a.name, p3.a.name];
  out.count = NOTES.count(w); out.list = NOTES.S(w).list.map(e => ({ who: e.who, t: e.t })); out.e1 = NOTES.entriesOf(w, p1.a.agentId).filter(e => e.t === 'idea'); out.e2 = NOTES.entriesOf(w, p2.a.agentId).filter(e => e.t === 'pick'); out.e3 = NOTES.entriesOf(w, p3.a.agentId).filter(e => e.t === 'pick' || e.t === 'idea');
  out.people = NOTES.people(w).slice(0, 6).map(p => [p.id, p.n, p.own]); out.latest = NOTES.latest(w, 1)[0] || null;
  // 存檔再讀回來
  const save = JSON.parse(JSON.stringify(w.serialize())); out.saveHasNotes = Array.isArray(save.notes?.list) && save.notes.list.length === out.count; out.noteBytes = JSON.stringify(save.notes || {}).length;
  w.reset(); out.afterReset = NOTES.count(w); w.loadSave(save); out.afterLoad = NOTES.count(w);
  // 上限：同一個人塞 40 筆，只留 24 筆，而且自己拿的主意留著
  for (let i = 0; i < 40; i++) NOTES.add(w, { who: out.ids[0], nm: out.names[0], t: 'pick', q: '', x: { raw: '選了 ' + i }, y: { raw: '理由 ' + i }, r: null });
  const mine = NOTES.S(w).list.filter(e => e.who === out.ids[0]); out.cap = mine.length; out.ideaKept = mine.some(e => e.t === 'idea');
  try { app.state = w.getState(); app.activeTab = 'proposals'; app._ppTab = 'props'; app.renderSidebar(); } catch (e) { out.renderErr = String(e); }
  return out;
};

(async () => {
  const browser = await chromium.launch(); fs.mkdirSync(SHOTS, { recursive: true });
  const { page, errs } = await open(browser, 'zh', { width: 1280, height: 860 });
  const R = await page.evaluate(stage);
  ok(R.ruleOnly === 0 && R.saveHasNotes0 === false, 'AI 關著跑 12 天：手記是空的，存檔裡也沒有多出東西（照個性推估的固定句子不算他寫的）', [R.ruleOnly, R.saveHasNotes0]);
  ok(R.found === 3, '找得到三個正遇到選擇的村民', R.found);
  ok(R.count === 2, '三個 AI 回答只收兩筆：自己拿的主意、自己寫理由的決定；沒寫理由的那筆不收', R.list);
  ok(R.e1.length === 1 && R.e1[0].title.includes('放風箏') && R.e1[0].text.includes('悶') && R.e1[0].own === true, '自己拿的主意：內容、理由都是他寫的原句', R.e1);
  ok(R.e2.length === 1 && R.e2[0].text.includes('幫過我') && !!R.e2[0].title, '自己寫理由的決定：記下他選了什麼和他說的話', R.e2);
  ok(R.e3.length === 0, '沒寫理由的那個人：手記裡沒有被塞進程式內建的句子', R.e3);
  ok(R.latest && R.latest.who === R.ids[0], '面板入口顯示最近一則自己拿的主意', R.latest);
  ok(R.saveHasNotes && R.afterReset === 0 && R.afterLoad === 2, '存檔帶著手記；開新鎮會清掉；讀檔讀得回來', [R.saveHasNotes, R.afterReset, R.afterLoad]);
  ok(R.cap === 24 && R.ideaKept, '同一個人最多留 24 筆，自己拿的主意優先留著', [R.cap, R.ideaKept]);
  ok(R.noteBytes < 2000, '兩筆手記佔存檔不到 2KB', R.noteBytes);
  // 介面：桌機
  ok(await page.locator('[data-action="notes-open"]').count() >= 1, '提案頁最上面有鎮民手記的入口');
  await page.locator('.notes-open').first().click(); await page.waitForSelector('#notes-book .nb-entry');
  ok((await page.locator('#notes-book .nb-person').count()) >= 3, '書裡左邊列出有東西可看的人');
  ok(/放風箏/.test(await page.locator('#notes-book .nb-body').innerText()), '寫得最多的人排第一個，翻開就看得到他的主意');
  ok(await page.locator('#notes-book .nb-own').count() >= 1, '有標示「他自己寫的」');
  await page.locator('#notes-book .nb-chip', { hasText: '自己拿的主意' }).click(); ok(await page.locator('#notes-book .nb-entry').count() === 1 && await page.locator('#notes-book .nb-entry.nb-idea').count() === 1, '點種類可以只看那一種');
  await page.screenshot({ path: path.join(SHOTS, 'desktop-book.png') });
  await page.locator('#notes-book .nb-person').nth(1).click(); ok(/幫過我/.test(await page.locator('#notes-book .nb-body').innerText()), '換一個人，看到的是他說的話');
  await page.locator('#notes-book [data-nb="go"]').click(); const followed = await page.evaluate(() => window.rimtownApp.selectedAgentId); ok(followed === R.ids[1] && await page.locator('#notes-book').count() === 0, '點「去看他」：書關掉，鏡頭跟到那個人', followed);
  await page.locator('.notes-latest').first().click(); await page.waitForSelector('#notes-book'); ok(/放風箏/.test(await page.locator('#notes-book .nb-body').innerText()), '點入口那一則主意，直接翻到那個人');
  await page.keyboard.press('Escape'); ok(await page.locator('#notes-book').count() === 0, '按 Esc 關書');
  ok(errs.length === 0, '桌機沒有頁面錯誤', errs.slice(0, 3)); await page.context().close();
  // 介面：手機 390px、英文
  for (const [lang, name] of [['zh', '手機中文'], ['en', '手機英文']]) {
    const m = await open(browser, lang, { width: 390, height: 844 }); await m.page.evaluate(stage);
    await m.page.evaluate(() => NOTES.openBook(window.rimtownApp)); await m.page.waitForSelector('#notes-book .nb-entry');
    const box = await m.page.locator('#notes-book .nb-page').boundingBox(); const wide = await m.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(box.width <= 390 && !wide, `${name}：書佔滿畫面，沒有橫向捲動`, [box.width, wide]);
    ok(await m.page.locator('#notes-book .nb-select').isVisible() && !(await m.page.locator('#notes-book .nb-plist').isVisible()), `${name}：人名清單改成下拉選單`);
    const small = await m.page.evaluate(() => [...document.querySelectorAll('#notes-book button, #notes-book select')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 36).map(b => b.className));
    ok(small.length === 0, `${name}：按鈕夠大點得到`, small);
    if (lang === 'en') { const txt = await m.page.locator('#notes-book').innerText(); ok(/Townsfolk's Notebook/.test(txt) && /Own ideas/.test(txt) && !/鎮民手記|自己拿的主意|他自己寫的/.test(txt), '英文模式：介面文字是英文（村民寫的原句照原樣）', txt.slice(0, 160)); }
    await m.page.screenshot({ path: path.join(SHOTS, `mobile-${lang}.png`) }); ok(m.errs.length === 0, `${name}：沒有頁面錯誤`, m.errs.slice(0, 3)); await m.page.context().close();
  }
  await browser.close(); console.log(`\n${pass} checks passed, ${fail} failed；截圖在 test-results/notes/`); process.exit(fail ? 1 : 0);
})();
