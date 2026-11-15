// v10.4.0 投票通過的規定可以再投票廢除
// 以前：禁賭、生物安全法、清潔空氣法這些規定一通過就是永久的，沒有任何辦法拿掉。
// 現在：實施滿 60 天後，鎮上夠多人覺得不該留，就會有人提「廢除某某規定」，全鎮再投一次票。
//  1) 禁賭：剛通過時不能提廢除；滿 60 天、有人想廢，就會有人提案；提案寫得出實施幾天、為什麼、廢除後會怎樣
//  2) 立場：把當初表決這條規定的立場反過來（愛賭的贊成廢除、清心寡慾的反對），理由沿用
//  3) 通過 → 禁令解除、可以再開賭場；60 天內不能馬上再立同一條。沒通過 → 90 天內不再提
//  4) 其他十條規定（生物安全法、藥價管制、禁基因作物、停止人體實驗、清潔空氣法、工廠法、禁造人造人、帳本公開、員工認股、公費醫療補助）都能廢除
//  5) 舊存檔沒記是哪天禁的：用賭場歇業那天；都沒有就從第一次看到那天算
//  6) 鎮況頁列出現行規定與可以提案廢除的時間；存檔讀檔保留；中文、英文
//  7) 同一塊地新舊兩家賭場：招牌不再每次互相改
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`);
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; const out = {}; const P = w.proposals; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    w.clock.year = 6; /* 鎮已經過了五年，「61 天前」才是正數 */ const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16); const d = w._absDay();
    const rnd = Math.random; const fixed = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = rnd; } };
    const repealOpen = () => P.items.filter(p => p.kind === 'law_repeal' && p.status === 'open');
    const tick = () => { REPEAL.S(w).lastDay = null; REPEAL.daily(w); };
    // ---------- 1) 禁賭 ----------
    const C = CASINO.S(w); for (const a of A) { delete C.v[a.agentId]; a.personality.traits = (a.personality.traits || []).filter(x => !['greedy', 'ascetic', 'kind'].includes(x)); }
    CASINO.enact(w, {});
    out.banned = { ban: C.ban, day: C.banDay === d, view: REPEAL.view(w).live.find(x => x.id === 'casino_ban') };
    fixed(0.001, tick); out.tooSoon = repealOpen().length;
    // 滿 60 天，可是沒什麼人想廢（大家都清心寡慾）：沒人提
    C.banDay = d - 61; for (const a of A) a.personality.traits.push('ascetic', 'kind');
    out.supNone = REPEAL.support(w, 'casino_ban').f; fixed(0.001, tick); out.noSupport = repealOpen().length;
    for (const a of A) a.personality.traits = a.personality.traits.filter(x => !['ascetic', 'kind'].includes(x));
    // 一半的人以前常去賭：有人提案
    const gamblers = A.slice(0, Math.ceil(A.length * 0.6)); for (const a of gamblers) C.v[a.agentId] = 6; const priest = A[A.length - 1]; priest.personality.traits.push('ascetic', 'kind');
    out.sup = REPEAL.support(w, 'casino_ban').f; fixed(0.001, tick);
    const p = repealOpen()[0]; out.prop = p ? { ref: p.refKey, title: P.title(p), desc: P._fill(p.dk, p.dp), by: p.by || p.proposer || null, kind: (typeof PROPOSAL_KINDS !== 'undefined' ? t(PROPOSAL_KINDS.law_repeal.label) : '') } : null;
    // 2) 立場：愛賭的贊成廢除、神職反對；跟當初表決禁賭的立場相反
    if (p) { const g = gamblers[0]; const orig = fixed(0.5, () => [CASINO.vote(w, { kind: 'casino_ban' }, g), CASINO.vote(w, { kind: 'casino_ban' }, priest)]);
      fixed(0.5, () => { P._ruleVote(w, p, g); P._ruleVote(w, p, priest); }); out.votes = { g: p.votes[g.agentId], gWhy: p.why[g.agentId], pr: p.votes[priest.agentId], prWhy: p.why[priest.agentId], orig: orig.map(x => x.v), whyText: [p.why[g.agentId], p.why[priest.agentId]].map(k => t(VOTE_WHY[k] || '')) }; }
    // 還有一件在表決時不會再提第二件
    fixed(0.001, tick); out.onlyOne = repealOpen().length;
    // 3a) 沒通過：90 天內不再提
    if (p) { P._decide(w, p, 'reject', 'mayor'); } out.afterReject = { ban: C.ban, status: p?.status };
    REPEAL.S(w).lastAny = -99; fixed(0.001, tick); out.retryBlocked = repealOpen().length; out.waitView = REPEAL.view(w).live.find(x => x.id === 'casino_ban')?.wait;
    // 3b) 90 天後再提、這次通過：禁令解除，可以再開賭場
    REPEAL.S(w).last.casino_ban = d - 91; REPEAL.S(w).lastAny = -99; fixed(0.001, tick); const p2 = repealOpen()[0];
    if (p2) P._decide(w, p2, 'approve', 'mayor'); await sleep(50);
    out.repealed = { made: !!p2, status: p2?.status, ban: C.ban, banDay: C.banDay, done: REPEAL.view(w).done.map(x => x.id), live: REPEAL.view(w).live.map(x => x.id), result: p2?.result || p2?.resultText || '', log: (w.log || w.messages || []).slice(-6).map(m => m.content || m.text || '').filter(x => /廢除|repeal/i.test(x)).length };
    // 60 天內不能馬上再立同一條；別的提案不受影響
    const cand = (kind) => ({ kind, key: kind + ':x' + Math.random(), jobs: [], make: () => ({ kind, key: kind + ':x', tk: '禁賭', tp: {}, dk: '{who}', dp: { who: A[0].name }, cost: {}, category: 'culture', jobBias: [] }) });
    const n0 = P.items.length; const blocked = P._createWith(w, P._abs(w), cand('casino_ban'), A[0]); const other = P._createWith(w, P._abs(w), cand('medaid'), A[0]);
    out.quiet = { blocked: blocked == null, other: !!other, quiet: REPEAL.quiet(w, 'casino_ban') }; if (other) P._decide(w, other, 'reject', 'mayor');
    REPEAL.S(w).done.forEach(x => { x.d = d - 61; }); out.quietOver = !REPEAL.quiet(w, 'casino_ban');
    // ---------- 4) 其他十條規定 ----------
    const setOn = { bio_safety: () => { BIO.S(w).law = d - 70; }, bio_price: () => { BIO.S(w).price = d - 70; }, bio_gmban: () => { BIO.S(w).gmban = d - 70; }, bio_halt: () => { BIO.S(w).halt = d - 70; },
      steam_air: () => { STEAM.S(w).air = d - 70; }, steam_factory: () => { STEAM.S(w).factory = d - 70; }, steam_homun: () => { STEAM.S(w).homunban = d - 70; },
      sh_audit: () => { SHARES.S(w).sh.law.audit = d - 70; }, sh_staff: () => { SHARES.S(w).sh.law.staff = d - 70; }, medaid: () => { HEALTH.setAid(w); w.health.medaidDay = d - 70; } };
    out.laws = {};
    for (const id of Object.keys(setOn)) {
      try { setOn[id](); const L = REPEAL.LAWS[id]; const on0 = L.on(w); const days = REPEAL.view(w).live.find(x => x.id === id)?.days; const v = fixed(0.5, () => REPEAL.vote(w, { refKey: id }, A[0]));
        const pp = REPEAL.propose(w, id, A[0]); const text = pp ? P.title(pp) + ' ' + P._fill(pp.dk, pp.dp) : ''; if (pp) P._decide(w, pp, 'approve', 'mayor');
        out.laws[id] = { on0, days, v: v.v, why: !!(v.why && t(VOTE_WHY[v.why] || '')), made: !!pp, off: !L.on(w), text };
      } catch (e) { out.laws[id] = { err: String(e.message || e) }; }
    }
    out.lawIds = Object.keys(REPEAL.LAWS);
    // ---------- 5) 舊存檔沒記是哪天禁的 ----------
    C.ban = true; C.banDay = undefined; w.things = w.things || { list: {} }; w.things.list = w.things.list || {}; w.things.list['casino:old'] = { id: 'casino:old', kind: 'casino', name: ['聚寶閣', 'Treasure Pavilion'], gone: true, goneDay: d - 25, place: 'casino' }; C.thing = 'casino:old';
    REPEAL.S(w).seen = {}; out.legacy1 = REPEAL.view(w).live.find(x => x.id === 'casino_ban')?.days;
    C.thing = null; REPEAL.S(w).seen = {}; out.legacy2 = REPEAL.view(w).live.find(x => x.id === 'casino_ban')?.days;
    // ---------- 6) 介面、存讀檔 ----------
    C.banDay = d - 25; BIO.S(w).law = d - 80; REPEAL.S(w).last = {}; // 當成這兩條都還沒被提過廢除
    document.querySelectorAll('[data-kairo-tab="economy"]').forEach(e => { if (e.offsetParent) e.click(); }); await sleep(300);
    app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'proposals'; app._ppTab = 'town'; app.renderSidebar(); await sleep(300);
    const box = document.querySelector('.pp-laws'); out.ui = box ? { text: box.innerText.replace(/\s+/g, ' ').trim(), rows: box.querySelectorAll('.pp-lore-row').length, inView: (() => { const b = box.getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth + 1; })() } : null;
    out.hs = document.documentElement.scrollWidth > innerWidth + 1;
    const sv = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(sv);
    out.save = { has: !!sv.repeal, done: (w2.repeal?.done || []).length, banDay: w2.casino?.banDay === d - 25, live: REPEAL.view(w2).live.map(x => x.id).sort().join(), reset: (() => { const w3 = new World(); w3.reset(); return w3.repeal == null; })() };
    // ---------- 7) 同一塊地新舊兩家：招牌不互相改 ----------
    try { const tm = app.tileMap; const T1 = THINGS.register(w, { kind: 'casino', key: 'tA', name: ['舊賭場', 'Old House'], icon: '🎰', facts: 'x', place: 'casino', usable: true, build: { tmpl: 'tavern' } }); THINGS.syncMap(w, tm);
      THINGS.retire(w, T1.id); THINGS.syncMap(w, tm); const lab1 = tm.labelPositions?.casino?.name;
      const T2 = THINGS.register(w, { kind: 'casino', key: 'tB', name: ['新賭場', 'New House'], icon: '🎰', facts: 'x', place: 'casino', usable: true, build: { tmpl: 'tavern' } });
      const c1 = THINGS.syncMap(w, tm), lab2 = tm.labelPositions?.casino?.name, c2 = THINGS.syncMap(w, tm), c3 = THINGS.syncMap(w, tm), lab3 = tm.labelPositions?.casino?.name;
      out.sign = { built: !!tm.buildingZones?.casino, lab1, lab2, lab3, c1, c2, c3 }; } catch (e) { out.sign = { err: String(e.message || e) }; }
    return out;
  });
  const zh = lang === 'zh'; const noZh = (s) => !/[一-鿿]/.test(s || '');
  ok(r.banned.ban && r.banned.day && r.banned.view && r.banned.view.days === 0 && r.banned.view.wait === 60, '禁賭通過：記下是哪一天；現行規定列得出來，60 天後才能提案廢除', r.banned);
  ok(r.tooSoon === 0, '剛通過的規定不能馬上提廢除', r.tooSoon);
  ok(r.supNone < 0.3 && r.noSupport === 0, '滿 60 天但沒什麼人想廢（鎮上都是清心寡慾的人）：不會有人提', { f: r.supNone, n: r.noSupport });
  ok(r.sup >= 0.3 && r.prop && r.prop.ref === 'casino_ban', '滿 60 天、夠多人想廢：有人提案廢除禁賭', { f: r.sup, prop: r.prop });
  ok(r.prop && (zh ? /廢除「禁賭」/.test(r.prop.title) && /已經實施 61 天/.test(r.prop.desc) && /可以再開賭場/.test(r.prop.desc) : /Repeal "Gambling ban"/.test(r.prop.title) && /61 days/.test(r.prop.desc) && noZh(r.prop.title + r.prop.desc + r.prop.kind)), '提案寫得出：哪條規定、實施幾天、為什麼、廢除後會怎樣' + (zh ? '' : '（英文沒有殘留中文）'), r.prop);
  ok(r.votes && r.votes.g === 'for' && r.votes.pr === 'against' && r.votes.orig[0] === 'against' && r.votes.orig[1] === 'for' && r.votes.whyText.every(Boolean), '立場跟當初表決禁賭時相反：愛賭的贊成廢除、清心寡慾的反對，各有理由', r.votes);
  ok(r.onlyOne === 1, '一件廢除案還在表決時，不會再冒出第二件', r.onlyOne);
  ok(r.afterReject.ban === true && r.retryBlocked === 0 && r.waitView > 0, '沒通過：禁令照舊，90 天內不再提同一條', { a: r.afterReject, n: r.retryBlocked, wait: r.waitView });
  ok(r.repealed.made && r.repealed.ban === false && r.repealed.done.includes('casino_ban') && !r.repealed.live.includes('casino_ban'), '90 天後再提、這次通過：禁令解除，從現行規定移到「表決廢除」', r.repealed);
  ok(r.quiet.blocked && r.quiet.other && r.quiet.quiet && r.quietOver, '廢除後 60 天內不能馬上再立同一條（別的提案不受影響），過了就可以', { q: r.quiet, over: r.quietOver });
  const L = r.laws; const ids = Object.keys(L); const bad = ids.filter(id => !(L[id].on0 && L[id].days === 70 && L[id].made && L[id].off && L[id].why && ['for', 'against'].includes(L[id].v)));
  ok(ids.length === 10 && bad.length === 0 && r.lawIds.length === 11, '其他十條規定都列得出來、提得出廢除案、通過後真的解除（連禁賭共 11 條）', { bad: bad.map(id => [id, L[id]]), n: r.lawIds.length });
  ok(zh || ids.every(id => noZh(L[id].text)), '每一條的提案文字' + (zh ? '都寫得出來' : '英文都沒有殘留中文'), zh ? null : ids.filter(id => !noZh(L[id].text)).map(id => L[id].text.slice(0, 80)));
  ok(r.legacy1 === 25 && r.legacy2 === 0, '舊存檔沒記是哪天禁的：用賭場歇業那天（25 天前）；都沒有就從今天算', { a: r.legacy1, b: r.legacy2 });
  ok(r.ui && r.ui.rows >= 2 && r.ui.inView && !r.hs && (zh ? /現行規定/.test(r.ui.text) && /禁賭/.test(r.ui.text) && /再 35 天後可以提案廢除/.test(r.ui.text) && /生物安全法/.test(r.ui.text) && /可以提案廢除/.test(r.ui.text) : /Rules in force/.test(r.ui.text) && /in 35 days/.test(r.ui.text) && noZh(r.ui.text)), '鎮況頁列出現行規定、實施幾天、什麼時候可以提案廢除', r.ui);
  ok(r.save.has && r.save.done >= 1 && r.save.banDay && r.save.live === 'bio_safety,casino_ban' && r.save.reset, '存檔讀檔保留（哪天禁的、廢除紀錄）；開新鎮清空', r.save);
  ok(r.sign && r.sign.built && (r.sign.lab1 || '').length > 0 && r.sign.lab2 === r.sign.lab3 && r.sign.lab2 !== r.sign.lab1 && r.sign.c2 === false && r.sign.c3 === false, '同一塊地舊的歇業、新的開張：招牌換成新的那家，之後不再每次互相改', r.sign);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
