// v11.5.1 村民 › 關係（app-relmap.js）：一百多人的城市不再畫成一團線
//   1) 清單：最近的變化（新在一起、分手、離婚、絕交）、三角關係、互有好感、死對頭；情侶夫妻只給總數、預設收合
//   2) 點一筆鏡頭跟過去；點人名進到他一個人的關係圖：他在中間、只有跟他有關係的人、名字不重疊；點別人換人看；返回清單
//   3) 四個篩選套用在清單與個人圖；30 人以下有全鎮圖切換，城市沒有
//   5) 個人圖的線接在兩個方框最近的點，1、3、6、10、14 個人時都不碰到第三個名牌；每一筆的排版、篩選鈕一排四個、英文的「幾天前」
//   4) 手機 390 寬沒有橫向捲動、可點的東西至少 44×44；英文沒有中文；沒有頁面錯誤；110 人時打開、切換篩選、換人都快；狀態沒變不重算、畫布內容沒變不重畫
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8177
// SHOT_DIR=… 會順便拍截圖（deviceScaleFactor 2）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8177/';
const SHOT = process.env.SHOT_DIR || '';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const tok = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const cjk = (s) => /[㐀-鿿＀-￯　-〿]/.test(s || '');
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh'; const mob = dev === 'mobile'; const tag = `[${dev} ${lang}]`;
  const ctx = await browser.newContext(mob ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ tok, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', tok); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { tok, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady && window.rimtownApp.world, null, { timeout: 90000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {}; document.querySelectorAll('.modal-overlay,.rt-modal,#season-recap').forEach(m => m.remove()); });
  const open = () => page.evaluate(() => { const a = window.rimtownApp; a.state = a.world.getState(); a._rvC = null; if (a._kairoReady && window.innerWidth <= 768) a._openKairoTab('relmap'); else { a.activeTab = 'relmap'; a._updateTabHighlight?.('relmap'); a.renderSidebar(); } });
  const shot = async (name, top) => { if (!SHOT) return; await page.evaluate((top) => { document.getElementById('kairo-card')?.classList.add('tall'); if (top) { const sc = document.getElementById('sidebar-content'); if (sc) sc.scrollTop = 0; document.querySelector('#kairo-card .kairo-card-body, #kairo-card')?.scrollTo?.(0, 0); } }, top); await page.waitForTimeout(350); await page.screenshot({ path: `${SHOT}/${name}.png`, timeout: 120000 }); console.log('    📸', name); };
  // 共用的頁面檢查：沒有橫向捲動、可點的東西夠大、英文沒有中文
  const layout = () => page.evaluate(() => {
    const root = document.querySelector('#sidebar-content .rv-wrap'); if (!root) return { none: true };
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.checkVisibility({ visibilityProperty: true }); };
    const small = [...root.querySelectorAll('button, select, summary, [role="button"]')].filter(vis).map(el => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 44 || x.h < 44);
    const sc = document.getElementById('sidebar-content');
    const bad = window.__rvBadNames || []; let text = root.innerText; for (const n of bad) text = text.split(n).join('');
    return { hs: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1, inner: sc ? sc.scrollWidth > sc.clientWidth + 1 : false, wide: [...root.querySelectorAll('*')].filter(vis).some(el => el.getBoundingClientRect().right > window.innerWidth + 1), small, text };
  });
  const checkLayout = async (where) => { const L = await layout(); ok(!L.none && !L.hs && !L.inner && !L.wide, `${tag} ${where}：沒有橫向捲動`, { hs: L.hs, inner: L.inner, wide: L.wide });
    ok(!L.none && !L.small.length, `${tag} ${where}：可點的東西都至少 44×44`, L.small.slice(0, 5)); if (!zh) ok(!cjk(L.text), `${tag} ${where}：英文模式沒有中文`, (L.text || '').split('\n').filter(cjk).slice(0, 4)); return L; };

  // ---- 小鎮：長到 25 人，有全鎮圖 ----
  const small = await page.evaluate(() => { const w = window.rimtownApp.world; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    let k = 0; while (npcs().length < 25 && k++ < 200) { const all = npcs().filter(a => (a.age ?? 30) >= 18); w.tickCount++; w.lifecycle._birthChild(w, all[k % all.length], all[(k * 7 + 3) % all.length]); }
    while (npcs().length > 25) { const a = npcs().pop(); a.isDead = true; delete w.agents[a.agentId]; }
    // 小鎮也放幾段關係，全鎮圖才有線
    const L = npcs(); const set = (x, y, o) => { const r = x.relationships.getOrCreate(y.agentId, y.name); Object.assign(r, o); };
    set(L[0], L[1], { affinity: 80, romanticInterest: 80 }); set(L[1], L[0], { affinity: 80, romanticInterest: 80 }); set(L[2], L[3], { affinity: -80 }); set(L[3], L[2], { affinity: -80 }); set(L[4], L[5], { romanticInterest: 70 });
    return { pop: npcs().length }; });
  await open(); await page.waitForTimeout(300);
  const s1 = await page.evaluate(() => ({ seg: !!document.querySelector('#sidebar-content .rv-seg'), list: !!document.querySelector('#sidebar-content .rv-list') }));
  ok(small.pop === 25 && s1.seg && s1.list, `${tag} 25 人的小鎮：預設是清單，上面有「全鎮圖」的切換`, { small, s1 });
  await page.locator('#sidebar-content .rv-seg button[data-val="town"]').click(); await page.waitForTimeout(400);
  const s2 = await page.evaluate(() => { const c = document.querySelector('#sidebar-content #relmap-canvas'); return c ? { w: c.width, cw: c.clientWidth, h: c.height, painted: !!c._rvSig, dpr: window.devicePixelRatio } : null; });
  ok(s2 && s2.painted && s2.w === Math.round(s2.cw * s2.dpr), `${tag} 切到全鎮圖：畫布照 devicePixelRatio 放大畫出來`, s2);
  if (mob && zh) await shot('mobile-zh-town-25');
  if (!mob && !zh) await shot('desktop-en-town-25');
  // 點圖上的人 → 打開他的關係圖
  const hit = await page.evaluate(() => { const a = window.rimtownApp; const c = document.querySelector('#sidebar-content #relmap-canvas'); const [id, p] = Object.entries(a._relmapPos)[0]; const r = c.getBoundingClientRect(); return { id, x: r.left + p.x + 3, y: r.top + p.y + 3 }; });
  await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(300);
  const s3 = await page.evaluate(() => ({ view: window.rimtownApp._rv.view, who: window.rimtownApp._rv.who, back: document.querySelector('#sidebar-content .rv-back')?.textContent }));
  ok(s3.view === 'person' && s3.who === hit.id && /全鎮圖|town map/i.test(s3.back || ''), `${tag} 在全鎮圖點一個人：打開他的關係圖，返回鈕回全鎮圖`, s3);
  await page.locator('#sidebar-content .rv-back[data-action="rv-back"]').click(); await page.waitForTimeout(250);
  ok(await page.evaluate(() => window.rimtownApp._rv.view === 'town'), `${tag} 按返回回到全鎮圖`);
  await page.locator('#sidebar-content .rv-seg button[data-val="list"]').click(); await page.waitForTimeout(200);

  // ---- 城市：長到 110 人以上，設定幾段關係 ----
  const big = await page.evaluate(() => {
    const app = window.rimtownApp, w = app.world; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    let k = 0; while (npcs().length < 113 && k++ < 400) { const all = npcs(); w.tickCount++; w.lifecycle._birthChild(w, all[Math.floor(Math.random() * all.length)], all[Math.floor(Math.random() * all.length)]); }
    w.tickCount += 96 * 10; // 讓「這一週」跟出生的時間分開
    const now = w.tickCount; const free = npcs().filter(a => !a.relationships.getPartner() && !Object.values(a.relationships.relationships).some(r => r.isCheating || r.isFeud || r.status));
    const P = free.slice(0, 26); const [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, Q, R, X, S, T, U, V, V2, Y, Z, HUB] = P;
    const pair = (x, y, o, o2) => { const r = x.relationships.getOrCreate(y.agentId, y.name), s = y.relationships.getOrCreate(x.agentId, x.name); Object.assign(r, o); Object.assign(s, o2 || o); };
    // 其他人之間亂數放上幾百段關係（像玩了很久的城市：一堆情侶夫妻、單戀、仇人、摯友），只是不碰上面挑出來的 18 個人
    { const chosen = new Set(P.map(a => a.agentId)); const rest = npcs().filter(a => !chosen.has(a.agentId)); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (const x of rest) for (let n = 0; n < 12; n++) { const y = rest[Math.floor(rnd() * rest.length)]; if (y === x) continue; const r = x.relationships.getOrCreate(y.agentId, y.name); r.affinity = Math.round(rnd() * 200 - 100); r.romanticInterest = rnd() < 0.06 ? 60 + Math.round(rnd() * 40) : Math.round(rnd() * 40); }
      const single = rest.filter(a => !a.relationships.getPartner()); for (let i = 0; i + 1 < single.length && i < 60; i += 2) pair(single[i], single[i + 1], { status: i % 4 ? 'dating' : 'married', statusSince: 0, affinity: 50, romanticInterest: 50 }); }
    // 主角 A：先把他跟別人的強烈關係清掉，圖上才知道該出現誰
    for (const o of npcs()) { if (o === A) continue; const r = A.relationships.relationships[o.agentId], s = o.relationships.relationships[A.agentId]; for (const x of [r, s]) if (x) { x.affinity = 0; x.romanticInterest = 0; x.status = null; x.isFeud = false; x.isCheating = false; } }
    pair(A, B, { status: 'married', statusSince: 0, affinity: 60, romanticInterest: 60 });                    // 老夫妻
    pair(C, D, { status: 'dating', statusSince: now - 96 * 2, affinity: 60, romanticInterest: 70 });          // 兩天前開始交往
    pair(E, F, { romanticInterest: 80, affinity: 30 }, { romanticInterest: 0, affinity: 10 });                // E 單戀 F
    pair(G, A, { romanticInterest: 85, affinity: 40 }, { romanticInterest: 0, affinity: 10 });                // G 暗戀已婚的 A → 三角
    pair(H, I, { romanticInterest: 75, affinity: 40 });                                                       // 互相喜歡
    pair(J, K, { affinity: -80 });                                                                            // 死對頭
    pair(L, M, { status: 'ex', statusSince: now - 96, affinity: -10 });                                       // 昨天剛分手
    pair(N, O, { status: 'ex', statusSince: now - 96 * 3, affinity: -20 });                                   // 三天前離婚
    N.memory.addT(now - 96 * 3, '', 'relationship', '我和{other}離婚了。', { other: O.name }, 10, [O.name]);
    pair(Q, R, { affinity: -75, isFeud: true });                                                              // 前天絕交
    Q.memory.addT(now - 96 * 2, '', 'relationship', '我和{b}徹底鬧翻,絕交了。這口氣嚥不下去。', { b: R.name }, 9, [R.name]);
    pair(X, A, { affinity: -70 }, { affinity: 0 });                                                           // X 討厭 A（單方面）
    pair(L, X, { status: 'ex', statusSince: now - 96 * 30, affinity: 0 });                                    // 很久以前分的手：不算最近
    pair(S, U, { romanticInterest: 80, affinity: 50 }); pair(T, U, { romanticInterest: 90, affinity: 40 }, { romanticInterest: 0, affinity: 10 }); // S、T 都喜歡 U，U 也喜歡 S → 三角
    pair(V, V2, { status: 'married', statusSince: 0, affinity: 10, romanticInterest: 20 }); pair(V, Y, { isCheating: true, romanticInterest: 80, affinity: 60 }); // V 背著 V2 跟 Y 偷偷在一起 → 三角
    pair(Z, B, { romanticInterest: 70, affinity: 50 });                                                       // Z 和已婚的 B 互相喜歡 → 三角
    app.state = w.getState(); app._rvC = null;
    const nm = (a) => (typeof I18N !== 'undefined' && I18N.localizeNames ? I18N.localizeNames(a.name) : a.name);
    const ids = {}; for (const [k2, v] of Object.entries({ A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, Q, R, X, S, T, U, V, V2, Y, Z, HUB })) ids[k2] = { id: v.agentId, n: nm(v) };
    // 遊戲自己的英文人名對照翻不出來的名字（例如新生兒名字只有一半對得上）：記下來，英文檢查時當作資料不算介面文字
    window.__rvBadNames = npcs().map(a => nm(a)).filter(n => /[\u3400-\u9fff]/.test(n));
    return { pop: npcs().length, ids, free: free.length, bad: window.__rvBadNames };
  });
  if (!zh) console.log('    遊戲本身翻不成英文的人名：', JSON.stringify(big.bad));
  ok(big.pop >= 110 && big.free >= 26, `${tag} 長到 ${big.pop} 人，挑出 26 個沒有感情牽扯的人來設定關係`, { pop: big.pop, free: big.free });
  const I = big.ids;
  const t0 = Date.now(); await open(); const tOpen = await page.evaluate(() => { const a = window.rimtownApp; const t0 = performance.now(); a._rvC = null; a.renderSidebar(); return performance.now() - t0; });
  await page.waitForTimeout(300);
  const sec = await page.evaluate(() => { const g = (id) => { const c = document.getElementById('ic-' + id); return c ? { open: c.classList.contains('open'), rows: [...c.querySelectorAll('.rv-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), chip: c.querySelector('.ic-chip')?.textContent || '', sum: c.querySelector('.ic-sum')?.textContent || '', visRows: [...c.querySelectorAll('.rv-row')].filter(r => r.checkVisibility()).length } : null; };
    return { order: [...document.querySelectorAll('#sidebar-content .rv-list > .ic-card')].map(c => c.id), recent: g('rv-recent'), tri: g('rv-tri'), mutual: g('rv-mutual'), crush: g('rv-crush'), friend: g('rv-friend'), foe: g('rv-foe'), couples: g('rv-couples'), seg: !!document.querySelector('#sidebar-content .rv-seg'), canvas: !!document.querySelector('#sidebar-content canvas') }; });
  const has = (rows, ...names) => (rows || []).some(r => names.every(n => r.includes(n)));
  const R = sec.recent?.rows || [];
  ok(has(R, I.C.n, I.D.n) && R.some(r => r.includes(I.C.n) && (zh ? /開始交往/.test(r) : /started dating/.test(r)) && (zh ? /2 天前的事/.test(r) : /\b2 days ago/.test(r))), `${tag} 最近的變化：兩天前開始交往的一對，寫著「2 天前的事／2 days ago」`, R);
  ok(R.some(r => r.includes(I.L.n) && r.includes(I.M.n) && (zh ? /分手了 ?昨天的事/.test(r) : /broke up ?1 day ago/.test(r))), `${tag} 最近的變化：昨天剛分手的一對（昨天的事／1 day ago）`, R);
  ok(R.some(r => r.includes(I.N.n) && r.includes(I.O.n) && (zh ? /離婚/.test(r) : /divorced/.test(r))), `${tag} 最近的變化：三天前離婚的（從記憶認出是離婚不是分手）`, R);
  ok(R.some(r => r.includes(I.Q.n) && r.includes(I.R.n) && (zh ? /絕交/.test(r) : /stopped speaking/.test(r))), `${tag} 最近的變化：前天絕交的`, R);
  ok(!R.some(r => r.includes(I.L.n) && r.includes(I.X.n)) && !R.some(r => r.includes(I.A.n) && r.includes(I.B.n)), `${tag} 一個月前分的手、結婚很久的夫妻不算「最近」`, R);
  ok(has(sec.tri?.rows, I.S.n, I.T.n, I.U.n) && has(sec.tri?.rows, I.V.n, I.V2.n, I.Y.n) && has(sec.tri?.rows, I.Z.n, I.B.n, I.A.n), `${tag} 三角關係：兩人搶一個（U 偏向 S）、V 背著 V2 跟 Y、Z 和已婚的 B 互相喜歡`, sec.tri);
  ok(!has(sec.tri?.rows, I.G.n, I.A.n) && sec.crush && !sec.crush.open && has(sec.crush.rows, I.G.n, I.A.n, I.B.n) && has(sec.crush.rows, I.E.n, I.F.n) && (sec.crush.rows || []).some(r => r.includes(I.E.n) && (zh ? /目前單身/ : /single/).test(r)), `${tag} 單方面的暗戀不算三角：另外放在「單戀」卡（預設收合），寫出對方有沒有伴`, { crush: sec.crush && { open: sec.crush.open, n: sec.crush.rows.length } });
  const tri0 = (sec.tri?.rows || [])[0] || ''; ok(tri0.includes(I.V.n) && tri0.includes(I.Y.n), `${tag} 三角關係裡最有戲的（偷偷交往）排第一`, tri0);
  console.log('    各卡筆數', JSON.stringify(Object.fromEntries(['recent', 'tri', 'mutual', 'crush', 'foe', 'couples', 'friend'].map(k => [k, sec[k] ? sec[k].rows.length : 0]))));
  const fx = await page.evaluate(() => { const ch = [...document.querySelectorAll('#sidebar-content .rv-chip')].map(c => { const r = c.getBoundingClientRect(); return { t: c.textContent, top: Math.round(r.top), w: Math.round(r.width), over: c.scrollWidth > c.clientWidth + 1 }; }); const nb = document.querySelector('#ic-rv-recent .rv-new')?.textContent || ''; return { ch, nb }; });
  ok(fx.ch.length === 4 && new Set(fx.ch.map(c => c.top)).size === 1 && Math.max(...fx.ch.map(c => c.w)) - Math.min(...fx.ch.map(c => c.w)) <= 1 && !fx.ch.some(c => c.over) && (zh || fx.ch[3].t.includes('Friends')), `${tag} 四個篩選等寬排成一排，字沒有被截掉`, fx.ch);
  ok(fx.nb === (zh ? '新' : 'New'), `${tag} 「最近的變化」的小標用文字（不靠 🆕）`, fx.nb);
  // 每一筆的排版：人名是行內連結（不撐高行距）、行距約 1.6、「幾天前」接在句尾、🎥 垂直置中
  const rows = await page.evaluate(() => { const out = []; for (const r of document.querySelectorAll('#sidebar-content .rv-row')) { if (!r.checkVisibility()) continue; const tx = r.querySelector('.rv-tx'), go = r.querySelector('.rv-go'); const R = r.getBoundingClientRect(), T = tx.getBoundingClientRect(), Gr = go.getBoundingClientRect(); const cs = getComputedStyle(tx); const lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
      const lines = Math.round(T.height / lh); const nm = [...r.querySelectorAll('.rv-nm')].map(n => ({ disp: getComputedStyle(n).display, h: n.getBoundingClientRect().height }));
      const w = r.querySelector('.rv-when'); let whenOk = true; if (w) { const prev = w.previousSibling; const rg = document.createRange(); rg.selectNodeContents(prev.nodeType === 3 ? prev : prev); const pr = [...rg.getClientRects()].pop(); const wr = w.getBoundingClientRect(); whenOk = !!pr && Math.abs((pr.top + pr.bottom) / 2 - (wr.top + wr.bottom) / 2) < 8; }
      out.push({ t: tx.textContent.slice(0, 24), ratio: Math.round(lh / fs * 100) / 100, lines, h: Math.round(R.height), maxH: Math.max(44, lines * lh + 20), center: Math.abs((Gr.top + Gr.bottom) / 2 - (R.top + R.bottom) / 2), nm, whenOk }); } return out; });
  const badRows = rows.filter(x => x.ratio < 1.5 || x.ratio > 1.7 || x.h > x.maxH + 1 || x.center > 2 || !x.whenOk || x.nm.some(n => !/^inline/.test(n.disp) || n.h < 44));
  ok(rows.length >= 5 && !badRows.length, `${tag} 每一筆：人名是行內連結（可點範圍至少 44 高、不撐高行距），行距約 1.6，「幾天前」接在句尾，🎥 垂直置中（${rows.length} 筆、${rows.filter(x => x.lines > 1).length} 筆換行）`, badRows.slice(0, 3));
  ok(has(sec.mutual?.rows, I.H.n, I.I.n) && !(sec.mutual?.rows || []).some(r => r.includes(I.E.n)), `${tag} 互有好感還沒說破：H 和 I；單方面的 E 不在這裡`, sec.mutual);
  ok(has(sec.foe?.rows, I.J.n, I.K.n) && has(sec.foe?.rows, I.Q.n, I.R.n) && !has(sec.foe?.rows, I.X.n, I.A.n), `${tag} 死對頭：J 和 K、絕交的 Q 和 R；單方面討厭的 X 不算`, sec.foe);
  ok(sec.couples && !sec.couples.open && sec.couples.visRows === 0 && (zh ? /\d+ 對夫妻、\d+ 對情侶/ : /\d+ married, \d+ dating/).test(sec.couples.chip) && has(sec.couples.rows, I.A.n, I.B.n), `${tag} 情侶與夫妻：預設收合，只看得到總數`, { ...sec.couples, rows: sec.couples?.rows.length });
  ok(sec.order.indexOf('ic-rv-recent') === 0 && sec.order.indexOf('ic-rv-couples') > sec.order.indexOf('ic-rv-foe'), `${tag} 有戲的排前面：最近的變化第一、情侶夫妻排在死對頭後面`, sec.order);
  ok(!sec.seg && !sec.canvas, `${tag} 110 人的城市沒有全鎮圖可以切換`, sec);
  const L1 = await checkLayout('清單');
  if (mob && zh) await shot('mobile-zh-list-110', true);
  if (!mob && !zh) await shot('desktop-en-list-110', true);
  if (mob && !zh) await shot('mobile-en-list-110', true);
  // 展開情侶與夫妻
  await page.locator('#ic-rv-couples .ic-hd').click(); await page.waitForTimeout(200);
  const cp = await page.evaluate(() => { const c = document.getElementById('ic-rv-couples'); return { open: c.classList.contains('open'), vis: [...c.querySelectorAll('.rv-row')].filter(r => r.checkVisibility()).length, all: c.querySelectorAll('.rv-row').length, more: !!c.querySelector('details.rv-all') }; });
  ok(cp.open && cp.vis >= 1 && cp.vis <= 6 && (cp.all <= 6 || cp.more), `${tag} 展開情侶與夫妻：先列前 6 筆，其餘收在「看全部」`, cp);
  if (mob && zh) { await page.evaluate(() => document.getElementById('ic-rv-couples')?.scrollIntoView({ block: 'start' })); await shot('mobile-zh-couples-open'); }
  await checkLayout('展開情侶與夫妻');
  await page.locator('#ic-rv-couples .ic-hd').click(); await page.waitForTimeout(150);

  // 點一筆：鏡頭跟過去
  // G 那一筆可能排在前 4 筆之後，收在「看全部」裡：先打開
  const reveal = (g) => page.evaluate((g) => { const c = document.getElementById('ic-rv-crush'); if (c && !c.classList.contains('open')) window.rimtownApp._icClick('ic-toggle', 'rv-crush'); const r = document.querySelector(`#ic-rv-crush .rv-row[data-val="${g}"]`); const d = r?.closest('details'); const was = d ? d.open : null; if (d) d.open = true; r?.scrollIntoView({ block: 'center' }); return { found: !!r, inMore: !!d, was }; }, g);
  const rv = await reveal(I.G.id);
  ok(rv.found && (!rv.inMore || rv.was === false), `${tag} 單戀筆數多時，前 4 筆以外收在「看全部」裡（G 那一筆${rv.inMore ? '在' : '不在'}裡面）`, rv);
  await page.locator(`#ic-rv-crush .rv-row[data-val="${I.G.id}"] .rv-go`).first().click(); await page.waitForTimeout(250);
  const fol = await page.evaluate((g) => ({ f: window.rimtownApp.tileMap?.isFollowing?.(g), sel: window.rimtownApp.selectedAgent }), I.G.id);
  ok(fol.f && fol.sel === I.G.id, `${tag} 點一筆：鏡頭跟到那個人（G）`, fol);
  await page.evaluate(() => { window.rimtownApp.tileMap?.followAgent?.(null); window.rimtownApp._hideNpcCard?.(); }); await open(); await page.waitForTimeout(250);

  // 點人名 → A 的關係圖
  await reveal(I.G.id); const nameBtn = page.locator(`#ic-rv-crush .rv-row[data-val="${I.G.id}"] .rv-nm[data-val="${I.A.id}"]`).first(); await nameBtn.scrollIntoViewIfNeeded(); await nameBtn.click(); await page.waitForTimeout(400);
  const pg = () => page.evaluate(() => { const g = document.querySelector('#sidebar-content .rv-graph'); if (!g) return null; const pills = [...g.querySelectorAll('.rv-pill')];
    const rs = pills.map(p => { const r = p.getBoundingClientRect(); return { id: p.dataset.val, me: p.classList.contains('rv-me'), k: p.dataset.rvK || '', tag: p.querySelector('small')?.textContent || '', x: r.left, y: r.top, w: r.width, h: r.height, clip: [...p.querySelectorAll('b,small')].some(e => e.scrollWidth > e.clientWidth + 1) }; });
    const over = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) over.push([a.id, b.id]); }
    const cv = g.querySelector('.rv-cv'); return { who: window.rimtownApp._rv.who, view: window.rimtownApp._rv.view, title: document.querySelector('#sidebar-content .rv-title')?.textContent, me: rs.filter(x => x.me).map(x => x.id), others: rs.filter(x => !x.me).map(x => x.id), pills: rs, over, clip: rs.filter(x => x.clip).map(x => x.id), cv: cv ? { w: cv.width, cw: g.clientWidth, sig: !!cv._rvSig } : null, dpr: window.devicePixelRatio, paints: window.rimtownApp._rvPaints || 0 }; });
  const A1 = await pg();
  const expA = [I.B.id, I.G.id, I.X.id].sort();
  ok(A1 && A1.view === 'person' && A1.who === I.A.id && A1.me.join() === I.A.id && (A1.title || '').includes(I.A.n), `${tag} 點人名：進到 A 的關係圖，A 在中間`, A1 && { who: A1.who, title: A1.title });
  ok(A1 && A1.others.slice().sort().join() === expA.join(), `${tag} 圖上只有 A 和跟他有關係的人（配偶 B、暗戀他的 G、討厭他的 X）`, A1 && { got: A1.others, exp: expA });
  const tagOf = (id) => (A1?.pills.find(p => p.id === id) || {}).tag || '';
  ok(zh ? (tagOf(I.B.id) === '夫妻' && tagOf(I.G.id) === `暗戀${I.A.n}` && tagOf(I.X.id) === `討厭${I.A.n}`) : (tagOf(I.B.id) === 'Married' && tagOf(I.G.id) === `Has a crush on ${I.A.n}` && tagOf(I.X.id) === `Dislikes ${I.A.n}`), `${tag} 名牌寫著他跟 A 是什麼關係、誰對誰`, A1 && A1.pills.map(p => p.tag));
  ok(A1 && !A1.over.length && !A1.clip.length, `${tag} 名字完整、互不重疊（比對每個名牌的框）`, A1 && { over: A1.over, clip: A1.clip });
  ok(A1 && A1.cv && A1.cv.sig && A1.cv.w === Math.round(A1.cv.cw * A1.dpr), `${tag} 線畫在照 devicePixelRatio 放大的畫布上`, A1 && { cv: A1.cv, dpr: A1.dpr });
  // 自動重畫（每秒一次）內容沒變：不重畫畫布
  const rep = await page.evaluate(async () => { const a = window.rimtownApp; a._autoSidebar(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const p0 = a._rvPaints; for (let i = 0; i < 3; i++) { a._autoSidebar(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } return { p0, p1: a._rvPaints, same: a._sbSame || 0 }; });
  ok(rep.p1 === rep.p0, `${tag} 面板自動重畫三次、內容沒變：畫布一次都沒重畫`, rep);
  await checkLayout('個人關係圖');
  if (mob && zh) { await page.evaluate(() => document.querySelector('#sidebar-content .rv-person')?.scrollIntoView({ block: 'start' })); await shot('mobile-zh-person'); }
  if (!mob && !zh) await shot('desktop-en-person');
  // 點圖上的另一個人 → 換成看他
  await page.locator(`#sidebar-content .rv-graph .rv-pill[data-val="${I.B.id}"]`).click(); await page.waitForTimeout(300);
  const B1 = await pg();
  ok(B1 && B1.who === I.B.id && B1.me.join() === I.B.id && B1.others.includes(I.A.id) && !B1.others.includes(I.G.id) && (B1.title || '').includes(I.B.n), `${tag} 點圖上的 B：換成看 B（A 在他旁邊，暗戀 A 的 G 不在 B 的圖上）`, B1 && { who: B1.who, others: B1.others });
  // 篩選：關掉戀愛 → B 的圖上沒有 A
  await page.locator('#sidebar-content .rv-chip[data-val="love"]').click(); await page.waitForTimeout(250);
  const B2 = await pg(); const B2n = await page.evaluate(() => document.querySelector('#sidebar-content .rv-person .rv-calm')?.textContent || '');
  ok((!B2 || !B2.others.includes(I.A.id)) && (B2 || B2n), `${tag} 篩選套用在個人圖：關掉戀愛，B 的圖上就沒有 A`, { B2: B2 && B2.others, B2n });
  await page.locator('#sidebar-content .rv-chip[data-val="love"]').click(); await page.waitForTimeout(200);
  // 返回清單
  await page.locator('#sidebar-content .rv-back[data-action="rv-back"]').click(); await page.waitForTimeout(250);
  const back = await page.evaluate(() => ({ view: window.rimtownApp._rv.view, list: !!document.querySelector('#sidebar-content .rv-list') }));
  ok(back.view === 'list' && back.list, `${tag} 返回清單`, back);
  // 篩選套用在清單：關掉敵對 → 死對頭那一區不見、絕交的變化也不見；打開摯友 → 多一區
  await page.locator('#sidebar-content .rv-chip[data-val="foe"]').click(); await page.waitForTimeout(200);
  const ff = await page.evaluate((q) => ({ foe: !!document.getElementById('ic-rv-foe'), feud: [...document.querySelectorAll('#ic-rv-recent .rv-row')].some(r => r.textContent.includes(q)), tri: !!document.getElementById('ic-rv-tri'), pressed: document.querySelector('#sidebar-content .rv-chip[data-val="foe"]').getAttribute('aria-pressed') }), I.Q.n);
  ok(!ff.foe && !ff.feud && ff.tri && ff.pressed === 'false', `${tag} 篩選套用在清單：關掉敵對，死對頭與絕交的變化都不見，其他區還在`, ff);
  await page.locator('#sidebar-content .rv-chip[data-val="foe"]').click(); await page.waitForTimeout(150);
  // 下拉選人
  await page.locator('#sidebar-content select[data-rv-pick]').selectOption(I.J.id); await page.waitForTimeout(300);
  const J1 = await pg();
  ok(J1 && J1.who === I.J.id && J1.others.includes(I.K.id), `${tag} 上方的下拉選單選人：打開他的關係圖`, J1 && { who: J1.who, others: J1.others });
  // 關係最多的人：最多畫 14 個，其餘一句話交代；名字仍然不重疊
  const busy = await page.evaluate(() => { const a = window.rimtownApp; a._relmapFilters.friend = true; const D = a._rvData(); const id = D.ids.slice().sort((x, y) => (D.byP[y] || []).length - (D.byP[x] || []).length)[0]; a._rvOpen(id, null); return { id, n: (D.byP[id] || []).length, note: [...document.querySelectorAll('#sidebar-content .rv-person .ic-note')].map(e => e.textContent).join('|') }; });
  await page.waitForTimeout(300); const Bz = await pg();
  ok(Bz && Bz.others.length === Math.min(14, busy.n) && !Bz.over.length && !Bz.clip.length && (busy.n <= 14 || /14/.test(busy.note)), `${tag} 關係最多的人（${busy.n} 段）：畫 ${Bz && Bz.others.length} 個${busy.n > 14 ? '，其餘一句話交代' : ''}，名字不重疊`, { busy, over: Bz && Bz.over, clip: Bz && Bz.clip });
  await checkLayout('關係很多的人');
  if (mob && zh) { await page.evaluate(() => document.querySelector('#sidebar-content .rv-person')?.scrollIntoView({ block: 'start' })); await shot('mobile-zh-person-busy'); }
  await page.evaluate(() => { window.rimtownApp._relmapFilters.friend = false; });
  await page.locator('#sidebar-content .rv-back[data-action="rv-back"]').click(); await page.waitForTimeout(150);

  // 線不能從第三個名牌底下穿過：HUB 跟 1、3、6、10、14 個人有關係，用幾何算每條實際畫出來的線（曲線是 21 個取樣點連成的折線）
  const geo = [];
  for (const n of [1, 3, 6, 10, 14]) {
    const r = await page.evaluate(({ hub, n, skip }) => { const a = window.rimtownApp, w = a.world; const H = w.agents[hub]; const npcs = Object.values(w.agents).filter(x => !x.isPlayer && !x.isDead && x !== H && !skip.includes(x.agentId));
      for (const o of npcs) { const r1 = H.relationships.relationships[o.agentId], r2 = o.relationships.relationships[hub]; for (const x of [r1, r2]) if (x) { x.affinity = 0; x.romanticInterest = 0; x.status = null; x.isFeud = false; x.isCheating = false; } }
      const kinds = [{ ri: [0, 80] }, { af: [-80, -80] }, { ri: [80, 0] }, { af: [80, 80] }, { af: [0, -80] }, { ri: [80, 80] }, { af: [-80, 0] }];
      const others = npcs.slice(-n); // 隊伍最後面的人（新生兒），不是上面挑出來的那 26 個
      others.forEach((o, i) => { const k = i === 0 ? { st: 1 } : kinds[i % kinds.length]; const r1 = H.relationships.getOrCreate(o.agentId, o.name), r2 = o.relationships.getOrCreate(hub, H.name);
        if (k.st) { r1.status = r2.status = 'dating'; r1.statusSince = r2.statusSince = 0; r1.affinity = r2.affinity = 60; } if (k.ri) { r1.romanticInterest = k.ri[0]; r2.romanticInterest = k.ri[1]; r1.affinity = r2.affinity = 30; } if (k.af) { r1.affinity = k.af[0]; r2.affinity = k.af[1]; } });
      a.state = w.getState(); a._rvC = null; a._relmapFilters.friend = true; a._rvOpen(hub, null); return { n: others.length, byP: (a._rvData().byP[hub] || []).length, view: a._rv.view, who: a._rv.who === hub, g: !!document.querySelector('#sidebar-content .rv-graph'), calm: document.querySelector('#sidebar-content .rv-calm')?.textContent || '' }; }, { hub: I.HUB.id, n, skip: Object.values(I).map(x => x.id) });
    if (process.env.DBG) console.log('    hub', n, JSON.stringify(r));
    await page.waitForTimeout(250);
    const g2 = await page.evaluate(() => { const g = document.querySelector('#sidebar-content .rv-graph'); if (!g) return null; window.rimtownApp._rvPaint(); const G = g.getBoundingClientRect();
      const box = (el) => { const q = el.getBoundingClientRect(); return { id: el.dataset.val, me: el.classList.contains('rv-me'), x0: q.left - G.left, y0: q.top - G.top, x1: q.right - G.left, y1: q.bottom - G.top }; };
      const B = [...g.querySelectorAll('.rv-pill')].map(box); const P = g._rvPaths || [];
      // 線段跟方框（內縮 1px）相交：Liang–Barsky
      const hit = (x1, y1, x2, y2, R) => { const dx = x2 - x1, dy = y2 - y1; let t0 = 0, t1 = 1; for (const [p, q] of [[-dx, x1 - R.x0 - 1], [dx, R.x1 - 1 - x1], [-dy, y1 - R.y0 - 1], [dy, R.y1 - 1 - y1]]) { if (p === 0) { if (q < 0) return false; continue; } const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } return t0 < t1; };
      const dist = (x, y, R) => Math.hypot(Math.max(R.x0 - x, 0, x - R.x1), Math.max(R.y0 - y, 0, y - R.y1));
      const me = B.find(b => b.me); const bad = [], ends = [];
      for (const p of P) { const own = B.find(b => !b.me && b.id === p.id); const pts = p.pts; for (let i = 1; i < pts.length; i++) for (const R of B) if (R !== me && R !== own && hit(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], R)) bad.push([p.id, R.id]);
        if (dist(pts[0][0], pts[0][1], me) > 1.5 || dist(pts[pts.length - 1][0], pts[pts.length - 1][1], own) > 1.5) ends.push(p.id); }
      return { pills: B.length - 1, paths: P.length, curves: P.filter(p => p.pts.length > 2).length, bad, ends, w: Math.round(G.width) }; });
    geo.push({ n, ...g2 });
    ok(g2 && g2.paths === n && g2.pills === n && !g2.bad.length && !g2.ends.length, `${tag} ${n} 個人的圖（寬 ${g2 && g2.w}px）：${n} 條線都接在兩個方框最近的點上，沒有一條碰到第三個名牌${g2 && g2.curves ? `（${g2.curves} 條改走曲線）` : ''}`, g2);
    if (n === 14 && mob && zh) { await page.evaluate(() => document.querySelector('#sidebar-content .rv-person')?.scrollIntoView({ block: 'start' })); await shot('mobile-zh-person-14'); }
  }
  await page.evaluate(() => { window.rimtownApp._relmapFilters.friend = false; window.rimtownApp._rv.view = 'list'; window.rimtownApp.renderSidebar(); });

  // 效能：110 人打開、切換篩選、換人看；狀態沒變不重算
  const perf = await page.evaluate(async (ids) => { const a = window.rimtownApp; const T = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
    a._rvC = null; const build = T(() => a._rvData()); const D1 = a._rvData(); const cached = T(() => a._rvData()); const same = a._rvData() === D1;
    a._rv.view = 'list'; const list = T(() => a.renderSidebar());
    const filt = T(() => { a._relmapFilters.friend = true; a.renderSidebar(); a._relmapFilters.friend = false; a.renderSidebar(); }) / 2;
    const ps = []; for (const id of ids) ps.push(T(() => a._rvOpen(id, null)));
    // 模擬走一格以後才重算
    a.world.paused = false; a.world.tick(); a.world.paused = true; a.state = a.world.getState(); const after = a._rvData() !== D1;
    a._rv.view = 'list'; a.renderSidebar();
    return { build: Math.round(build * 10) / 10, cached: Math.round(cached * 100) / 100, same, list: Math.round(list), filt: Math.round(filt), person: Math.round(Math.max(...ps)), after, pop: D1.ids.length, pairs: D1.rel.length }; }, [I.A.id, I.B.id, I.J.id, I.H.id]);
  console.log('    perf', JSON.stringify(perf));
  ok(perf.same && perf.cached < 1 && perf.after, `${tag} 清單的計算有快取：狀態沒變拿同一份，模擬走一格才重算`, perf);
  ok(perf.build < 60 && perf.list < 200 && perf.filt < 200 && perf.person < 200, `${tag} ${perf.pop} 人：計算 ${perf.build}ms、打開 ${perf.list}ms、切篩選 ${perf.filt}ms、換人 ${perf.person}ms，都不卡`, perf);
  ok(tOpen < 300, `${tag} 打開關係頁（含重算）${Math.round(tOpen)}ms`, tOpen);

  // 鎮上還沒有任何關係：平靜的提示
  const calm = await page.evaluate(() => { const a = window.rimtownApp; const keep = a._rvBuild; a._rvBuild = (ids) => ({ ids, name: Object.fromEntries(ids.map(i => [i, i])), rel: [], byP: {}, partner: {}, recent: [], tri: [], mutual: [], foes: [], couples: [], friends: [], any: 0 }); a._rvC = null; a.renderSidebar(); const tx = document.querySelector('#sidebar-content .rv-calm')?.textContent || ''; a._rvBuild = keep; a._rvC = null; a.renderSidebar(); return tx; });
  ok(zh ? /鎮上還很平靜/.test(calm) : /quiet|calm|peaceful/i.test(calm) && !cjk(calm), `${tag} 鎮上還沒有任何關係時：保留原本那句平靜的提示`, calm);
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { for (const [d, l] of [['mobile', 'zh'], ['mobile', 'en'], ['desktop', 'en']]) if (!process.env.RUNS || process.env.RUNS.split(',').includes(d + '-' + l)) await run(browser, d, l); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
