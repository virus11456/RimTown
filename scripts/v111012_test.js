// v11.10.1 報社老闆過世或搬走後，報社不再永遠掛在他名下。
// 以前：老闆不在了，報社的老闆一欄一直顯示「已不在鎮上的人」，沒有人接手，有錢人也買不了（只有沒有東家的報社能買），他生前的人情還照樣壓新聞。
// 現在：交給還在鎮上的配偶或成年子女；沒有家人就變回沒有東家，可以再被買走。老闆只是出遠門時報社還是他的。舊存檔裡卡住的報社，換日時一併處理。
// 不連線、不呼叫 AI。用法：node scripts/v111012_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 600) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

const run = async (lang) => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
  let s = 5; const R1 = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; Math.random = R1;
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 44 }); w.observerMode = true; w.fullAgentMode = false;
  for (let i = 0; i < 96 * 2; i++) { w.paused = false; w.tick(); } w.paused = true;
  PRESS.S(w); POWER.S(w); const R = w.press; const P = w.power; const out = { lang };
  const papers = R.papers.filter(x => !['board', 'crown'].includes(x.st)); out.nPapers = papers.length;
  const Pp = papers[0]; Pp.banned = false;
  const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
  const rels = (a, b) => a.relationships.getOrCreate(b.agentId, b.name);
  const single = (a) => { for (const o of npcs()) { const r = o.relationships?.relationships?.[a.agentId]; if (r && (r.status === 'married' || r.status === 'dating')) r.status = 'friend'; } for (const r of Object.values(a.relationships?.relationships || {})) if (r.status === 'married' || r.status === 'dating') r.status = 'friend'; for (const o of npcs()) if ((o._parentNames || []).includes(a.name)) o._parentNames = o._parentNames.filter(n => n !== a.name); };
  const adults = () => npcs().filter(a => (a.age || 30) >= 20 && a.job?.key !== 'mayor' && !papers.some(x => x.owner === a.agentId));
  const logsSince = (n0) => (w.messageLog || w.log || []).slice(n0).map(m => (typeof m === 'string' ? m : String(m.content || m.text || m.message || '')));
  const logLen = () => (w.messageLog || w.log || []).length;
  const ownedView = () => POWER.view(w).owned;

  // 1) 過世、有配偶：配偶接手
  { const [a, b] = adults(); single(a); single(b); rels(a, b).status = 'married'; rels(b, a).status = 'married'; Pp.owner = a.agentId; P.inf[a.agentId] = { [b.agentId]: 30 };
    const n0 = logLen(); w.lifecycle._killNpc(w, a, 'test');
    out.death = { owner: Pp.owner === b.agentId, gone: !w.agents[a.agentId] || w.agents[a.agentId].isDead, infCleared: !P.inf[a.agentId], log: logsSince(n0).filter(x => /接手|taken over/.test(x)).slice(0, 1), mem: (b.memory?.entries || []).slice(-6).some(m => /現在是我的|is mine now/.test(m.content || '')), view: ownedView().find(x => x[0] === t(Pp.name[0])) || null, heirName: t(b.name) }; }
  // 2) 過世、沒有家人：變回沒有東家；之後有錢人可以再買
  { const [a, rich] = adults(); single(a); Pp.owner = a.agentId; const n0 = logLen(); w.lifecycle._killNpc(w, a, 'test');
    const free = !Pp.owner; const lg = logsSince(n0).filter(x => /沒有東家|no owner/.test(x)).slice(0, 1);
    for (const x of papers) if (x !== Pp && !x.owner) x.owner = rich.agentId === 'zz' ? null : 'tmp_hold'; // 只留這一家是空的
    WALLET.S(w).bal[rich.agentId] = 5000; for (const o of npcs()) if (o !== rich) WALLET.S(w).bal[o.agentId] = Math.min(WALLET.S(w).bal[o.agentId] || 0, 100);
    const R0 = Math.random; Math.random = () => 0.01; try { POWER.buyPapers(w, w._absDay()); } finally { Math.random = R0; }
    out.orphan = { free, log: lg, rebought: Pp.owner === rich.agentId, viewAfter: /已不在鎮上|left town/.test((ownedView().find(x => x[0] === t(Pp.name[0])) || [])[1] || '') };
    for (const x of papers) if (x.owner === 'tmp_hold') delete x.owner; }
  // 3) 搬走、有成年子女在鎮上：換日後子女接手
  { const [a, kid] = adults(); single(a); kid.age = 25; kid._parentNames = [a.name]; Pp.owner = a.agentId; const aName = a.name;
    w.leaveTown(a.agentId, 'test'); const before = Pp.owner === a.agentId; const stuckView = (ownedView().find(x => x[0] === t(Pp.name[0])) || [])[1] || '';
    P.lastDay = null; POWER.daily(w);
    out.moved = { before, stuckView, owner: Pp.owner === kid.agentId, kidName: t(kid.name), view: (ownedView().find(x => x[0] === t(Pp.name[0])) || [])[1] || '', aName: !!aName }; }
  // 4) 只是出遠門：報社還是他的；回來也還是
  { const [a] = adults(); single(a); Pp.owner = a.agentId; w.events._sendAgentTravelling(w, a, '去外地辦事', 3); const awayOk = !w.agents[a.agentId];
    P.lastDay = null; POWER.daily(w); out.away = { awayOk, still: Pp.owner === a.agentId, view: (ownedView().find(x => x[0] === t(Pp.name[0])) || [])[1] || '' }; }
  // 5) 舊存檔裡卡住的：老闆的代號已經查不到任何人（連名字都沒有）
  { const Pq = papers[1] || Pp; for (const x of papers) x.owner = 'ghost_' + x.id; P.inf['ghost_' + Pq.id] = { someone: 20 };
    const stuck = ownedView().filter(x => /已不在鎮上的人|someone who left town/.test(x[1])).length; const n0 = logLen();
    const d0 = w._absDay(); for (let i = 0; i < 96 * 2 && w._absDay() < d0 + 1; i++) { w.paused = false; w.tick(); } w.paused = true; // 讓時間自己走到換日
    out.legacy = { stuck, n: papers.length, cleared: papers.every(x => !x.owner || (w.agents[x.owner] && !w.agents[x.owner].isDead)), stillStuck: ownedView().filter(x => /已不在鎮上/.test(x[1]) || /left town/.test(x[1])).length, logs: logsSince(n0).filter(x => /沒有東家|no owner/.test(x)).length, inf: !P.inf['ghost_' + Pq.id] }; }
  // 6) 沒有東家之後，不再因為「老闆的人情」壓新聞
  { const [a, b] = adults(); for (const x of papers) delete x.owner; out.cap = { noOwner: POWER.captured(w, Pp, [a.agentId, b.agentId]) === false }; }
  // 7) 存檔讀檔
  { const [a] = adults(); Pp.owner = a.agentId; const data = JSON.parse(JSON.stringify(w.serialize())); const okLoad = w.loadSave(data); const P2 = w.press.papers.find(x => x.id === Pp.id); out.save = { okLoad: !!okLoad, owner: P2?.owner === a.agentId }; try { POWER.orphanPapers(w); out.save.noThrow = true; out.save.kept = w.press.papers.find(x => x.id === Pp.id)?.owner === a.agentId; } catch (e) { out.save.noThrow = false; out.save.err = String(e); } }
  return out;
};

(async () => {
  const browser = await chromium.launch();
  for (const lang of ['zh', 'en']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 });
    if (lang === 'en') await page.waitForFunction(() => window.I18N?.dictReady?.() !== false, null, { timeout: 30000 }).catch(() => {});
    const R = await page.evaluate(run, lang); const tag = lang === 'zh' ? '中文' : '英文';
    console.log('  ' + JSON.stringify(R).slice(0, 1500));
    ok(R.nPapers >= 1, `${tag} 這座鎮有民營報社`, R.nPapers);
    ok(R.death.owner && R.death.gone, `${tag} 老闆過世、有配偶：報社由配偶接手`, R.death);
    ok(R.death.log.length === 1 && R.death.mem, `${tag} 接手這件事有日誌，接手的人記得`, R.death);
    ok(R.death.view && R.death.view[1] === R.death.heirName, `${tag} 「報社老闆」那一欄顯示接手的人`, R.death.view);
    ok(R.death.infCleared, `${tag} 過世老闆欠的人情不再留著`, R.death.infCleared);
    ok(R.orphan.free && R.orphan.log.length === 1, `${tag} 老闆過世、沒有家人：報社變回沒有東家，日誌有寫`, R.orphan);
    ok(R.orphan.rebought, `${tag} 沒有東家的報社，有錢人可以再買（以前永遠買不了）`, R.orphan);
    ok(!R.orphan.viewAfter, `${tag} 「報社老闆」那一欄不再出現「已不在鎮上的人」`, R.orphan);
    ok(R.moved.before && R.moved.owner, `${tag} 老闆搬走、成年子女還在鎮上：換日後由子女接手`, R.moved);
    ok(R.moved.view === R.moved.kidName, `${tag} 搬走那一家的老闆欄顯示子女的名字`, R.moved);
    ok(R.away.awayOk && R.away.still, `${tag} 老闆只是出遠門：報社還是他的`, R.away);
    ok(R.legacy.stuck === R.legacy.n && R.legacy.cleared && R.legacy.stillStuck === 0, `${tag} 舊存檔裡卡住的報社（${R.legacy.stuck} 家都掛在查不到的人名下），時間走到換日就全部放出來`, R.legacy);
    ok(R.legacy.logs >= R.legacy.n && R.legacy.inf, `${tag} 放出來時每一家都有日誌，查不到的人的人情帳一併清掉`, R.legacy);
    ok(R.cap.noOwner, `${tag} 沒有東家的報社，不會再因為老闆的人情壓新聞`, R.cap);
    ok(R.save.okLoad && R.save.owner && R.save.noThrow && R.save.kept, `${tag} 存檔讀檔後老闆還在的報社照舊是他的，不出錯`, R.save);
    if (lang === 'en') ok(!/[一-鿿]/.test(JSON.stringify([R.death.log, R.orphan.log, R.death.view, R.moved.view])), `${tag} 日誌與老闆欄沒有殘留中文`, [R.death.log, R.orphan.log, R.moved.view]);
    ok(errs.length === 0, `${tag} 沒有程式錯誤`, errs.slice(0, 3));
    await page.context().close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
