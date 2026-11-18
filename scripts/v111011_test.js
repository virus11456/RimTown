// v11.10.1 罷免成功要寫進從政履歷。以前被罷免的人不能參選，改選結束時被記成「沒有再參選，交棒」。
// 做法：開一座鎮跑幾天，罷免現任首長（兩條路各一次：全鎮表決通過 REPEAL.recallEnact、醜聞連署 POWER.recall），再讓時間走到改選結束，看他的履歷最後一段首長任期怎麼卸任的。
// 不連線、不呼叫 AI。用法：node scripts/v111011_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 600) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

const run = async (how) => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
  let s = 11; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 31 }); w.observerMode = true; w.fullAgentMode = false;
  for (let i = 0; i < 96 * 4; i++) { w.paused = false; w.tick(); }
  const E = w.election; const out = { how };
  // 這幾天裡要是剛好在選舉，先讓它選完
  for (let i = 0; i < 96 * 12 && E.active; i++) { w.paused = false; w.tick(); }
  const L = E._officeHolder(w); if (!L) return { err: 'no leader' };
  TIERS.track(w); const T = TIERS.S(w); const open0 = (T.career[L.agentId] || []).filter(x => x.role === 'leader' && x.to === null).length;
  out.open0 = open0; out.name = !!L.name; const day0 = w._absDay();
  const asker = Object.values(w.agents).find(a => !a.isDead && !a.isPlayer && a !== L && (a.age || 30) >= 18);
  let res;
  if (how === 'vote') res = REPEAL.recallEnact(w, { kind: 'recall', refKey: L.agentId, proposerId: asker.agentId, votes: {} });
  else { // 另一條路：醜聞累積、民怨夠高，大家連署罷免（sim-power.js）。把醜聞與民怨造到門檻以上，再叫它自己判斷
    const P = POWER.S(w); P.scandal[L.agentId] = 5; P.recallDay = -999;
    for (const a of Object.values(w.agents)) { if (a === L || a.isDead || a.isPlayer) continue; const r = a.relationships?.getOrCreate?.(L.agentId, L.name); if (r) r.affinity = -40; }
    const n0 = P.stats.recalls || 0; POWER.recall(w, w._absDay()); res = (P.stats.recalls || 0) > n0 ? 'scandal recall' : 'not triggered';
  }
  out.res = String(res || ''); out.hint = T.endHint?.[L.agentId] || null; out.electing = !!E.active; out.stillMayor = L.job?.key === 'mayor'; out.barred = TIERS.qualified(w, L) === false;
  for (let i = 0; i < 96 * 20; i++) { w.paused = false; w.tick(); const h = E._officeHolder(w); if (!E.active && h && h !== L) break; }
  TIERS.track(w); const c = (T.career[L.agentId] || []).filter(x => x.role === 'leader'); const last = c[c.length - 1] || null;
  const now = E._officeHolder(w);
  out.days = w._absDay() - day0; out.newLeader = !!now && now !== L; out.last = last ? { to: last.to !== null, e: last.e || null } : null; out.hintLeft = T.endHint?.[L.agentId] || null;
  // 村民詳情裡的完整履歷，以及 AI 題目裡「你的從政經歷」那一句
  const rows = TIERS.resume(w, L).filter(r => r.role === 'leader'); out.notes = rows[0] ? rows[0].notes : [];
  out.brief = String(TIERS.careerBrief(w, L) || '');
  const lang = I18N.getLang(); I18N.setLang?.('en'); out.briefEn = String(TIERS.careerBrief(w, L) || ''); out.notesEn = (TIERS.resume(w, L).filter(r => r.role === 'leader')[0] || {}).notes || []; I18N.setLang?.(lang);
  return out;
};

(async () => {
  const browser = await chromium.launch();
  for (const how of ['vote', 'scandal']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
    const R = await page.evaluate(run, how); const tag = how === 'vote' ? '全鎮表決罷免' : '醜聞連署罷免';
    console.log('  ' + JSON.stringify(R).slice(0, 700));
    ok(!R.err && R.open0 === 1, `${tag}：開始時現任首長的履歷有一段還沒結束的任期`, R);
    ok(R.hint === 'recall' || (R.last && R.last.e === 'recall'), `${tag}：罷免成立那一刻就記下「被罷免」`, { hint: R.hint, last: R.last });
    ok(R.barred, `${tag}：被罷免的人這次不能選`, R.barred);
    ok(R.newLeader, `${tag}：之後選出了新的首長`, { days: R.days, electing: R.electing });
    ok(R.last && R.last.to && R.last.e === 'recall', `${tag}：履歷上這段任期的結束原因是「被罷免下台」（以前是「沒有再參選，交棒」）`, R.last);
    ok(R.notes.includes('被罷免下台') && !R.notes.some(x => /沒有再參選/.test(x)), `${tag}：村民詳情的履歷寫「被罷免下台」`, R.notes);
    ok(/被罷免下台/.test(R.brief) && !/沒有再參選/.test(R.brief), `${tag}：AI 題目裡「你的從政經歷」也寫被罷免`, R.brief);
    ok(/recalled from office/.test(R.briefEn) && R.notesEn.includes('recalled from office') && !/[\u4e00-\u9fff]/.test(R.briefEn + R.notesEn.join('')), `${tag}：英文版也有，沒有殘留中文`, { b: R.briefEn, n: R.notesEn });
    ok(R.hintLeft === null, `${tag}：記下的原因用掉了，不會留到下一次卸任`, R.hintLeft);
    ok(errs.length === 0, `${tag}：沒有程式錯誤`, errs.slice(0, 3));
    await page.context().close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
