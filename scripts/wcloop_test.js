// v9.3.0 世界級災厄在「真正的遊戲迴圈」裡跑完整場（w.tick，每天 96 刻），不是直接呼叫每日結算：
// 喪屍：降臨後真的有喪屍、晚上在廣場白天在墓園、活動是遊蕩、不會出現在別人身邊的人群裡、不會參加提案投票；結束後沒有人還是喪屍
// 黑日：口耳相傳時真的有提案、三條戰線都有進度、結束寫進歷史；整段沒有錯誤、銀幣守恆、存檔不會暴增
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[WorldCal\]/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_worldcal', JSON.stringify(['nukewar', 'aliens', 'ai', 'infertile', 'zombie', 'iceage', 'rift'])); }, { jwt });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    try { app._visitorMailboxTick?.(); } catch (e) {}
    const people = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && !String(a.agentId).startsWith('visit_'));
    let k = 0; while (people().length < 30 && k++ < 40) { const n0 = Object.keys(w.agents).length; try { w.events?._spawnImmigrant?.(w); } catch (e) {} if (Object.keys(w.agents).length === n0) break; }
    const T = () => MONEY.total(w), P0 = () => MONEY.S(w).pend || 0; let drift = 0;
    // 只量世界級災厄自己經手的錢(每日結算、提案通過):整個鎮的錢本來就會因為對外貿易等正常管道進出
    for (const fn of ['daily', 'enact']) { const orig = WORLDCAL[fn]; WORLDCAL[fn] = function (...a) { const t0 = T(), p0 = P0(); try { return orig.apply(this, a); } finally { drift += (T() - t0) - (P0() - p0); } }; }
    let other = 0; const seenD = new Set(); const otherScan = () => { const D = MONEY.S(w).days || {}; const cur = w._absDay(); for (const k of Object.keys(D)) if (+k < cur && !seenD.has(k)) { seenD.add(k); other += +(D[k].other || 0); } };
    const tick = (n, each) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); if (i % 24 === 0) otherScan(); if (each) each(); } };
    const hour = () => w.clock?.hour ?? 12;
    // ---------- 喪屍:真實迴圈 ----------
    WORLDCAL.S(w).cool = 0; const c = WORLDCAL.begin(w, 'zombie', 'lab'); out.z = { began: !!c };
    let g = 0; while (w.worldcal.cur && w.worldcal.cur.ph !== 'after' && g++ < 40 * 96) tick(1);
    const zb = w.worldcal.cur?.zb; out.z.ph = w.worldcal.cur?.ph; out.z.n = zb?.ids?.length || 0; out.z.everTurned = zb?.st?.turned || 0;
    const stat = { night: 0, nightSq: 0, day: 0, dayGrave: 0, wander: 0, obs: 0, inCrowd: 0, voters: 0 };
    let seenZ = new Set(zb?.ids || []);
    tick(96 * 3, () => {
      const Z = w.worldcal.cur?.zb; if (!Z) return; for (const id of Z.ids) seenZ.add(id);
      const L = w.townMap?.locations || {};
      for (const id of Z.ids) { const a = w.agents[id]; if (!a || a.isDead) continue; stat.obs++;
        if (a.activity === 'wandering') stat.wander++;
        const h = hour(); const night = h >= 21 || h < 5; const mid = h >= 10 && h <= 16;
        if (night) { stat.night++; if (a.targetLocation === 'town_square' || !L.town_square) stat.nightSq++; } else if (mid) { stat.day++; if (a.targetLocation === 'graveyard' || !L.graveyard) stat.dayGrave++; }
        if (a.currentLocation && w.getAgentsAtLocation(a.currentLocation).includes(a)) stat.inCrowd++; }
      const npc = w.proposals?._npcs?.(w) || []; stat.voters += npc.filter(a => Z.ids.includes(a.agentId)).length;
    });
    out.z.stat = stat; out.z.seen = seenZ.size;
    g = 0; while (w.worldcal.cur && g++ < 40 * 96) tick(1);
    out.z.ended = !w.worldcal.cur; out.z.hist = w.worldcal.hist[0]?.kind; out.z.still = Object.values(w.agents).filter(a => WORLDCAL.isZombie(w, a)).length;
    // ---------- 黑日:真實迴圈 ----------
    WORLDCAL.S(w).cool = 0; const b = WORLDCAL.begin(w, 'blacksun', 'nature'); out.b = { began: !!b };
    const props = new Set(); g = 0; while (w.worldcal.cur && g++ < 120 * 96) { tick(1); for (const p of (w.proposals?.items || [])) if (/^wc_/.test(p.kind)) props.add(p.kind); if (w.worldcal.cur?.ph === 'arrive' && !out.b.fronts) out.b.fronts = { ...w.worldcal.cur.fronts }; }
    out.b.props = [...props].sort(); out.b.ended = !w.worldcal.cur; out.b.hist = w.worldcal.hist[0]?.kind; out.b.out = w.worldcal.hist[0]?.out;
    otherScan(); out.drift = Math.round(drift * 100) / 100; out.other = Math.round(other * 100) / 100; out.days = seenD.size;
    out.size = JSON.stringify(w.worldcal || {}).length;
    const sv = JSON.stringify(w.serialize()); out.saveOk = sv.length > 1000; try { w.loadSave(JSON.parse(sv)); out.reload = true; } catch (e) { out.reload = String(e); }
    return out;
  });
  const Z = r.z, s = Z.stat;
  ok(Z.began && Z.ph === 'after' && Z.everTurned >= 1, '喪屍（遊戲迴圈）：一路走到災後，真的有人變成喪屍', Z);
  ok(s.obs > 0 && s.wander / s.obs > 0.9, '喪屍的活動幾乎都是遊蕩', s);
  ok(s.night > 0 && s.nightSq / s.night > 0.9 && (s.day === 0 || s.dayGrave / s.day > 0.9), '喪屍晚上往廣場、白天往墓園', s);
  ok(s.inCrowd === 0 && s.voters === 0, '喪屍不會出現在別人看到的人群裡、不會被算進投票的人', s);
  ok(Z.ended && Z.hist === 'zombie' && Z.still === 0, '喪屍結束：寫進歷史、沒有人還是喪屍', Z);
  ok(r.b.began && r.b.ended && r.b.hist === 'blacksun' && ['averted', 'eased', 'hit'].includes(r.b.out), `黑日（遊戲迴圈）：完整跑完（結果：${r.b.out}）`, r.b);
  ok(r.b.props.includes('wc_fix') && r.b.props.includes('wc_ark') && r.b.props.includes('wc_focus'), '黑日：遊戲裡真的有人提「三線救亡」「地下方舟」「先救哪一線」', r.b.props);
  ok(r.b.fronts && Object.values(r.b.fronts).every(v => v > 0), '黑日：降臨前三條戰線都有進度', r.b.fronts);
  ok(Math.abs(r.drift) < 0.05, '兩場災厄經手的錢銀幣守恆（每日結算＋提案通過，整段遊戲迴圈）', r.drift);
  ok(Math.abs(r.other) < 1, `整段遊戲迴圈（${r.days} 天）沒有來路不明的錢（錢的流向都有記帳）`, r.other);
  ok(r.size < 20000 && r.saveOk && r.reload === true, `世界級災厄的存檔資料不大（${r.size} 字）、存讀檔正常`, { size: r.size, reload: r.reload });
  ok(!errs.length, '整段沒有錯誤', errs.slice(0, 5));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
