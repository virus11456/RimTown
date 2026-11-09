// v9.5.1 玩法完善:舊「夢想」併進心願／人生劇本、日誌不洗版、英文人名、話題門檻
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(lang) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html'); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  if (lang === 'en') await page.evaluate(() => new Promise(r => I18N.ensureDict(r)));
  const r = await page.evaluate(() => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; try { app._visitorMailboxTick?.(); } catch (e) {}
    const P = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18); const out = {};
    // 舊夢想停用、改看心願
    w.lifeGoals.dailyUpdate(w); out.oldGoal = w.lifeGoals.getGoal(P[0].agentId); out.stateGoals = Object.keys(w.getState().lifeGoals || {}).length;
    const M = MIND.S(w); M.amb[P[0].agentId] = { key: 'craft', since: w._absDay(), st: 0 };
    out.craft = { amb: !!MIND.AMB.craft, steps: ARCS.total(M.amb[P[0].agentId]), line: ARCS.lineFor(w, P[0]), plan: !!ARCS.planT(w, P[0]) };
    try { app.state = w.getState(); app._showNpcCard(P[0].agentId); out.card = document.getElementById('npc-quick-card')?.textContent || ''; } catch (e) { out.cardErr = String(e); }
    // 技能升級只記 5 的倍數
    const logs = []; const lm = w.logMessageT; w.logMessageT = function (type, k, p, ...r) { logs.push({ type, k, p }); return lm.call(this, type, k, p, ...r); };
    const a = P[1]; a.job = new Job('farmer'); const sk = a.skills.get('種植'); let ups = 0;
    for (let i = 0; i < 6000 && ups < 10; i++) { const lv0 = a.skills.get('種植').level; a.activity = 'working'; a._gainSkillXp ? a._gainSkillXp(w) : (a.skills.addXp('種植', 50)); if (a.skills.get('種植').level > lv0) ups++; }
    const sl = logs.filter(x => x.type === 'skill_up'); out.skill = { ups, logged: sl.length, levels: sl.map(x => x.p.level) };
    // 英文:沒有模板的舊式訊息人名換成英文
    w.logMessage('event', `${P[2].name}被送去診所了！`, P[2].name); const m = w.messageLog[w.messageLog.length - 1]; out.plain = World.logText ? World.logText(m) : m.content; out.zhName = P[2].name;
    // 話題門檻:重要度 6 不進池、單一則 9 只醞釀
    w.buzz = null; w.dailyNews.collectEvent('event', '小事一件', 6, [P[3].name]); out.b6 = BUZZ.S(w).items.length;
    w.dailyNews.collectEvent('event', '大事一件', 9, [P[3].name]); BUZZ.daily(w); out.b9 = BUZZ.S(w).items[0]?.ph;
    // 出生軟上限:人口到目標還是生得出來,遠超過才不生
    { const ad = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18);
      const m = ad.find(a => a.gender === 'male'), f = ad.find(a => a.gender === 'female' && !a.relationships.getPartner());
      if (m && f) { m.age = 28; f.age = 27; const r1 = m.relationships.getOrCreate(f.agentId, f.name), r2 = f.relationships.getOrCreate(m.agentId, m.name); r1.status = 'married'; r2.status = 'married';
        const E = w.events; const tp0 = E.TARGET_POPULATION; const born = () => (w.lifecycle.births || []).length; const r0 = Math.random; Math.random = () => 0;
        try { const pop = Object.values(w.agents).filter(a => !a.isPlayer).length; E.TARGET_POPULATION = pop; const b0 = born(); w.lifecycle._checkBirths(w); out.atCap = born() - b0;
          E.TARGET_POPULATION = 20; let g = 0; while (Object.values(w.agents).filter(a => !a.isPlayer).length < 31 && g++ < 30) { try { E._spawnImmigrant(w); } catch (e) { break; } }
          const pop2 = Object.values(w.agents).filter(a => !a.isPlayer).length; const b1 = born(); w.lifecycle._checkBirths(w); out.overCap = born() - b1; out.tp = [pop, pop2, E.TARGET_POPULATION];
        } finally { Math.random = r0; E.TARGET_POPULATION = tp0; } } }
    w.logMessageT = lm; return out;
  });
  const cjk = /[一-鿿]/;
  console.log(`— ${lang} —`);
  ok(r.oldGoal === null && r.stateGoals === 0, '觀察者模式停用舊的「夢想」（不再全鎮一起推進、不再跟心願重複）', r);
  ok(r.craft.amb && r.craft.steps === 3 && r.craft.plan && r.craft.line.length > 0, '「技藝登峰」併進心願，分三步走，每日計畫看得到', r.craft);
  ok(r.skill.ups >= 6 && r.skill.levels.every(l => l % 5 === 0), `技能升級只記 5、10、15 級（升了 ${r.skill.ups} 級、記了 ${r.skill.logged} 則）`, r.skill);
  ok(!/的夢想「|dream "/.test(r.card || ''), '村民卡不再出現舊的夢想', (r.card || '').slice(0, 120));
  ok(r.b6 === 0 && r.b9 === 'brew', '重要度 6 的小事不進話題池；單一則重要新聞只醞釀', r);
  if (lang === 'en') ok(!/ & /.test(r.card || '') && !/王麗|陳偉/.test(r.card || ''), 'English: villager card relationship lines are whole sentences with English names', (r.card || '').replace(/\s+/g, ' ').match(/💍[^🧺]*/)?.[0]);
  if (lang === 'en') ok(!!r.plain && !(r.plain || '').includes(r.zhName), 'English: plain (non-template) logs show English names', { plain: r.plain, zh: r.zhName });
  ok(r.atCap >= 1 && r.overCap === 0, `人口到目標還生得出孩子；遠超過目標才不生（到目標生了 ${r.atCap}、超過生了 ${r.overCap}）`, r);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 5));
  await browser.close();
}
(async () => { await run('zh'); await run('en'); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
