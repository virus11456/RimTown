// v9.11.0 技能慢慢練:工作與日常活動的經驗 × SKILL_PACE、越高越難(÷(1+0.2×等級))、小數機率進位;
// 產量／施工／研究／看病公式跟著調;名匠門檻 10 級;跑 60 天平均主技能約 8 級(以前約 19 級)
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
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
    const w = app.world; w.observerMode = true; const out = {};
    try {
      out.pace = typeof SKILL_PACE === 'number' ? SKILL_PACE : null; out.mlv = MOBILITY.MASTER_LV;
      // A. 同一個人、同樣工作:0 級和 10 級各練 400 次,看經驗多少(10 級應該約 1/3)
      const A = Object.values(w.agents).find(a => !a.isPlayer && !a.isDead && JOB_SKILL_MAP[a.job?.key]?.primary?.[0]);
      const sk = JOB_SKILL_MAP[A.job.key].primary[0]; const S = A.skills.get(sk); S.passion = '無';
      const gain = (lv) => { let tot = 0; for (let i = 0; i < 400; i++) { S.xp = xpForLevel(lv); A.activity = 'working'; A._gainSkillXp(w); tot += S.xp - xpForLevel(lv); } return tot / 400; };
      const g0 = gain(0), g10 = gain(10); out.gain = { g0, g10, ratio: g10 / g0 };
      // B. 很小的經驗也練得起來(機率進位):把智慧調到最低、0 級的副技能
      const sec = JOB_SKILL_MAP[A.job.key].secondary?.[0]; const S2 = sec && A.skills.get(sec);
      if (S2) { S2.passion = '無'; S2.xp = xpForLevel(19); const before = S2.xp; for (let i = 0; i < 400; i++) { A.activity = 'working'; A._gainSkillXp(w); } out.tiny = S2.xp - before; }
      // C. 新公式
      const doc = { skills: { get: () => ({ level: 0 }) } }; const pat = { age: 30 };
      out.heal0 = HEALTH.successRate(w, pat, doc, 0); doc.skills.get = () => ({ level: 20 }); out.heal20 = HEALTH.successRate(w, pat, doc, 0);
      const resA = Object.values(w.agents).filter(a => !a.isPlayer && a.job?.key === 'researcher');
      out.research = resA.length ? { n: resA.length, pts: w.research._scholarPts(w) } : null;
      out.resSkill = resA.map(a => a.skills.get('智識')?.level || 0);
      // D. 跑 60 天:平均主技能大約 8 級、沒有人 20 級
      for (let i = 0; i < 60 * 96; i++) { w.paused = false; w.tick(); }
      const ws = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && JOB_SKILL_MAP[a.job?.key]?.primary?.[0]);
      const lvs = ws.map(a => a.skills.get(JOB_SKILL_MAP[a.job.key].primary[0])?.level || 0);
      out.year = { n: lvs.length, avg: lvs.reduce((s, x) => s + x, 0) / Math.max(1, lvs.length), max: Math.max(...lvs), at20: lvs.filter(x => x >= 20).length };
      out.mst = Object.entries(MOBILITY.S(w).mst || {}).map(([k, id]) => { const a = w.agents[id]; return a ? (MOBILITY.skillOfJob(a)?.lv || 0) : null; }).filter(x => x != null);
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
    return out;
  });
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.pace === 0.17 && r.mlv === 10, `${tag} 經驗倍率 0.17、名匠門檻 10 級`, { pace: r.pace, mlv: r.mlv });
  ok(r.gain && r.gain.g0 > 0.5 && r.gain.g0 < 4, `${tag} 新手一次工作的主技能經驗比以前少很多（約 1～2 點，以前 6～16）`, r.gain);
  ok(r.gain && r.gain.ratio > 0.2 && r.gain.ratio < 0.5, `${tag} 越高越難：10 級時一次只長新手的三分之一左右`, r.gain);
  ok(r.tiny > 0, `${tag} 很小的經驗用機率進位，19 級的副技能也還練得動`, r.tiny);
  ok(Math.abs(r.heal0 - 0.55) < 0.001 && Math.abs(r.heal20 - 0.85) < 0.001, `${tag} 看病：新手醫生 55%、20 級 85%（不算科技與建築）`, { h0: r.heal0, h20: r.heal20 });
  ok(!r.research || r.research.pts >= r.research.n * 7 * 0.8 - 0.01, `${tag} 研究：每位學者至少 7 點（新手也有貢獻）`, r.research);
  ok(r.year && r.year.n > 5 && r.year.avg >= 5 && r.year.avg <= 11 && r.year.at20 === 0, `${tag} 跑 60 天：平均主技能約 8 級、沒有人練滿 20 級`, r.year);
  ok(Array.isArray(r.mst) && r.mst.length > 0 && r.mst.every(x => x >= 10), `${tag} 名匠都在本行 10 級以上`, r.mst);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
