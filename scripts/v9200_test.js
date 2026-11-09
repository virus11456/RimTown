// v9.2.0 世界級災厄移進手牌（同一邊、自己一個區塊）、解鎖跟著帳號、🧟 喪屍危機（基因生物）
// 喪屍：會不會發生（路線、人工生命、延壽、外洩）、築牆提案、降臨後一部分人變喪屍（不投票、不聊天、不上班）、
// 夜裡咬人兩天後發病、家人瞞著、守衛清剿與家人擋、解藥做完全部變回來、沒做完最後被圍住、存讀檔、3D 外觀、AI 知道
// 手牌：世界級災厄卡在手牌那一欄（不在詳情那一欄）、選了看詳情、發動花 80 神力、工坊不再列清單
// 帳號：帳號上的解鎖合進本機、本機多的推上去、新解鎖自動推、伺服器只做聯集且擋掉格式不對的
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

async function apiTest() {
  console.log('api/settings.js');
  const store = {}; const lib = path.resolve(__dirname, '../api/_lib.js');
  require.cache[lib] = { id: lib, filename: lib, loaded: true, exports: { authUser: () => ({ u: 'Tester' }), err: (res, c, k) => res.status(c).json({ error: k }), rateLimit: () => true, readJson: async (p) => store[p] ? JSON.parse(JSON.stringify(store[p])) : null, writeJson: async (p, d) => { store[p] = JSON.parse(JSON.stringify(d)); } } };
  const h = require('../api/settings.js');
  const call = async (method, body) => { let out; const res = { status: (c) => ({ json: (j) => { out = { c, j }; } }) }; await h({ method, body, headers: {} }, res); return out; };
  await call('POST', { unlocks: { worldcal: ['nukewar', 'zombie'], godbook: ['comet'] } });
  await call('POST', { unlocks: { worldcal: ['aliens', '<script>', 'x'.repeat(60)], godbook: [] }, dialogue_lang: 'zh' });
  const g = await call('GET');
  const u = g.j.settings.unlocks;
  ok(u.worldcal.sort().join() === 'aliens,nukewar,zombie' && u.godbook.join() === 'comet' && g.j.settings.dialogue_lang === 'zh', '伺服器：解鎖只做聯集（不會被另一台裝置蓋掉），格式不對的丟掉', u);
  await call('POST', { npc_llm_budget: 5 }); const g2 = await call('GET');
  ok(g2.j.settings.unlocks.worldcal.length === 3, '只改別的設定時，解鎖不會被清掉', g2.j.settings.unlocks);
}

(async () => {
  await apiTest();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[WorldCal\]/.test(m.text())) errs.push(m.text()); });
    const posts = [];
    await page.route('**/api/**', r => {
      const u = r.request().url();
      if (u.includes('/api/settings')) { if (r.request().method() === 'POST') { try { posts.push(JSON.parse(r.request().postData() || '{}')); } catch (e) {} return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }); }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { unlocks: { worldcal: ['aliens'], godbook: ['comet'] } } }) }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) });
    });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); if (!sessionStorage.getItem('v92')) { sessionStorage.setItem('v92', '1'); localStorage.setItem('rimtown_worldcal', '["nukewar"]'); localStorage.setItem('rimtown_godbook', '[]'); } }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(800);
    const sync = await page.evaluate(() => ({ wc: JSON.parse(localStorage.getItem('rimtown_worldcal') || '[]').sort(), gb: JSON.parse(localStorage.getItem('rimtown_godbook') || '[]') }));
    ok(sync.wc.join() === 'aliens,nukewar' && sync.gb.join() === 'comet', '登入時：帳號上的解鎖合進這台裝置（換裝置也在）', sync);
    ok(posts.some(p => (p.unlocks?.worldcal || []).includes('nukewar')), '這台裝置多的（核戰）推上帳號', posts.map(p => p.unlocks));
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {};
      let d = w._absDay(); w._absDay = () => d; let wcDrift = 0;
      const step = (n = 1) => { for (let i = 0; i < n; i++) { d++; const T0 = MONEY.total(w), p0 = MONEY.S(w).pend || 0; WORLDCAL.daily(w); wcDrift += (MONEY.total(w) - T0) - ((MONEY.S(w).pend || 0) - p0); try { w.proposals.daily(w); } catch (e) {} } };
      const people = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && !String(a.agentId).startsWith('visit_'));
      const P = () => w.research.projects; const setDone = (ks, on = true) => { const Q = P(); for (const k of ks) if (Q[k]) { Q[k].status = on ? 'complete' : 'locked'; if (on) Q[k].progress = Q[k].cost; } };
      try { WALLET.S(w); } catch (e) {}
      w.tech = w.tech || {}; TECH.S(w); const p0 = w.tech.path; const pw0 = CALAMITY.S(w).power;
      // 補到 30 個大人,喪屍才看得出來
      let k = 0; while (people().length < 30 && k++ < 40) { const n0 = Object.keys(w.agents).length; try { w.events?._spawnImmigrant?.(w); } catch (e) {} if (Object.keys(w.agents).length === n0) break; }
      const snap = JSON.stringify(w.serialize());
      const restore = () => { w.loadSave(JSON.parse(snap)); w.observerMode = true; w._absDay = () => d; w.tech = w.tech || {}; TECH.S(w); w.tech.path = 'bio'; w.worldcal = null; WORLDCAL.S(w); };
      // 1) 會不會發生
      w.tech.path = 'bio'; setDone(['life_extension', 'synthetic_life', 'gene_editing'], false);
      const w0 = WORLDCAL.weights(w).zombie; setDone(['synthetic_life', 'life_extension']); const w1 = WORLDCAL.weights(w).zombie; TECH.S(w).bio = TECH.S(w).bio || {}; TECH.S(w).bio.st = { leak: 2 }; const w2 = WORLDCAL.weights(w).zombie;
      out.weight = { w0, w1, w2, kinds: Object.keys(WORLDCAL.weights(w)).sort() };
      // 2) 自然發生 → 研究爭論 → 口耳相傳(築牆提案)
      restore(); const c = WORLDCAL.begin(w, 'zombie', 'nature'); const ph = (p) => { let g = 0; while (w.worldcal.cur && w.worldcal.cur.ph !== p && g++ < 200) step(); };
      ph('rumor'); const wall = (w.proposals?.items || []).find(p => p.kind === 'wc_wall');
      out.rumor = { wall: !!wall, cost: !!wall?.extra?.cost || !!wall?.cost, vGuard: null };
      const guard = people().find(a => a.job?.key === 'guard' && !c.deny.includes(a.agentId)); if (wall && guard) { const R1 = Math.random; Math.random = () => 0.5; try { out.rumor.vGuard = WORLDCAL.vote(w, wall, guard).v; } finally { Math.random = R1; } } // 不是「說沒事」那派的守衛；固定亂數
      // 3) 降臨:重創(解藥沒做)
      c.prog = 0; c.prep = null; ph('arrive'); const zb = c.zb; const zIds = zb ? zb.ids.slice() : [];
      const z = zIds.length ? w.agents[zIds[0]] : null;
      out.arrive = { out: c.out, n: zIds.length, alive: z && !z.isDead, notAdult: z ? !WORLDCAL._t && true : false };
      if (z) {
        out.arrive.notVote = !w.proposals._npcs(w).includes(z);
        z.currentLocation = 'town_square'; out.arrive.notHere = !w.getAgentsAtLocation('town_square').includes(z);
        out.arrive.look = LOOK.of(w, z)?.zb === 1 && /Z/.test(LOOK.sig(LOOK.of(w, z)));
        z._decideLocation(23); out.arrive.night = z.targetLocation; z._decideLocation(11); out.arrive.day = z.targetLocation; out.arrive.act = z.activity;
        out.arrive.town = WORLDCAL.townBrief(w); const other = people()[0]; out.arrive.brief = WORLDCAL.brief(w, other);
      }
      // 存讀檔
      const sv = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(sv); w.observerMode = true; w._absDay = () => d; const c2 = w.worldcal.cur;
      out.save = { ids: (c2?.zb?.ids || []).join() === zIds.join(), isZ: z ? WORLDCAL.isZombie(w, w.agents[z.agentId]) : false };
      // 4) 咬人、發病、清剿
      const C = w.worldcal.cur; C.prog = 0; C.fast = 0; // 解藥先不要動
      for (const a of people().slice(0, 4)) { a.personality = a.personality || {}; a.personality.traits = [...(a.personality.traits || []), 'brave']; } // 有人敢清剿
      const n0 = C.zb.ids.length; let bitSeen = 0, hidMem = false;
      const R0 = Math.random; let seq = 0; Math.random = () => { seq++; return (seq % 7) / 7; };
      try { for (let i = 0; i < 6 && w.worldcal.cur; i++) { WORLDCAL._t.zombieDaily(w, C); bitSeen = Math.max(bitSeen, Object.keys(C.zb.bit).length); d++; } } finally { Math.random = R0; }
      out.spread = { n0, n1: C.zb.ids.length, bit: C.zb.st.bitten, turned: C.zb.st.turned, killed: C.zb.st.killed, hid: C.zb.st.hid, bitSeen, cap: C.zb.ids.length + Object.keys(C.zb.bit).length <= Math.ceil((people().length + C.zb.ids.length) * 0.4) + 1, left: people().length };
      // 5) 解藥做完 → 全部變回人
      if (!C.zb.ids.length) WORLDCAL._t.zTurn(w, C, people()[0], true); // 守衛可能已經清光,補一個
      C.fast = 1; C.prog = 99.9; const before = C.zb.ids.length; WORLDCAL._t.zombieDaily(w, C);
      out.cure = { before, after: C.zb.ids.length, bit: Object.keys(C.zb.bit).length, cured: C.zb.st.cured, back: zIds.concat(Object.keys(w.agents)).filter(id => w.agents[id] && !w.agents[id].isDead).every(id => !WORLDCAL.isZombie(w, w.agents[id])) };
      let g = 0; while (w.worldcal.cur && g++ < 200) step();
      const h = w.worldcal.hist[0]; out.end = { kind: h?.kind, unl: WORLDCAL.unlocked('zombie'), flags: Object.values(w.agents).filter(a => WORLDCAL.isZombie(w, a)).length };
      // 6) 沒做完:最後的喪屍被圍住
      restore(); const c3 = WORLDCAL.begin(w, 'zombie', 'nature'); const seen3 = new Set(); c3.prog = 0; c3.fast = 0; while (w.worldcal.cur && w.worldcal.cur.ph !== 'after') { step(); for (const id of (c3.zb?.ids || [])) seen3.add(id); } c3.fast = 0; while (w.worldcal.cur) { c3.fast = 0; c3.prog = 0; for (const id of (c3.zb?.ids || [])) seen3.add(id); step(); } const ids3 = [...seen3]; // 整場出現過的喪屍（有的會先被守衛清剿）
      out.noCure = { n: ids3.length, dead: ids3.every(id => w.agents[id]?.isDead || !w.agents[id]), dc: c3.dead >= 1 };
      // 7) 築了牆:變喪屍的少一半
      let a1 = 0, a2 = 0; for (let i = 0; i < 6; i++) { restore(); const cc = WORLDCAL.begin(w, 'zombie', 'nature'); cc.prog = 0; cc.prep = i % 2 ? d : null; WORLDCAL._t.arrive(w, cc); if (i % 2) a2 += cc.zb.ids.length; else a1 += cc.zb.ids.length; w.worldcal.cur = null; }
      out.wall = { no: a1, yes: a2 };
      out.drift = Math.round(wcDrift * 100) / 100;
      // 8) 介面:手牌裡的世界級災厄
      restore(); WORLDCAL.S(w).cool = 0; CALAMITY.S(w).power = 100; localStorage.setItem('rimtown_worldcal', JSON.stringify(['nukewar', 'aliens', 'zombie']));
      app._ghTab = 'hand'; app._ghFilter = 'all'; app._ghSel = null; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const tray = document.getElementById('gh-tray'); const col = tray.querySelector('.gh-body > .gh-col');
      out.ui = { inCol: !!col?.querySelector('.gh-hand:not(.gh-wc-row)') && !!col?.querySelector('.gh-wc .gh-wc-row'), cards: tray.querySelectorAll('.gh-wcc').length, on: tray.querySelectorAll('.gh-wcc:not(.off)').length, detailSide: !!tray.querySelector('.gh-body > .gh-detail') };
      const zc = tray.querySelector('.gh-wcc[data-v="wc:zombie"]'); zc?.click(); await new Promise(r => setTimeout(r, 200));
      const det = tray.querySelector('.gh-wcd'); out.ui.det = !!det && !!det.querySelector('[data-gh="wc-play"]:not([disabled])');
      const lockC = tray.querySelector('.gh-wcc.off'); lockC?.click(); await new Promise(r => setTimeout(r, 200)); out.ui.lockedBtn = !!tray.querySelector('.gh-wcd [data-gh="wc-play"][disabled]');
      const t1 = tray.innerText;
      app._ghTab = 'lab'; app._ghRender(); out.ui.labNoList = !tray.querySelector('.gh-wcc') && !tray.querySelector('.wc-kind');
      app._ghTab = 'hand'; app._ghFilter = 'wc'; app._ghSel = 'wc:zombie'; app._ghRender(); out.ui.filterOnly = !tray.querySelector('.gh-hand:not(.gh-wc-row) .gh-card') && tray.querySelectorAll('.gh-wcc').length === 8;
      out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1;
      out.ui.squash = ['.gh-head', '.gh-tabs', '.gh-filters'].filter(q => { const e = tray.querySelector(q); return e && e.getBoundingClientRect().height + 1 < e.scrollHeight; }); // v9.2.1 標題列、篩選列不能被擠扁
      tray.querySelector('.gh-wcd [data-gh="wc-play"]')?.click(); await new Promise(r => setTimeout(r, 300));
      out.ui.played = { kind: w.worldcal?.cur?.kind, src: w.worldcal?.cur?.src, spent: 100 - CALAMITY.S(w).power, closed: !app._ghOpen };
      // 進行中:手牌區塊顯示狀態
      const c4 = w.worldcal.cur; if (c4) { while (w.worldcal.cur && w.worldcal.cur.ph !== 'after') step(); app._ghTab = 'hand'; app._ghFilter = 'wc'; app._ghShow(); await new Promise(r => setTimeout(r, 300)); out.ui.box = !!tray.querySelector('.gh-wc .wc-box') && !!tray.querySelector('.wc-zb'); }
      const t2 = tray.innerText; app._ghFilter = 'all'; app._ghHide?.();
      const all = t1 + '\n' + t2; out.ui.undef = /undefined|NaN|\{[a-z]+\}/.test(all); out.ui.cjk = (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (all.match(/[一-鿿]+/g) || []).slice(0, 8) : [];
      // 9) 新解鎖自動推上帳號
      w.worldcal.cur = null; localStorage.setItem('rimtown_worldcal', '[]'); const c5 = WORLDCAL.begin(w, 'iceage', 'lab'); while (w.worldcal.cur) step();
      out.pushWait = true;
      // 成就
      const U = app._unlockedAchievements; U.delete('wc_zombie'); U.delete('wc_all'); w.worldcal.hist.unshift({ kind: 'zombie', out: 'hit', src: 'nature' });
      localStorage.setItem('rimtown_worldcal', JSON.stringify(Object.keys(WORLDCAL.KINDS))); app._achNewOnce = true; app._achFirstCheckDone = true; app._showAchievementToast = () => {}; app._checkAchievements();
      out.ach = { zb: U.has('wc_zombie'), all: U.has('wc_all') };
      w.tech.path = p0; CALAMITY.S(w).power = pw0;
      return out;
    });
    for (let i = 0; i < 30 && !posts.some(p => (p.unlocks?.worldcal || []).includes('iceage')); i++) await page.waitForTimeout(500); // 新解鎖 3 秒後推；機器忙的時候會晚一點
    const zh = lang === 'zh';
    ok(r.weight.kinds.includes('zombie') && r.weight.w1 > r.weight.w0 && r.weight.w2 > r.weight.w1, '基因生物路線多了喪屍危機；造了人工生命、做過延壽、實驗室外洩過，越容易遇上', r.weight);
    ok(r.rumor.wall && r.rumor.vGuard !== 'against', '口耳相傳：有人提「築牆封鎖」（要木頭石頭），守衛贊成', r.rumor);
    ok(r.arrive.out === 'hit' && r.arrive.n >= 1 && r.arrive.alive && r.arrive.notVote && r.arrive.notHere && r.arrive.look, '解藥沒做到 → 重創：一部分人變成喪屍（沒死），不投票、不跟人聊天，3D 外觀換掉', r.arrive);
    ok(r.arrive.night === 'town_square' && ['graveyard', 'town_square'].includes(r.arrive.day) && r.arrive.act === 'wandering' && /喪屍|zombie/i.test(r.arrive.town) && r.arrive.brief, '喪屍白天在墓園、晚上在廣場遊蕩；AI 知道鎮上有喪屍', r.arrive);
    ok(r.save.ids && r.save.isZ, '存讀檔：誰是喪屍都還在', r.save);
    ok(r.spread.bit >= 1 && r.spread.turned > r.spread.n0 - 1 && r.spread.cap && r.spread.left >= 5, '夜裡咬人、被咬兩天後發病；喪屍最多四成、至少留五個人', r.spread);
    ok(r.spread.killed >= 1 || r.spread.hid >= 1, '守衛清剿或家人幫忙瞞著', r.spread);
    ok(r.cure.after === 0 && r.cure.bit === 0 && r.cure.cured >= 1, '解藥做完 → 喪屍和被咬的人全部變回來', r.cure);
    ok(r.end.kind === 'zombie' && r.end.unl && r.end.flags === 0, '結束：寫進歷史、解鎖（之後任何城鎮都能打）、沒有人還是喪屍', r.end);
    ok(r.noCure.n >= 1 && r.noCure.dead && r.noCure.dc, '解藥一直沒做出來：最後的喪屍被圍住、算進死亡', r.noCure);
    ok(r.wall.yes < r.wall.no, '築了牆，變喪屍的人少很多', r.wall);
    ok(r.drift === 0, '銀幣守恆', r.drift);
    ok(r.ui.inCol && r.ui.detailSide && r.ui.cards === 8 && r.ui.on === 3, `手牌：世界級災厄在手牌那一欄自己一個區塊（八張，三種解鎖、黑日蓋著）`, r.ui);
    ok(r.ui.det && r.ui.lockedBtn && r.ui.labNoList && r.ui.filterOnly, '選了看詳情、沒解鎖的不能打；篩選「世界級」只看災厄；工坊不再列清單', r.ui);
    ok(r.ui.played.kind === 'zombie' && r.ui.played.src === 'lab' && r.ui.played.spent === 80 && r.ui.played.closed && r.ui.box, '從手牌發動：花 80 神力、抽屜收起；進行中手牌區塊看得到喪屍人數與解藥', r.ui.played);
    ok(!r.ui.undef && !r.ui.cjk.length && !r.ui.overflow && !r.ui.squash.length, `不破版（標題列、篩選列沒被擠扁）、沒有沒翻譯的字（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(posts.some(p => (p.unlocks?.worldcal || []).includes('iceage')), '新解鎖（撐過冰河期）幾秒後自動推上帳號', posts.slice(-2).map(p => p.unlocks));
    ok(r.ach.zb && r.ach.all, '成就：撐過喪屍危機、七種世界級災厄全部撐過（跟著帳號）', r.ach);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
