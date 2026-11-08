// v7.9.0 大災之後的文明倒退：摧毀分數 → 輕度／中度／重度／毀滅、第一二時代不失傳、從最高時代往下、對策成功最多輕度、
// 文書房／印刷坊／學堂／研究院／研究員／文字與印刷術讓科技有機會保住、前置失傳後面跟著失傳、殘卷（三到六成進度）、
// 靠失傳科技開的建築停擺、重新研究出來（日誌、恢復建築）、病原體結束與核災會觸發、存讀檔、科技分頁顯示（中英、桌機與 390px）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const R = w.research; const C = CALAMITY.S(w); const P = R.projects;
      // 主線第一到第五時代全研究完(不含路線、精進)
      for (let more = true; more;) { more = false; for (const p of Object.values(P)) if ((p.era || 1) <= 5 && !p.path && p.key !== 'refine' && p.status !== 'complete' && (p.prerequisites || []).every(k => P[k]?.status === 'complete')) { p.status = 'complete'; p.progress = p.cost; more = true; } } R.current = null; R.refreshLocks();
      const snap = () => Object.fromEntries(Object.entries(P).map(([k, p]) => [k, [p.status, p.progress]]));
      const restore = (s) => { for (const [k, [st, pr]] of Object.entries(s)) { P[k].status = st; P[k].progress = pr; } C.lost = {}; C.regs = []; R.current = null; };
      const S0 = snap(); const doneN = () => Object.values(P).filter(p => p.status === 'complete').length;
      const chainOk = () => Object.values(P).every(p => p.status !== 'complete' || (p.prerequisites || []).every(k => P[k]?.status === 'complete'));
      const low = () => Object.values(P).filter(p => (p.era || 1) <= 2 && p.status !== 'complete' && S0[p.key][0] === 'complete').length;
      // 1) 四種程度(保存率 0,只看分數)
      const tiers = {};
      for (const [nm, sc] of [['light', 10], ['moderate', 30], ['heavy', 55], ['catastrophic', 90]]) {
        restore(S0); const n0 = doneN(); const rg = CALAMITY.regress(w, 'Test', sc, { keep: 0 });
        const lostP = rg.lost.map(k => P[k]); const minLostEra = Math.min(...Object.entries(C.lost).filter(([, x]) => x.why === 'lost').map(([k]) => P[k].era || 1));
        const surviveTop = Math.max(0, ...Object.values(P).filter(p => p.status === 'complete' && (p.era || 1) >= 3).map(p => p.era || 1));
        tiers[nm] = { tier: rg.tier, lost: n0 - doneN(), low: low(), chain: chainOk(), scroll: lostP.every(p => p.progress >= p.cost * 0.3 - 1 && p.progress <= p.cost * 0.6 + 1 && p.status !== 'complete'), top: !rg.lost.length || surviveTop <= minLostEra, marked: rg.lost.every(k => C.lost[k]) };
      }
      out.tiers = tiers;
      // 2) 對策成功最多輕度
      restore(S0); out.countered = CALAMITY.regress(w, 'Test', 90, { countered: true, keep: 0 }).tier;
      // 3) 保存:有文書房、印刷坊、學堂、研究院、研究員 → 保住的機率比較高;保存率 100% 一項都不會失傳
      restore(S0); const bare = CALAMITY.keepChance(w);
      for (const k of ['archive', 'press', 'school', 'institute']) if (!w.buildings.completed.some(b => b.buildingKey === k)) w.buildings.completed.push({ buildingKey: k, name: BUILDING_TEMPLATES[k].name, level: 1, effects: { ...(BUILDING_TEMPLATES[k].effects || {}) } });
      const rs = npcs().slice(0, 3); const keepJobs = rs.map(a => a.job); for (const a of rs) a.job = new Job('researcher');
      const rich = CALAMITY.keepChance(w); rs.forEach((a, i) => { a.job = keepJobs[i]; });
      const all = CALAMITY.regress(w, 'Test', 90, { keep: 1 }); out.keep = { bare, rich, savedAll: all.lost.length === 0 && all.saved > 0 };
      // 4) 停擺:印刷術失傳 → 印刷坊停擺、研究加成少了;重新研究出來 → 恢復、寫日誌
      restore(S0); w.buildings.recomputeEffects(w); const rb0 = w.buildings.getEffect('research_bonus', 0);
      const rp = CALAMITY.regress(w, 'Test', 100, { keep: 0, only: ['printing'] }); const dorm = CALAMITY.dormant(w).map(b => b.buildingKey);
      const rb1 = w.buildings.getEffect('research_bonus', 0);
      const pr = P.printing; const prog = pr.progress; R.refreshLocks(); const avail = pr.status;
      pr.progress = pr.cost - 0.01; R.startResearch('printing'); w.stockpile.add?.('research_points', 50); R.dailyUpdate(w);
      const logTxt = (w.messageLog || []).slice(-30).map(m => String(m.content || '')).join('\n');
      out.dorm = { lost: rp.lost.includes('printing'), press: dorm.includes('press'), drop: rb1 < rb0 - 0.05, scroll: prog >= pr.cost * 0.3 - 1 && prog <= pr.cost * 0.6 + 1, avail, back: pr.status === 'complete' && !C.lost.printing, redisc: C.redisc >= 1, undorm: !CALAMITY.dormant(w).some(b => b.buildingKey === 'press'), restored: w.buildings.getEffect('research_bonus', 0) > rb1 + 0.1, log: /重新研究出來|rediscovered/i.test(logTxt), lostLog: /失傳|lost/i.test(logTxt) };
      // 5) 病原體結束:死的人多 → 重度以上;疫苗做出來了 → 最多輕度
      const endWith = (died, fled, vax) => { restore(S0); C.cur = null; C.coolTo = 0; C.power = 100; const rl = CALAMITY.release(w, { name: 'T', route: ['droplet'], sym: ['cough'] }); const X = C.cur; if (!X) return { rl };
        for (const id of Object.keys(X.st)) X.st[id].s = 'R'; X.pop0 = 30; X.died = died; X.fled = fled; X.quiet = 5; X.vax = vax ? { p: 1, need: 1, done: 1 } : null;
        CALAMITY.daily(w); const h = C.hist[0]; return { over: !C.cur, reg: h?.reg || null }; };
      out.pa = { heavy: endWith(6, 3, false), cured: endWith(6, 3, true), mild: endWith(0, 1, false) };
      // 6) 核災也會觸發
      restore(S0); let mt = null; try { mt = TECH.meltdown(w); } catch (e) { mt = String(e); } out.melt = { ran: !!mt, reg: C.regs[0]?.c || null };
      // 7) 存讀檔
      restore(S0); CALAMITY.regress(w, 'Test', 90, { keep: 0 }); const lostKeys = Object.keys(C.lost).sort(); const data = w.serialize(); const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(data)));
      out.save = { n: lostKeys.length, same: JSON.stringify(Object.keys(w2.calamity?.lost || {}).sort()) === JSON.stringify(lostKeys), status: lostKeys.every(k => w2.research.projects[k].status !== 'complete'), regs: (w2.calamity?.regs || []).length };
      // 8) 科技分頁
      app.state = w.getState(); const mobile = window.innerWidth <= 768;
      const openTab = async (tab) => { if (mobile) app._openKairoTab(tab); else { app.activeTab = tab; app.renderSidebar(); } await new Promise(r => setTimeout(r, 300)); };
      const pane = () => (mobile ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content')) || document.body;
      await openTab('econ-tech'); const box = pane().querySelector('.tech-lost'); const txt = (box?.innerText || '') + '\n' + [...pane().querySelectorAll('.tech-scroll')].map(e => e.innerText).join('\n');
      out.ui = { box: !!box, scrolls: pane().querySelectorAll('.tech-scroll').length, undef: /undefined|NaN|\{[a-z]+\}/.test(txt), cjk: (txt.match(/[一-鿿]+/g) || []).slice(0, 6), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      return out;
    });
    const T = r.tiers;
    ok(T.light.tier === 'light' && T.moderate.tier === 'moderate' && T.heavy.tier === 'heavy' && T.catastrophic.tier === 'catastrophic', '摧毀分數決定程度：輕度／中度／重度／毀滅', T);
    ok(T.light.lost <= T.moderate.lost && T.moderate.lost < T.heavy.lost && T.heavy.lost < T.catastrophic.lost && T.moderate.lost > 0, '越嚴重失傳越多', Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.lost])));
    ok(Object.values(T).every(v => v.low === 0), '第一、二時代的基本功不會失傳', T);
    ok(Object.values(T).every(v => v.top), '從最高的時代開始失傳', T);
    ok(Object.values(T).every(v => v.chain), '前置失傳了，後面的科技也跟著失傳', T);
    ok(Object.values(T).every(v => v.scroll && v.marked), '失傳的科技留下殘卷（三到六成進度）、有記號', T);
    ok(r.countered === 'light', '人類的對策成功了，最多只有輕度倒退', r.countered);
    ok(r.keep.rich > r.keep.bare + 0.3 && r.keep.rich <= 0.75 && r.keep.savedAll, '文書房、印刷坊、學堂、研究院、研究員讓學問比較保得住', r.keep);
    ok(r.dorm.lost && r.dorm.press && r.dorm.drop && r.dorm.scroll && r.dorm.avail === 'available' && r.dorm.lostLog, '印刷術失傳：印刷坊停擺、研究加成不見、殘卷可以接著研究', r.dorm);
    ok(r.dorm.back && r.dorm.redisc && r.dorm.undorm && r.dorm.restored && r.dorm.log, '重新研究出來：寫進日誌、印刷坊恢復', r.dorm);
    ok(r.pa.heavy.over && ['heavy', 'catastrophic'].includes(r.pa.heavy.reg?.tier) && r.pa.cured.reg?.tier === 'light' && r.pa.mild.over && !r.pa.mild.reg, '病原體結束：死很多人 → 重度倒退；疫苗做出來 → 輕度；沒什麼死傷 → 不倒退', r.pa);
    ok(r.melt.ran && r.melt.reg, '核災之後也會文明倒退', r.melt);
    ok(r.save.n > 0 && r.save.same && r.save.status && r.save.regs > 0, '存讀檔：失傳的科技、紀錄都在', r.save);
    ok(r.ui.box && r.ui.scrolls > 0 && !r.ui.undef && !r.ui.overflow, '科技分頁：失傳的科技、殘卷、停擺的建築', r.ui);
    if (lang === 'en') ok(!r.ui.cjk.length, '英文沒有中文', r.ui.cjk);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
