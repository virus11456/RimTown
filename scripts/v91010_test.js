// v9.10.1 名匠:每一行經驗最深的那一位(技能 15 級以上、一行一位、被超越一成五才換人) → 全鎮知道(只說一次)、工資多兩成、至少工匠商人、有錢人慕名訂做(錢進名匠口袋、銀幣守恆)、
// 收徒優先找名匠且 20 天出師;村民卡標籤、鎮況人數、AI 知道;
// 三個小錯誤:英文介面「無能」技能判斷、探險技能鍵、偷賢者之石的人挑研究最強的
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null;
    const w = app.world; w.observerMode = true; for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const out = {}; const logs = () => (w.messageLog || []).map(m => m.content || ''); const MB = MOBILITY.S(w);
    const all = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const adults = () => all().filter(a => (a.age ?? 30) >= 20);
    const used = new Set(); const take = (n) => { const L = adults().filter(o => !used.has(o.agentId)).slice(0, n); L.forEach(o => used.add(o.agentId)); for (const a of L) { a._parentNames = []; for (const [id, r0] of Object.entries(a.relationships?.relationships || {})) if (['married', 'dating'].includes(r0.status)) { r0.status = 'friend'; const r1 = w.agents[id]?.relationships?.relationships?.[a.agentId]; if (r1) r1.status = 'friend'; } } return L; }; // 清掉配偶與爸媽,階層才不會被家裡拉高
    const setLv = (a, sk, lv, extra = 0) => { const s0 = a.skills.get(sk); s0.passion = '無'; s0.xp = Math.floor(100 * lv * (1 + lv * 0.2)) + extra; };
    const fix = (v, f) => { const r0 = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = r0; } };
    try {
      // A. 英文介面「無能」也要判斷得到
      { const [X] = take(1); const s0 = X.skills.get('藝術'); s0.passion = '無能'; const xp0 = s0.xp; const up = X.skills.addXp('藝術', 500); out.incap = { inc: s0.isIncapable, xp: s0.xp === xp0, up }; s0.passion = '無'; }
      // B. 探險獎勵技能鍵查得到
      { const Z = (typeof EXPLORATION_ZONES !== 'undefined' ? EXPLORATION_ZONES : []); const X = adults()[0]; out.zone = { n: Z.length, allFound: Z.length > 0 && Z.every(z => !!X.skills.get(z.rewards.xpSkill)) }; }
      // C. 偷賢者之石:挑研究(智識)最強的人
      { let src = ''; for (const s of document.scripts) if ((s.src || '').includes('sim-longevity.js')) src = s.src; out.stone = { src: !!src }; }
      // D. 名匠:練到 15 級 → 日誌一次、工資多兩成、階層至少工匠商人
      { const [X, Y] = take(2); X.job = new Job('blacksmith'); Y.job = new Job('blacksmith'); setLv(X, '工藝', 10); setLv(Y, '工藝', 20); MB.day = null; CLASS.daily(w); const w0 = WALLET.wageOf(X); const was = MOBILITY.isMaster(X);
        for (const o of all()) if (o !== X && o.job?.key === 'blacksmith') setLv(o, '工藝', 20); setLv(X, '工藝', 20, 1e6); MB.mst.blacksmith = Y.agentId; // 經驗遠遠超過本行其他人
        const L0 = logs().length;
        MB.day = null; CLASS.daily(w); const w1 = WALLET.wageOf(X); w.wallet.bal[X.agentId] = 0; const nm = [X.name, t(X.name)]; const hit = (s) => /名匠|master/i.test(s) && nm.some(n => s.includes(n)); const n1 = logs().slice(L0).filter(hit).length; MB.day = null; CLASS.daily(w); const n2 = logs().slice(L0).filter(hit).length;
        out.master = { was, now: MOBILITY.isMaster(X), pay: Math.round(w1 / w0 * 100) / 100, n1, n2, lv: CLASS.level(w, X), brief: MOBILITY.brief(w, X) };
        app._showNpcCard?.(X.agentId); out.master.card = /名匠|Master/.test(document.querySelector('#npc-quick-card')?.innerText || ''); app._hideNpcCard?.();
        const B = app._townBlocks(null, ['tier']); out.master.panel = /名匠 \d+ 人|\d+ masters/.test(B.tier || '');
        // 慕名訂做:錢從有錢人付給名匠,全鎮總數不變
        const rich = adults().filter(o => o !== X && !MOBILITY.isMaster(o)); for (const o of rich.slice(0, 3)) { w.wallet.bal[o.agentId] = 1000; o.job = o.job || new Job('farmer'); }
        const c0 = WALLET.get(w, X), t0 = MONEY.total(w); const d3 = Math.ceil((w._absDay() - 3) / 7) * 7 + 3; fix(0.1, () => MOBILITY.masters(w, all(), d3));
        out.comm = { got: Math.round(WALLET.get(w, X) - c0), cons: Math.abs(MONEY.total(w) - t0) < 0.01 }; out.masterX = X.agentId; out.yLost = !MOBILITY.isMaster(Y); }
      // E. 收徒:名匠優先(就算交情比較淺),20 天出師
      { const [Mst, Pal] = take(2); const A = adults().filter(o => !used.has(o.agentId) && o !== Mst && o !== Pal).find(o => { o.job = new Job('farmer'); w.wallet.bal[o.agentId] = 30; delete CLASS.S(w).titles[o.agentId]; return CLASS.compute(w, o) <= 1; }); used.add(A.agentId); take(0); A.age = 20; // 學徒要找真的是平民以下的人(官職、頭銜都會拉高階層)
        for (const [id, r0] of Object.entries(A.relationships?.relationships || {})) if (['married', 'dating'].includes(r0.status)) r0.status = 'friend'; A._parentNames = []; A.personality.traits = ['hardworking']; delete MB.done[A.agentId];
        Mst.job = new Job('carpenter'); setLv(Mst, '建造', 20, 1e6); Pal.job = new Job('carpenter'); setLv(Pal, '建造', 5); w.wallet.bal[Pal.agentId] = 500;
        Mst.relationships.getOrCreate(A.agentId, A.name).affinity = 5; Pal.relationships.getOrCreate(A.agentId, A.name).affinity = 80;
        for (const id of Object.keys(MB.ap)) delete MB.ap[id]; MB.day = null; CLASS.daily(w); for (const id of Object.keys(MB.ap)) delete MB.ap[id];
        const d7 = Math.ceil(w._absDay() / 7) * 7; fix(0.1, () => MOBILITY.apprentice(w, [A, Mst, Pal], d7)); const P = MB.ap[A.agentId];
        out.appr = { m: P?.m === Mst.agentId, fast: !!P?.fast, dbg: { aLv: CLASS.level(w, A), aAge: A.age, aJob: A.job?.key, mM: MOBILITY.isMaster(Mst), mLv: CLASS.level(w, Mst), pLv: CLASS.level(w, Pal), aff: Mst.relationships.relationships[A.agentId]?.affinity, P: P ? P.m : null, away: [w.isAway(A.agentId), w.isAway(Mst.agentId)], ap: Object.keys(MB.ap).length, ex: !!w.exile?.pending?.[A.agentId] } };
        if (P) { P.d0 = w._absDay() - 20; MOBILITY.apprentice(w, [A, Mst, Pal], w._absDay() + 1); }
        out.appr.done = MB.done[A.agentId] === 'carpenter' && A.job?.key === 'carpenter'; out.appr.log = logs().slice(-8).some(s => /學了 20 天|20 days learning/.test(s)); }
      // F. 存讀檔:名匠紀錄留著
      { const sv = JSON.parse(JSON.stringify(w.serialize())); out.save = sv.mobility?.mst?.blacksmith === out.masterX; }
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
    return out;
  });
  // C. 偷賢者之石:原始碼不再用不存在的「研究」技能
  const lsrc = fs.readFileSync(path.join(__dirname, '..', 'chrome-extension', 'sim-longevity.js'), 'utf8');
  r.stone = { ...(r.stone || {}), fixed: !/get\?\.\('研究'\)/.test(lsrc) && /get\?\.\('智識'\)/.test(lsrc) };
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.incap && r.incap.inc && r.incap.xp && !r.incap.up, `${tag} 「無能」的技能判斷得到、不會長經驗（英文介面以前判斷不到）`, r.incap);
  ok(r.zone && r.zone.allFound, `${tag} 探險獎勵的技能查得到（英文介面以前查不到）`, r.zone);
  ok(r.stone && r.stone.fixed, `${tag} 偷賢者之石的人照研究（智識）高低挑`, r.stone);
  ok(r.master && !r.master.was && r.master.now && r.master.pay >= 1.19 && r.master.pay <= 1.21, `${tag} 本行經驗最深的人成了名匠，工資多兩成`, r.master);
  ok(r.yLost, `${tag} 一行只有一位名匠：被超越的人名號換人`, r.yLost);
  ok(r.master && r.master.n1 === 1 && r.master.n2 === 1, `${tag} 成為名匠全鎮知道，只說一次`, r.master);
  ok(r.master && r.master.lv >= 2, `${tag} 名匠靠手藝至少算工匠商人`, r.master);
  ok(r.master && r.master.card && r.master.panel && /名匠|master/.test(r.master.brief || ''), `${tag} 村民卡、鎮況、AI 都知道是名匠`, r.master);
  ok(r.comm && r.comm.got > 0 && r.comm.cons, `${tag} 有錢人慕名訂做：錢進名匠口袋，全鎮銀幣不變`, r.comm);
  ok(r.appr && r.appr.m && r.appr.fast, `${tag} 收徒優先找名匠（就算交情比較淺）`, r.appr);
  ok(r.appr && r.appr.done && r.appr.log, `${tag} 跟名匠學 20 天就出師`, r.appr);
  ok(r.save, `${tag} 名匠紀錄存得進存檔`, r.save);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
