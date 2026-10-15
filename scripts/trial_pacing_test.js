// 選跑:node scripts/trial_pacing_test.js   v6.22.0 B23 考驗失敗節奏回歸(有斷言,失敗 exit 1;需本機 8126 服務 wordpress/ 與 NODE_PATH 指到有 playwright 的 node_modules)
// 連續失敗:繁榮扣分累計不低於 −20、衰敗後每季最多走 1 人、人口不低於 8;撐過:先補回扣分;存讀檔保留 penalty
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch((() => { const e = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined); return e ? { executablePath: e } : {}; })()); const errs = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', (route) => { const u = route.request().url(); const m = route.request().method(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404); if (u.includes('/api/settings')) return json({ settings: {} }); return json({}); });
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt });
  await page.goto('http://127.0.0.1:8126/index.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const app = window.rimtownApp; const w = app.world; app._visitorMailboxTick(); w.paused = true; const o = {}; const fails = []; const ck = (c, m) => { if (!c) fails.push(m); };
    const tr = w.trials; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_')).length;
    const pop0 = npcs(); const qb0 = w.prosperity.questBonus || 0; o.pop0 = pop0;
    const failOnce = (i) => { tr.current = { type: 'famine', seasonKey: 'T' + i, status: 'active', target: 999, startAbsDay: 0, dueDay: 15, contrib: { food: 0, herb: 0, silver: 0 } }; tr._resolve(w, true); return { pop: npcs(), qb: w.prosperity.questBonus, declined: w.multiEnding?.endingTriggered === 'decline', penalty: tr.penalty }; };
    const steps = []; for (let i = 1; i <= 6; i++) steps.push(failOnce(i)); o.steps = steps;
    ck(steps[0].qb === qb0 - 10 && steps[1].qb === qb0 - 20 && steps[2].qb === qb0 - 20 && steps[5].qb === qb0 - 20 && tr.penalty === -20, 'penalty floor ' + JSON.stringify(steps.map(s => s.qb)));
    ck(steps[1].declined, 'declined after 2 fails');
    ck(steps[1].pop - steps[2].pop <= 1 && steps[2].pop - steps[3].pop <= 1, 'declined leavers ≤1/season ' + JSON.stringify(steps.map(s => s.pop)));
    ck(steps[5].pop >= Math.min(8, pop0), 'pop floor');
    // 人口下限:硬把人口壓到 8,再失敗一次不該有人走
    const extra = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && a.job?.key !== 'mayor').slice(0, Math.max(0, npcs() - 8)); extra.forEach(a => { delete w.agents[a.agentId]; }); const popAt8 = npcs();
    const s7 = failOnce(7); ck(popAt8 <= 8 ? s7.pop === popAt8 : true, 'no leavers at pop floor ' + popAt8 + '→' + s7.pop); o.popAt8 = [popAt8, s7.pop];
    // 撐過一季:補回 10 再 +5
    const qbBefore = w.prosperity.questBonus; tr.current = { type: 'famine', seasonKey: 'P1', status: 'active', target: 1, startAbsDay: 0, dueDay: 15, contrib: { food: 5, herb: 0, silver: 0 } }; tr._resolve(w, true);
    o.pass = { qbDelta: w.prosperity.questBonus - qbBefore, penalty: tr.penalty }; ck(o.pass.qbDelta === 15 && tr.penalty === -10, 'pass restores ' + JSON.stringify(o.pass));
    tr.current = { type: 'famine', seasonKey: 'P2', status: 'active', target: 1, startAbsDay: 0, dueDay: 15, contrib: { food: 5, herb: 0, silver: 0 } }; const qb2 = w.prosperity.questBonus; tr._resolve(w, true);
    o.pass2 = { qbDelta: w.prosperity.questBonus - qb2, penalty: tr.penalty, declined: w.multiEnding?.endingTriggered === 'decline' }; ck(o.pass2.qbDelta === 30 && tr.penalty === 0 && !o.pass2.declined, 'second pass clears penalty (+15) and revives (+15) ' + JSON.stringify(o.pass2));
    tr.current = { type: 'famine', seasonKey: 'P3', status: 'active', target: 1, startAbsDay: 0, dueDay: 15, contrib: { food: 5, herb: 0, silver: 0 } }; const qb3 = w.prosperity.questBonus; tr._resolve(w, true);
    ck(w.prosperity.questBonus - qb3 === 5, 'pass with no penalty is +5');
    // 存讀檔
    tr.penalty = -10; const sv = JSON.parse(JSON.stringify(w.serialize())); const W = new World(); W.loadSave(sv); ck(W.trials.penalty === -10, 'penalty saved');
    o.fails = fails; return o;
  });
  console.log(JSON.stringify(out)); if (out.fails.length) { console.log('FAIL', out.fails); process.exitCode = 1; }
  console.log('errors', errs); if (errs.length) process.exitCode = 1; await browser.close();
})();
