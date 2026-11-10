// v9.9.6 爸媽離開小鎮時 16 歲以下的小孩:另一個爸媽在鎮上就留下、犯罪被逐出由鎮上親戚收養、其他情況跟著走;成年的孩子留下;
// 出遠門的家人也繼承得到產業、房子、股份(回來就是他的,也記得這件事)
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
    const w = app.world; w.observerMode = true; for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
    const out = {}; const logs = () => (w.messageLog || []).map(m => m.content || '');
    const adults = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 20);
    // 測試用的家庭:把選到的人的家人關係清乾淨,只留測試設定的
    const isolate = (...L) => { for (const o of Object.values(w.agents)) { for (const a of L) { const rel = o.relationships?.relationships?.[a.agentId]; if (rel && ['married', 'dating'].includes(rel.status)) rel.status = 'friend'; if (o !== a && (o._parentNames || []).includes(a.name) && !L.includes(o)) o._parentNames = o._parentNames.filter(n => n !== a.name); } } for (const a of L) a._parentNames = []; };
    const rel = (a, b, st) => { a.relationships.getOrCreate(b.agentId, b.name).status = st; b.relationships.getOrCreate(a.agentId, a.name).status = st; };
    const kidOf = (age, ...ps) => { const c = adults().find(o => !ps.includes(o) && !o._testUsed); c._testUsed = true; isolate(c); c.age = age; c._parentNames = ps.map(p => p.name); return c; };
    const take = (n) => { const L = adults().filter(o => !o._testUsed).slice(0, n); L.forEach(o => { o._testUsed = true; }); isolate(...L); return L; };
    const ff = (id) => { const P = EXILE.S(w).pending[id]; if (P) P.until = w._absDay(); EXILE.S(w).lastDay = null; EXILE.daily(w); };
    try {
      // A. 單親自己搬走:10 歲的小孩跟著走,16 歲以上的留下
      { const [P] = take(1); const c = kidOf(10, P); const big = kidOf(19, P); w.leaveTown(P.agentId, 'test');
        out.follow = { pGone: !w.agents[P.agentId], kidGone: !w.agents[c.agentId], bigStay: !!w.agents[big.agentId], log: logs().slice(-6).some(s => /還小，跟著|still young/.test(s)) }; }
      // B. 爸媽一個走、一個留:小孩留下
      { const [P, Q] = take(2); rel(P, Q, 'married'); const c = kidOf(8, P, Q); w.leaveTown(P.agentId, 'test'); out.stay = { kidStay: !!w.agents[c.agentId], qStay: !!w.agents[Q.agentId] }; }
      // C. 犯罪被逐出:爺爺奶奶在鎮上 → 收養
      { const [G, P] = take(2); P._parentNames = [G.name]; const c = kidOf(9, P); EXILE.order(w, P, { crime: true, reason: 'test' }); ff(P.agentId);
        out.adopt = { pGone: !w.agents[P.agentId], kidStay: !!w.agents[c.agentId], adopted: (c._parentNames || []).includes(G.name) && c._guardian === G.agentId, gMem: (G.memory?.entries || []).slice(-10).some(m => /接來家裡養|took .* into my home/.test(m.content || '')), log: logs().slice(-10).some(s => /收養|taken in by/.test(s)) }; }
      // D. 犯罪被逐出但鎮上沒有親戚 → 跟著走;不是犯罪(自己搬走)就算有爺爺奶奶也跟著走
      { const [P] = take(1); const c = kidOf(7, P); EXILE.order(w, P, { crime: true, reason: 'test' }); ff(P.agentId); out.noRel = { kidGone: !w.agents[c.agentId] }; }
      { const [G, P] = take(2); P._parentNames = [G.name]; const c = kidOf(11, P); w.leaveTown(P.agentId, 'test'); out.notCrime = { kidGone: !w.agents[c.agentId], gStay: !!w.agents[G.agentId] }; }
      // E. 出遠門的配偶繼承產業、房子、股份
      { const [X, Y, Z] = take(3); rel(X, Y, 'married'); const M = MARKET.S(w); const K = Object.keys(MARKET.SECTORS);
        const k = K.find(q => M.owners[q] !== X.agentId) || K[0]; for (const q of K) { if (M.owners[q] === X.agentId) M.owners[q] = null; if (M.shares?.[q]) delete M.shares[q][X.agentId]; }
        M.owners[k] = X.agentId; M.shares[k] = { [X.agentId]: 100 };
        const k2 = K.find(q => q !== k) || K[1]; M.owners[k2] = Z.agentId; M.shares[k2] = { [Z.agentId]: 70, [X.agentId]: 30 };
        const u = Object.values(w.estate?.units || {}).find(z => !z.owner) || Object.values(w.estate?.units || {})[0]; if (u) u.owner = X.agentId;
        const Yid = Y.agentId; w.events._sendAgentTravelling(w, Y, 'test', 5); out.away = !w.agents[Yid] && w.isAway(Yid);
        X._deathCause = 'test'; w.lifecycle._killNpc(w, X);
        out.inh = { firm: M.owners[k] === Yid, house: !u || u.owner === Yid, share: (M.shares[k2] || {})[Yid] === 30, zKeeps: M.owners[k2] === Z.agentId };
        const tr = w.events._travellingAgents.find(t2 => t2.agentData.agentId === Yid); tr.returnTick = w.tickCount; w.events._checkReturningTravellers(w);
        const Y2 = w.agents[Yid]; out.back = { back: !!Y2, firm: M.owners[k] === Yid, mem: (Y2?.memory?.entries || []).slice(-40).some(m => /繼承了|inherited/.test(m.content || '')) }; }
    } catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
    return out;
  });
  console.log(lang, JSON.stringify(r));
  const tag = `[${lang}]`;
  ok(!r.err, `${tag} 跑完沒有例外`, r.err);
  ok(r.follow?.pGone && r.follow.kidGone && r.follow.log, `${tag} 單親搬走：10 歲的小孩跟著走`, r.follow);
  ok(r.follow?.bigStay, `${tag} 已經 16 歲以上的孩子留在鎮上`, r.follow);
  ok(r.stay?.kidStay && r.stay.qStay, `${tag} 爸媽一個走、一個留：小孩留在鎮上`, r.stay);
  ok(r.adopt?.pGone && r.adopt.kidStay && r.adopt.adopted && r.adopt.gMem && r.adopt.log, `${tag} 犯罪被逐出：小孩由鎮上的爺爺奶奶收養`, r.adopt);
  ok(r.noRel?.kidGone, `${tag} 犯罪被逐出但鎮上沒有親戚：小孩跟著走`, r.noRel);
  ok(r.notCrime?.kidGone && r.notCrime.gStay, `${tag} 不是犯罪（自己搬走）：小孩跟著爸媽走`, r.notCrime);
  ok(r.away && r.inh?.firm && r.inh.house, `${tag} 出遠門的配偶繼承得到產業和房子`, r.inh);
  ok(r.inh?.share && r.inh.zKeeps, `${tag} 出遠門的配偶繼承得到股份（別人當家的那家照舊）`, r.inh);
  ok(r.back?.back && r.back.firm && r.back.mem, `${tag} 回來後產業還是他的，也記得繼承了什麼`, r.back);
  ok(!errs.length, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) await run(browser, lang);
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
