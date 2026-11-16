// v9.30.1 首頁精簡
// 1) 順序:首屏 → 三句介紹 → 從一個人到整個世界 → 一件事怎麼牽動整個鎮 → 一個決定 → 75 種事 → AI → 常見問題
// 2) 七章細節平常收著:頁面長度與字數有上限(以後加內容變長會被抓到)
// 3) 七個尺度的卡片:一句話、主題標籤(共 20 個)、「看這一章的細節」
// 4) 面板:點標籤打開那一章並展開那個主題;底下的頁面不會被捲走;章節列可以換章;Tab 留在面板裡;Esc、叉叉、點旁邊都能關;焦點回到原本按的地方
// 5) 舊連結(#lp-ch-living、#lp-casino)直接打開面板
// 6) 75 種事:十個分頁,一次只看一類,左右鍵換類
// 7) 手機:面板從下面上來、不會橫向捲動、按得到的東西至少 40px 高;偏好減少動態時不播動畫;英文版面板裡沒有中文
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
async function open(browser, o = {}) {
  const ctx = await browser.newContext(o.mobile ? { ...devices['iPhone 13'], serviceWorkers: 'block', reducedMotion: o.reduce ? 'reduce' : 'no-preference' } : { viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: o.reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logged_in: false }) }));
  await page.addInitScript((lang) => { localStorage.setItem('rimtown-lang', lang); }, o.lang || 'zh');
  await page.goto(BASE + (o.hash || ''), { waitUntil: 'load' }); await page.waitForSelector('#landing-core', { timeout: 60000 }); await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const sheet = (page) => page.evaluate(() => { const L = document.getElementById('landing'), sh = document.getElementById('lp-sheet'), P = sh.querySelector('.lp-sheet-panel'); const r = P.getBoundingClientRect();
  return { open: !sh.hidden, lock: L.classList.contains('lp-lock'), st: Math.round(L.scrollTop), vis: [...sh.querySelectorAll('.lp-chapter')].filter(c => c.getBoundingClientRect().height > 0).map(c => c.id.slice(6)),
    on: sh.querySelector('.lp-chnav a.on')?.dataset.lpSheet || null, cur: sh.querySelectorAll('.lp-chnav a[aria-current="true"]').length, det: [...sh.querySelectorAll('.lp-chapter.on details[open]')].map(d => d.id.slice(3)),
    inPanel: P.contains(document.activeElement), modal: P.getAttribute('aria-modal') === 'true' && P.getAttribute('role') === 'dialog' && !!P.getAttribute('aria-label'), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vw: innerWidth, vh: innerHeight,
    hs: document.documentElement.scrollWidth > innerWidth + 1 || P.scrollWidth > P.clientWidth + 1 }; });
(async () => {
  const browser = await chromium.launch({ args: GL });
  // ── 電腦版、中文 ──
  { console.log('電腦版（中文）'); const { ctx, page, errs } = await open(browser);
    const a = await page.evaluate(() => { const q = (s) => [...document.querySelectorAll(s)]; const L = document.getElementById('landing'); const c = document.querySelector('.lp').cloneNode(true); c.querySelector('#landing-updates')?.remove();
      const order = q('#landing-core, #landing-scale, #landing-chain, #landing-decide, #landing-kinds, #landing-ai, #landing-faq, #landing-roadmap').map(e => e.id.slice(8));
      const vis = (document.querySelector('.lp').innerText || '').replace(/\s+/g, '').length;
      return { order: order.join('>'), h: document.querySelector('#lp-top').scrollHeight, vh: innerHeight, vis, sheetHidden: document.getElementById('lp-sheet').hidden, chVisible: q('.lp-chapter').filter(e => e.offsetHeight > 0).length, chs: q('.lp-chapter').length, topics: q('.lp-topic').length,
        cards: q('.lp-scale-card').map(e => ({ p: (e.querySelector('p')?.textContent || '').length, chips: e.querySelectorAll('.lp-scale-chip').length, more: e.querySelectorAll('.lp-scale-more').length })),
        chipTopics: q('.lp-scale-chip').map(e => e.dataset.lpTopic), topicIds: q('.lp-topic').map(e => e.id.slice(3)), jump: q('[data-lp-jump]').filter(e => { const id = e.dataset.lpJump; const tg = id === 'lp-top' ? document.querySelector('.lp') : document.getElementById(id); return !tg || tg.offsetHeight === 0 || /^lp-ch-/.test(id); }).map(e => e.dataset.lpJump), picks: q('.lp-picks, .lp-pick').length }; });
    ok(a.order === 'core>scale>chain>decide>kinds>ai>faq>roadmap', '順序：三句介紹 → 從一個人到整個世界 → 牽動整個鎮 → 一個決定 → 75 種事 → AI → 常見問題 → 路線圖', a.order);
    ok(a.sheetHidden && a.chVisible === 0 && a.chs === 7 && a.topics === 20, '七章 20 個主題都還在頁面裡，平常收著不佔版面', { hidden: a.sheetHidden, vis: a.chVisible, chs: a.chs, topics: a.topics });
    ok(a.h < 15200 && a.h / a.vh < 17, '電腦版整頁不超過 17 個畫面高（精簡前 24.1 個）', { h: a.h, screens: +(a.h / a.vh).toFixed(1) });
    ok(a.vis < 3300, '看得到的中文字數不超過 3,300（精簡前約 7,100）', a.vis);
    ok(a.cards.length === 7 && a.cards.every(c => c.p >= 12 && c.p <= 60 && c.chips >= 2 && c.more === 1), '七張尺度卡片：各一句話（60 字以內）、至少兩個主題標籤、一個「看這一章的細節」', a.cards);
    ok(a.chipTopics.length === 20 && new Set(a.chipTopics).size === 20 && a.chipTopics.every(t => a.topicIds.includes(t)), '主題標籤一共 20 個，每個都對得到面板裡的主題', a.chipTopics);
    ok(a.jump.length === 0 && a.picks === 0, '剩下的頁內跳轉（上方導覽）都指到看得到的段落，沒有指到收起來的章節；「同一筆閒錢三種選擇」那一段已拿掉', { jump: a.jump, picks: a.picks });
    // 點主題標籤 → 面板
    await page.evaluate(() => { const L = document.getElementById('landing'); L.scrollTop = document.getElementById('landing-scale').offsetTop + 900; }); await page.waitForTimeout(500);
    const st0 = await page.evaluate(() => Math.round(document.getElementById('landing').scrollTop));
    await page.evaluate(() => { const c = document.querySelector('.lp-scale-chip[data-lp-topic="casino"]'); c.focus({ preventScroll: true }); c.click(); }); await page.waitForTimeout(450);
    const s1 = await sheet(page);
    ok(s1.open && s1.lock && s1.vis.join() === 'living' && s1.on === 'living' && s1.cur === 1 && s1.det.includes('casino'), '點「賭場」標籤：面板打開在「討生活」那一章，「賭場」那一項已展開', s1);
    ok(s1.modal && s1.inPanel, '面板有對話框的標示（讀屏軟體認得），焦點移進面板', { modal: s1.modal, inPanel: s1.inPanel });
    ok(s1.box[2] <= 800 && s1.box[0] + s1.box[2] >= s1.vw - 1 && s1.box[1] === 0 && s1.box[3] === s1.vh, '電腦版面板靠右、整個畫面高，寬度不超過 800', s1.box);
    await page.mouse.move(300, 450); await page.mouse.wheel(0, 900); await page.waitForTimeout(300);
    const s2 = await sheet(page); ok(s2.st === st0, '面板開著時，底下的頁面不會被滾輪捲走', { before: st0, after: s2.st });
    // 章節列換章
    await page.click('.lp-sheet .lp-chnav a[data-lp-sheet="world"]'); await page.waitForTimeout(250);
    const s3 = await sheet(page); ok(s3.open && s3.vis.join() === 'world' && s3.on === 'world' && s3.cur === 1 && s3.st === st0, '面板上面的章節列可以換章（一次只顯示一章）', s3);
    // Tab 留在面板裡
    let out = 0; for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => document.querySelector('.lp-sheet-panel').contains(document.activeElement)))) out++; }
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); if (!(await page.evaluate(() => document.querySelector('.lp-sheet-panel').contains(document.activeElement)))) out++; }
    ok(out === 0, '按 Tab／Shift+Tab 46 次，焦點都留在面板裡', out);
    // Esc 關、焦點回去
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    const s4 = await sheet(page); const back = await page.evaluate(() => document.activeElement?.dataset?.lpTopic || document.activeElement?.className);
    ok(!s4.open && !s4.lock && s4.st === st0 && back === 'casino', '按 Esc 關掉：頁面留在原本的位置，焦點回到剛才按的「賭場」標籤', { s4, back });
    // 叉叉、點旁邊
    await page.evaluate(() => document.querySelector('.lp-scale-more[data-lp-sheet="era"]').click()); await page.waitForTimeout(350);
    const s5 = await sheet(page); await page.click('.lp-sheet-x'); await page.waitForTimeout(250); const s6 = await sheet(page);
    ok(s5.open && s5.vis.join() === 'era' && s5.det.length === 0 && !s6.open, '「看這一章的細節」打開整章（不預先展開任何一項）；按叉叉關掉', { s5: s5.vis, det: s5.det, closed: !s6.open });
    await page.evaluate(() => document.querySelector('#landing-chain .lp-chain-tag').click()); await page.waitForTimeout(350);
    const s7 = await sheet(page); const want = await page.evaluate(() => document.querySelector('#landing-chain .lp-chain-tag').dataset.lpSheet);
    await page.mouse.click(120, 450); await page.waitForTimeout(250); const s8 = await sheet(page);
    ok(s7.open && s7.vis.join() === want && !s8.open && !s8.lock, '「牽動整個鎮」每一步的標籤也開同一個面板；點面板旁邊的暗處關掉', { opened: s7.vis, want, closed: !s8.open });
    // 75 種事
    const k0 = await page.evaluate(() => { const q = (s) => [...document.querySelectorAll(s)]; const tabs = q('.lp-kindtab'); return { tabs: tabs.length, sel: tabs.filter(b => b.getAttribute('aria-selected') === 'true').length, focusable: tabs.filter(b => b.tabIndex === 0).length, vis: q('#landing-kinds .lp-kind').filter(e => e.offsetHeight > 0).map(e => e.id), tags: q('.lp-kind-tags li').length, role: document.querySelector('.lp-kindtabs').getAttribute('role'), labelled: q('#landing-kinds .lp-kind').every(e => e.getAttribute('role') === 'tabpanel' && document.getElementById(e.getAttribute('aria-labelledby'))) }; });
    ok(k0.tabs === 14 && k0.sel === 1 && k0.focusable === 1 && k0.vis.length === 1 && k0.tags === 117 && k0.role === 'tablist' && k0.labelled, '106 種事：十三個分頁（v11.0.0 加店家、報社與官員、民怨與人命）、一次只顯示一類，106 個標籤都在', k0);
    await page.evaluate(() => document.getElementById('landing-kinds').scrollIntoView({ block: 'center' })); await page.waitForTimeout(400);
    await page.click('#lp-kt-4'); await page.waitForTimeout(150);
    const k1 = await page.evaluate(() => ({ vis: [...document.querySelectorAll('#landing-kinds .lp-kind')].filter(e => e.offsetHeight > 0).map(e => e.id).join(), sel: document.querySelector('.lp-kindtab[aria-selected="true"]')?.id, n: document.querySelectorAll('#lp-kp-4 .lp-kind-tags li').length }));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); const k2 = await page.evaluate(() => ({ vis: [...document.querySelectorAll('#landing-kinds .lp-kind')].filter(e => e.offsetHeight > 0).map(e => e.id).join(), foc: document.activeElement.id }));
    await page.focus('#lp-kt-0'); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(120); const k3 = await page.evaluate(() => ({ vis: [...document.querySelectorAll('#landing-kinds .lp-kind')].filter(e => e.offsetHeight > 0).map(e => e.id).join(), foc: document.activeElement.id }));
    ok(k1.vis === 'lp-kp-4' && k1.sel === 'lp-kt-4' && k1.n > 0 && k2.vis === 'lp-kp-5' && k2.foc === 'lp-kt-5' && k3.vis === 'lp-kp-13' && k3.foc === 'lp-kt-13', '點分頁換類；左右鍵換到隔壁一類，第一類往左會繞到最後一類', { k1, k2, k3 });
    ok(errs.length === 0, '電腦版沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close(); }
  // ── 舊連結 ──
  { console.log('舊連結'); const A = await open(browser, { hash: '#lp-ch-living' }); const s = await sheet(A.page); ok(s.open && s.vis.join() === 'living' && A.errs.length === 0, '舊連結 #lp-ch-living：一進來就打開「討生活」那一章', { s, errs: A.errs.slice(0, 2) }); await A.ctx.close();
    const B = await open(browser, { hash: '#lp-myth' }); await B.page.waitForTimeout(300); const t = await sheet(B.page); ok(t.open && t.vis.length === 1 && t.det.includes('myth') && B.errs.length === 0, '舊連結 #lp-myth：打開它所在的那一章並展開「神話基因」', { t, errs: B.errs.slice(0, 2) }); await B.ctx.close();
    const C = await open(browser, { hash: '#landing-faq' }); const u = await sheet(C.page); ok(!u.open, '其他連結（#landing-faq）不會誤開面板', u); await C.ctx.close(); }
  // ── 手機 ──
  for (const lang of ['zh', 'en']) { console.log('手機（' + lang + '）'); const { ctx, page, errs } = await open(browser, { mobile: true, lang });
    const m = await page.evaluate(() => { const q = (s) => [...document.querySelectorAll(s)]; const hh = (s) => Math.min(...q(s).filter(e => e.offsetHeight > 0).map(e => Math.round(e.getBoundingClientRect().height)));
      return { h: document.querySelector('#lp-top').scrollHeight, vh: innerHeight, hs: document.documentElement.scrollWidth > innerWidth + 1 || document.getElementById('landing').scrollWidth > document.getElementById('landing').clientWidth + 1, chip: hh('.lp-scale-chip'), more: hh('.lp-scale-more'), tab: hh('.lp-kindtab'),
        wide: q('.lp-scale-card, .lp-kindbox, .lp-two, .lp-proof').filter(e => e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1).length }; });
    ok(!m.hs && m.wide === 0, '手機不會橫向捲動，卡片都在畫面內', m);
    ok(m.h / m.vh < (lang === 'zh' ? 26.5 : 30), lang === 'zh' ? '手機整頁不超過 26.5 個畫面高（精簡前 44 個）' : '手機英文版不超過 30 個畫面高', { h: m.h, screens: +(m.h / m.vh).toFixed(1) });
    ok(m.chip >= 40 && m.more >= 40 && m.tab >= 40, '主題標籤、「看這一章的細節」、分頁都至少 40px 高，手指按得到', { chip: m.chip, more: m.more, tab: m.tab });
    await page.evaluate(() => document.querySelector('.lp-scale-chip[data-lp-topic="people"]').click()); await page.waitForTimeout(500);
    const s = await sheet(page); const x = await page.evaluate(() => { const b = document.querySelector('.lp-sheet-x').getBoundingClientRect(); const P = document.querySelector('.lp-sheet-panel'); const zh = ((P.querySelector('.lp-chapter.on')?.innerText || '') + (P.querySelector('.lp-sheet-bar')?.innerText || '')).match(/[一-鿿]{2,}/g) || []; return { w: Math.round(b.width), h: Math.round(b.height), inView: b.top >= 0 && b.right <= innerWidth + 1, zh: zh.slice(0, 5), txt: (P.querySelector('.lp-chapter.on')?.innerText || '').length }; });
    ok(s.open && s.vis.join() === 'self' && s.det.includes('people') && s.box[0] === 0 && s.box[2] === s.vw && s.box[1] > 20 && s.box[1] + s.box[3] >= s.vh - 1 && !s.hs, '手機：面板從下面上來、跟畫面一樣寬、上面留一段看得到原本的頁面，不會橫向捲動', s);
    ok(x.w >= 44 && x.h >= 44 && x.inView && x.txt > 200, '手機：關閉鈕 44px 見方、在畫面內；面板裡有這一章的內容', x);
    if (lang === 'en') ok(x.zh.length === 0, '英文版面板裡沒有中文', x.zh);
    await page.touchscreen.tap(195, 14); await page.waitForTimeout(300); const c = await sheet(page); ok(!c.open && !c.lock, '手機：點面板上方露出來的地方可以關掉', c);
    ok(errs.length === 0, '手機沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close(); }
  // ── 偏好減少動態 ──
  { console.log('偏好減少動態'); const { ctx, page, errs } = await open(browser, { reduce: true });
    await page.evaluate(() => document.querySelector('.lp-scale-chip[data-lp-topic="money"]').click()); await page.waitForTimeout(120);
    const r = await page.evaluate(() => { const P = document.querySelector('.lp-sheet-panel'); const cs = getComputedStyle(P); return { open: !document.getElementById('lp-sheet').hidden, anim: cs.animationName, dur: cs.animationDuration, running: document.getAnimations().filter(a => P.contains(a.effect?.target) || a.effect?.target === document.querySelector('.lp-sheet-bg')).length }; });
    ok(r.open && (r.anim === 'none' || parseFloat(r.dur) < 0.02) && r.running === 0, '偏好減少動態時面板直接出現，不播滑入動畫', r);
    ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3)); await ctx.close(); }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
