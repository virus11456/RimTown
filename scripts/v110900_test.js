// v11.9.0 家庭、王令、使節，以及把固定的制度開放給提案（選擇點登記在 sim-decide-home.js）
//   A) 家庭：要不要生孩子（答案只改機率）、立遺囑（照遺囑分、被少分的家人有感覺）、家人沒錢吃飯接不接濟（不問 AI）、親戚的孩子接不接、
//      國王挑誰成婚（被挑上的人走原本的「對方向你求婚」，可以拒絕）、被嫁到盟邦的人答應／拒絕／逃婚
//   B) 王令與使節：這一道王令（七種，各自照原本結算）、這一季的外交（派誰出使，被挑上的人可以推辭）、
//      王位／議員遞補／代理首長接不接（不接往下找）、醜事被揭穿後四種反應的後果、下台以後做什麼
//   C) 三種新提案：偷竊罰則、暫停收新移民、公職薪水高低（提出、表決、生效、失效）
//   共同：登記與額度、事實裡的數字與交情對得上、交情與個性改變傾向、問不到時走舊規則、一個人不會被重複問、存讀檔、
//         開 AI 時題目送出與回答被採用、英文題目沒有中文（逐一檢查這個檔裡每一句中文都有英文）、放著跑 120 天沒有錯誤、錢守恆
// 用法：BASE=http://localhost:8185/ node scripts/v110900_test.js（需要本機伺服器服務 chrome-extension/）
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8185/'; const LONG = +(process.env.LONG || 120);
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const KEYS = ['birthPlan', 'will', 'feedHelp', 'adopt', 'royalPick', 'wedAway', 'decree', 'diploSeason', 'postOffer', 'scandal', 'afterOffice'];
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { const x = m.text(); const mine = /\[Decide\] (run|options|ai) (birthPlan|will|feedHelp|adopt|royalPick|wedAway|decree|diploSeason|postOffer|scandal|afterOffice|proposed)\b/.test(x); /* 別的選擇點自己的警告（例如借錢的對象剛好搬走）不算在這一版 */ if (/\[Home|\[HomeProp|\[Crown\]|\[Diplo\]|\[Civic\]|\[Wallet\]|\[Society\]|\[Exile\]|\[Assembly\]|\[Election\]/.test(x) || mine) { console.log('    console:', x.slice(0, 300)); errs.push(x.slice(0, 200)); } });
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 }); await page.waitForTimeout(500);
  const src = await page.evaluate(async () => (await fetch('sim-decide-home.js')).text());
  const r = await page.evaluate(async ({ KEYS, src, LONG }) => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const w = app.world; app._fullAgentOn = () => false; w.reset(); w.observerMode = true; ORIGIN.seed(w, 3, { seed: 91 }); w.observerMode = true; w.fullAgentMode = false; const out = {}; const R0 = Math.random;
    const tick1 = () => { const d0 = w._absDay(); for (let j = 0; j < 400 && w._absDay() === d0; j++) { w.paused = false; w.tick(); } w.paused = true; };
    for (let k = 0; k < 6 && !DECIDE.on(w); k++) tick1(); tick1(); out.on = DECIDE.on(w);
    const day = () => w._absDay(); const r3 = (n) => Math.round(n * 1000) / 1000;
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && !String(a.agentId).startsWith('visit_'));
    const adults = () => npcs().filter(a => (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId) && a.currentLocation !== 'exploration');
    const MM = MONEY.S(w); const leak = (fn) => { const T0 = MONEY.total(w), P0 = MM.pend; const ret = fn(); return { leak: r3((MONEY.total(w) - T0) - (MM.pend - P0)), ret }; };
    const tx = (x) => (x && typeof x === 'object') ? (x.raw != null ? String(x.raw) : fill(x.k, x.p)) : (typeof x === 'string' ? t(x) : (x == null ? '' : String(x))); const fill = (k, p) => { let s = t(k); for (const [a, b] of Object.entries(p || {})) s = s.split('{' + a + '}').join(tx(b)); return s; };
    const X0 = DECIDE.S(w); const KK = DECIDE.KINDS; const texts = []; const H = HOME.S(w); const logs = () => (w.messageLog || []).map(m => String(m.content || ''));
    const seen = [], asked = []; DECIDE.observe((ev, o) => { if (ev === 'decided' && o.K && KEYS.concat('proposed').includes(o.K.key)) seen.push({ kind: o.K.key, who: o.a.agentId, id: String(o.op.id), src: o.src, reason: tx(o.why), res: tx(o.res) }); if (ev === 'asked' && KEYS.concat('proposed').includes(o.kind)) asked.push({ kind: o.kind, who: o.a.agentId, ctx: o.ctx }); });
    const plain = (a) => { a.personality.traits = []; a.personality.values = []; a.moodModifier = 0; };
    const cash = (a) => WALLET.get(w, a); const setCash = (a, n) => { const c = cash(a); if (c > n) WALLET.take(w, a, c - n); else if (n > c) WALLET.add(w, a, n - c); };
    const setAff = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; };
    const unpair = (a) => { for (const r of Object.values(a.relationships?.relationships || {})) if (r.status === 'married' || r.status === 'dating') { r.status = 'friend'; const o = w.agents[r.targetId]; const r2 = o?.relationships?.relationships?.[a.agentId]; if (r2) r2.status = 'friend'; } };
    const orphan = (a) => { a._parentNames = []; for (const o of npcs()) if ((o._parentNames || []).includes(a.name)) o._parentNames = o._parentNames.filter(n => n !== a.name); };
    const wed = (a, b) => { unpair(a); unpair(b); const r1 = a.relationships.getOrCreate(b.agentId, b.name), r2 = b.relationships.getOrCreate(a.agentId, a.name); r1.status = 'married'; r2.status = 'married'; r1.statusSince = w.tickCount - 96 * 30; r2.statusSince = r1.statusSince; };
    const pick = (K, a, ctx) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); let best = null, bs = -1e9; for (const op of ops) { const s = DECIDE.score(Ln, op); if (s > bs) { bs = s; best = op; } } return best ? String(best.id).split(':')[0] : null; };
    const marg = (K, a, ctx, id) => { const ops = K.options(w, a, ctx); const Ln = DECIDE.lean(w, a); const me = ops.find(o => String(o.id).split(':')[0] === id); if (!me) return null; const others = ops.filter(o => o !== me).map(o => DECIDE.score(Ln, o)); return r3(DECIDE.score(Ln, me) - Math.max(...others)); };
    const ids = (K, a, ctx) => K.options(w, a, ctx).map(o => String(o.id).split(':')[0]);
    const opOf = (K, a, ctx, id) => K.options(w, a, ctx).find(o => String(o.id) === id || String(o.id).split(':')[0] === id);
    const runOp = (K, a, ctx, id) => { const op = opOf(K, a, ctx, id); if (!op) return null; const res = op.run(w, a, ctx); DECIDE.record(w, X0, a, K, op, op.why || null, res, 'rule', day(), ctx); return res; };
    const collect = (K, a, ctx) => { try { texts.push(t(K.title), K.facts(w, a, ctx)); for (const o of K.options(w, a, ctx)) texts.push(tx(o.text), tx(o.say), tx(o.why)); } catch (e) { texts.push('ERR ' + e.message); } };
    const steady = (fn) => { Math.random = () => 0.5; try { return fn(); } finally { Math.random = R0; } };
    const offDecide = (fn) => { const on0 = DECIDE.on; DECIDE.on = () => false; try { return fn(); } finally { DECIDE.on = on0; } };
    const memHas = (a, k) => (a.memory?.entries || []).some(e => e.k === k);
    const setJob = (a, k) => { try { a.job = new Job(k); } catch (e) {} };
    for (const a of npcs()) { if (w.civic?.jail) delete w.civic.jail[a.agentId]; if (a.currentLocation === 'exploration') a.currentLocation = 'town_square'; }
    try { WAYS.S(w).shame = {}; } catch (e) {}
    const used = new Set(); const free = (x) => !used.has(x.agentId) && x.job?.key !== 'mayor' && w.crown?.king !== x.agentId; const take = (f) => { const a = adults().find(x => free(x) && (!f || f(x))) || adults().find(free); if (a) used.add(a.agentId); return a; }; // 條件合的人用完了就隨便找一位（年紀之類的條件之後各自設好）
    if (!CROWN.king(w)) { const k = adults().filter(a => a.age >= 30 && a.job?.key !== 'mayor').sort((x, y) => CROWN.prestige(w, y) - CROWN.prestige(w, x))[0]; CROWN.crown(w, k, 'first'); }
    const king = CROWN.king(w); used.add(king.agentId); const mayorA = adults().find(a => a.job?.key === 'mayor'); if (mayorA) used.add(mayorA.agentId);
    out.pop = npcs().length; out.lv = TIERS.level(w);

    // 0) 登記
    out.reg = KEYS.map(k => KK[k] ? { k, scan: KK[k].scan, g: KK[k].aiGroup || null, kind: KK[k].aiKind || null, title: t(KK[k].title) } : { k, missing: 1 });
    out.civic = DECIDE.AI_GROUP.civic;

    // ============ A1 生孩子 ============
    const A1 = {}; { const a = take(x => x.age >= 22 && x.age <= 30), b = take(x => x.age >= 22 && x.age <= 30 && x.gender !== a.gender); a.age = 26; b.age = 27; plain(a); plain(b); orphan(a); orphan(b); wed(a, b); setAff(a, b, 50); setAff(b, a, 50); setCash(a, 60); setCash(b, 40); b.personality.values = ['家庭'];
      const I = HOME.couple(w, a); const k = I.k; delete H.bp[k]; (H.asked.bp || (H.asked.bp = {}));
      const ctx = { k, d: day() }; const K = KK.birthPlan; const f = K.facts(w, a, ctx); collect(K, a, ctx);
      A1.facts = { name: f.includes(t(b.name)) || f.includes(b.name), days: f.includes('30'), cash: f.includes(String(Math.floor(cash(a)))) && f.includes(String(Math.floor(cash(b)))), noKid: f.includes(t('你們還沒有孩子。')), wish: f.includes(fill('{b}很想要孩子。', { b: b.name })), tie: f.includes(t('只是普通交情')) || f.includes(t('是一家人')) };
      A1.ids = ids(K, a, ctx).join();
      // 問一次：沒商量過的夫妻在算機率時被問（輪流：這次問 a），同一天不重複問
      delete H.asked.bp[k]; const n0 = asked.length; const m1 = steady(() => HOME.birthMult(w, a, b)); const q1 = asked.slice(n0).filter(e => e.kind === 'birthPlan'); const m2 = HOME.birthMult(w, a, b); const q2 = asked.slice(n0).filter(e => e.kind === 'birthPlan').length;
      A1.ask = { n: q1.length, who: q1[0]?.who === a.agentId, again: q2 - q1.length, rec: !!H.bp[k], m1, m2 };
      // 答案只改機率：同一個擲骰值，想生的生得出來、再等等的生不出來、沒商量過的照原本也生不出來
      const tryBirth = (k2) => { if (k2) H.bp[k] = { k: k2, d: day(), by: a.agentId, n: 0, j: HOME.couple(w, a).snap.j, h: HOME.couple(w, a).snap.h }; else { delete H.bp[k]; H.asked.bp[k] = day(); }
        const tp0 = w.events.TARGET_POPULATION; w.events.TARGET_POPULATION = npcs().length + 20; const nb = w.lifecycle.births.length; Math.random = () => 0.025; try { w.lifecycle._checkBirths(w); } finally { Math.random = R0; w.events.TARGET_POPULATION = tp0; }
        const born = w.lifecycle.births.slice(nb).filter(x => (x.parentNames || []).includes(a.name)); for (const x of born) { const c = npcs().find(o => o.name === x.name); if (c) { c._parentNames = []; } } return born.length; };
      A1.prob = { want: tryBirth('want'), wait: tryBirth('wait'), none: tryBirth(null), mult: HOME.MULT };
      A1.mult = { want: (H.bp[k] = { k: 'want', d: day(), by: a.agentId, n: 0, j: I.snap.j, h: I.snap.h }) && HOME.birthMult(w, a, b), wait: (H.bp[k].k = 'wait') && HOME.birthMult(w, a, b), no: (H.bp[k].k = 'no') && HOME.birthMult(w, a, b) };
      // 選了之後：紀錄、另一半知道
      delete H.bp[k]; const res = runOp(K, a, ctx, 'no'); A1.run = { k: H.bp[k]?.k, by: H.bp[k]?.by === a.agentId, mem: memHas(b, '{a}跟我商量孩子的事，說{x}。'), upset: memHas(b, '我跟{a}對孩子的事想法不一樣，心裡有點悶。'), res: tx(res) };
      // 處境大變（多了孩子）十天後再問；沒變的六十天內不問
      H.bp[k].d = day() - 11; delete H.asked.bp[k]; const n1 = asked.length; HOME.birthMult(w, a, b); A1.same = asked.slice(n1).filter(e => e.kind === 'birthPlan').length;
      const kid = take(x => (x.age ?? 30) >= 16); kid._parentNames = [a.name, b.name]; delete H.asked.bp[k]; const n2 = asked.length; steady(() => HOME.birthMult(w, a, b)); A1.changed = asked.slice(n2).filter(e => e.kind === 'birthPlan').length; kid._parentNames = []; used.delete(kid.agentId);
      A1.alt = asked.slice(n2).find(e => e.kind === 'birthPlan')?.who === b.agentId; // 輪流：上次問 a，這次問 b
      // 傾向：重視家庭、另一半也想要的想生；崇尚自由、年紀大、孩子多的不想
      const c1 = take(x => x.age >= 22 && x.age <= 32), c2 = take(x => x.age >= 22 && x.age <= 32 && x.gender !== c1.gender); c1.age = 28; c2.age = 29; plain(c1); plain(c2); orphan(c1); orphan(c2); wed(c1, c2); setAff(c1, c2, 60); setCash(c1, 80); setCash(c2, 80); setJob(c1, 'farmer'); setJob(c2, 'farmer');
      const kc = { k: HOME.couple(w, c1).k, d: day() }; c1.personality.values = ['家庭']; c2.personality.values = ['家庭']; const mWant = marg(K, c1, kc, 'want'); const pWant = pick(K, c1, kc);
      c1.personality.values = ['自由']; c2.personality.values = ['自由']; c1.age = 41; const ks = adults().filter(x => !used.has(x.agentId)).slice(0, 3); for (const x of ks) x._parentNames = [c1.name, c2.name]; const mFree = marg(K, c1, kc, 'want'); const pFree = pick(K, c1, kc); for (const x of ks) x._parentNames = []; c1.age = 30;
      A1.lean = { mWant, mFree, pWant, pFree };
      // 決策核心沒開：不問，機率照原本
      H.bp[k] = undefined; delete H.bp[k]; delete H.asked.bp[k]; const n3 = asked.length; const mo = offDecide(() => HOME.birthMult(w, a, b)); A1.off = { mult: mo, asked: asked.length - n3 };
      unpair(c1); unpair(a); }
    out.A1 = A1;

    // ============ A2 遺囑 ============
    const A2 = {}; { const o = take(x => x.age >= 30), sp = take(), k1 = take(), k2 = take(), fr = take(); for (const x of [o, sp, k1, k2, fr]) { plain(x); orphan(x); unpair(x); } o.age = 95; wed(o, sp); for (const r of Object.values(o.relationships.relationships)) r.affinity = Math.min(r.affinity || 0, 20); k1._parentNames = [o.name, sp.name]; k2._parentNames = [o.name, sp.name];
      setAff(k1, o, 90); setAff(o, k1, 60); setAff(k2, o, 20); setAff(o, k2, 85); setAff(o, fr, 99); setAff(o, sp, 50); try { if (w.bank?.dep) delete w.bank.dep[o.agentId]; } catch (e) {} setCash(o, 300);
      delete H.will[o.agentId]; H.lastDay = null; if (H.asked.will) delete H.asked.will[o.agentId]; const n0 = asked.length; steady(() => HOME.daily(w)); const q = asked.slice(n0).filter(e => e.kind === 'will');
      A2.ask = { asked: q.some(e => e.who === o.agentId), max3: q.length <= 3, onlyOld: q.every(e => { const x = w.agents[e.who]; return x && ((x.age ?? 30) >= 60 || (HEALTH.deathMult(w, x) >= 2)); }), made: !!H.will[o.agentId] };
      const K = KK.will; delete H.will[o.agentId]; const f = K.facts(w, o, {}); collect(K, o, {});
      A2.facts = { age: f.includes('95'), cash: f.includes('300'), heirs: [sp, k1, k2].every(x => f.includes(t(x.name)) || f.includes(x.name)), care: f.includes(t(k1.name)) || f.includes(k1.name), fr: f.includes(t(fr.name)) || f.includes(fr.name), aff: f.includes('90') && f.includes('85') && f.includes('99') };
      const opsW = K.options(w, o, {}).map(x => String(x.id)); A2.ids = { even: opsW.includes('even'), favK1: opsW.includes('fav:' + k1.agentId), favK2: opsW.includes('fav:' + k2.agentId), friend: opsW.includes('friend:' + fr.agentId), town: opsW.includes('town') };
      // 照遺囑分：多給 k1（一半給他，其餘三人平分），產業房子他排第一；被少分的 k2 有感覺
      runOp(K, o, {}, 'fav:' + k1.agentId); A2.order = MARKET.heirsAll(w, o)[0]?.agentId === k1.agentId;
      const W = w.wallet; const tax0 = W.estateTax || 0; const est = cash(o); const got = (x) => { const e = (x.memory?.entries || []).filter(m => m.k === '繼承了{name}留下的 {n} 銀幣。' && m.p?.name === o.name).slice(-1)[0]; return e ? +e.p.n : 0; };
      const a2k = k1.relationships.relationships[k2.agentId]?.affinity || 0; const k2k1 = k2.relationships.getOrCreate(k1.agentId, k1.name).affinity;
      const L1 = leak(() => w.lifecycle._killNpc(w, o)); const tax = r3((W.estateTax || 0) - tax0); const net = r3(est - tax);
      A2.fav = { k1: got(k1), k2: got(k2), sp: got(sp), net, tax, sum: r3(got(k1) + got(k2) + got(sp)), half: Math.abs(got(k1) - (net / 2 + net / 6)) < 0.05, even: Math.abs(got(k2) - net / 6) < 0.05, leak: L1.leak, hurt: memHas(k2, '{name}的遺囑{x}，我只分到 {n} 銀幣。'), aff: r3((k2.relationships.relationships[k1.agentId]?.affinity || 0) - k2k1), spMood: memHas(sp, '{name}的遺囑{x}，我只分到 {n} 銀幣。') };
      // 留三成給朋友
      const o2 = take(x => x.age >= 30), s2 = take(), f2 = take(); for (const x of [o2, s2, f2]) { plain(x); orphan(x); unpair(x); } o2.age = 70; wed(o2, s2); for (const r of Object.values(o2.relationships.relationships)) r.affinity = Math.min(r.affinity || 0, 20); setAff(o2, f2, 99); setCash(o2, 150); try { if (w.bank?.dep) delete w.bank.dep[o2.agentId]; } catch (e) {}
      runOp(K, o2, {}, 'friend:' + f2.agentId); const e2 = cash(o2); const fr0 = cash(f2); const t2 = W.estateTax || 0; const L2 = leak(() => w.lifecycle._killNpc(w, o2)); const tax2 = r3((W.estateTax || 0) - t2); const net2 = r3(e2 - tax2);
      const gf = (x, nm) => { const e = (x.memory?.entries || []).filter(m => m.k === '繼承了{name}留下的 {n} 銀幣。' && m.p?.name === nm).slice(-1)[0]; return e ? +e.p.n : 0; };
      A2.friend = { f: gf(f2, o2.name), s: gf(s2, o2.name), net: net2, ok: Math.abs(gf(f2, o2.name) - net2 * 0.3) < 0.05 && Math.abs(gf(s2, o2.name) - net2 * 0.7) < 0.05, leak: L2.leak, cash: r3(cash(f2) - fr0) };
      // 捐一半給鎮上
      const o3 = take(x => x.age >= 30), c3 = take(); for (const x of [o3, c3]) { plain(x); orphan(x); unpair(x); } o3.age = 72; c3._parentNames = [o3.name]; setCash(o3, 120); try { if (w.bank?.dep) delete w.bank.dep[o3.agentId]; } catch (e) {}
      runOp(K, o3, {}, 'town'); const e3 = cash(o3); const t3 = W.estateTax || 0; const L3 = leak(() => w.lifecycle._killNpc(w, o3)); const tax3 = r3((W.estateTax || 0) - t3); const net3 = r3(e3 - tax3);
      A2.town = { c: gf(c3, o3.name), net: net3, ok: Math.abs(gf(c3, o3.name) - net3 * 0.5) < 0.05, log: logs().some(s => s.includes(t(o3.name)) || s.includes(o3.name)), leak: L3.leak };
      // 沒立遺囑：照原本平分
      const o4 = take(x => x.age >= 30), c4a = take(), c4b = take(); for (const x of [o4, c4a, c4b]) { plain(x); orphan(x); unpair(x); } o4.age = 61; c4a._parentNames = [o4.name]; c4b._parentNames = [o4.name]; setCash(o4, 100); delete H.will[o4.agentId]; try { if (w.bank?.dep) delete w.bank.dep[o4.agentId]; } catch (e) {}
      const L4 = leak(() => w.lifecycle._killNpc(w, o4)); A2.none = { a: gf(c4a, o4.name), b: gf(c4b, o4.name), eq: Math.abs(gf(c4a, o4.name) - gf(c4b, o4.name)) < 0.02 && gf(c4a, o4.name) > 0, leak: L4.leak };
      // 再問：立過的人三年內不問；家裡大變（多了一個孩子）十五天後再問
      const o5 = take(x => x.age >= 30), c5 = take(); for (const x of [o5, c5]) { plain(x); orphan(x); unpair(x); } o5.age = 63; c5._parentNames = [o5.name]; runOp(K, o5, {}, 'even'); if (H.asked.will) delete H.asked.will[o5.agentId];
      const due0 = HOME.S(w).will[o5.agentId] && !(() => { H.lastDay = null; const n = asked.length; steady(() => HOME.daily(w)); return asked.slice(n).some(e => e.who === o5.agentId); })();
      H.will[o5.agentId].d = day() - 16; const c6 = take(); c6._parentNames = [o5.name]; if (H.asked.will) delete H.asked.will[o5.agentId]; H.lastDay = null; const n5 = asked.length; steady(() => HOME.daily(w)); const due1 = asked.slice(n5).some(e => e.who === o5.agentId);
      A2.again = { quiet: due0, changed: due1 };
      // 傾向：大方、看重社群的捐；貪心的不捐；偏心的人多給最疼的
      const lw = take(x => x.age >= 30), lc1 = take(), lc2 = take(); for (const x of [lw, lc1, lc2]) { plain(x); orphan(x); unpair(x); } lw.age = 68; lc1._parentNames = [lw.name]; lc2._parentNames = [lw.name]; setAff(lw, lc1, 90); setAff(lw, lc2, 0); setAff(lc1, lw, 90); setAff(lc2, lw, 10);
      lw.personality.traits = ['generous']; lw.personality.values = ['社群']; const mT1 = marg(K, lw, {}, 'town'); lw.personality.traits = ['greedy']; lw.personality.values = []; const mT2 = marg(K, lw, {}, 'town'); const fav1 = marg(K, lw, {}, 'fav');
      setAff(lw, lc1, 30); setAff(lc1, lw, 30); setAff(lw, lc2, 30); setAff(lc2, lw, 30); const fav2 = marg(K, lw, {}, 'fav');
      A2.lean = { mT1, mT2, fav1, fav2 };
      // 沒開：不問
      H.lastDay = null; delete H.will[lw.agentId]; if (H.asked.will) delete H.asked.will[lw.agentId]; const n6 = asked.length; offDecide(() => HOME.daily(w)); A2.off = asked.slice(n6).length; }
    out.A2 = A2;

    // ============ A3 家人沒錢吃飯 ============
    const A3 = {}; { const x = take(), y = take(), z = take(); for (const q of [x, y, z]) { plain(q); orphan(q); unpair(q); } wed(x, y); z._parentNames = [x.name]; z.age = Math.max(20, z.age); setCash(x, 0); setCash(y, 100); setCash(z, 0); setAff(y, x, 50); setAff(x, y, 50);
      H.hd = null; const nd = seen.length; const L1 = leak(() => steady(() => MARKET.feed(w, x, 3))); A3.pay = { who: L1.ret?.agentId === y.agentId, y: r3(100 - cash(y)), xSame: cash(x) === 0, decided: seen.slice(nd).some(e => e.kind === 'feedHelp' && e.who === y.agentId && e.id === 'pay'), logged: !(X0.log[y.agentId] || []).some(e => e.kind === 'feedHelp') };
      const nd2 = seen.length; steady(() => MARKET.feed(w, x, 3)); A3.cache = seen.slice(nd2).filter(e => e.kind === 'feedHelp').length; // 同一天不再重新決定
      // 感情差、自己也拮据：不出；換下一位家人（有錢、感情好的子女）
      const K = KK.feedHelp; const ctxF = { to: x.agentId, n: 3 }; setAff(y, x, -60); setCash(y, 20); setCash(z, 15); setAff(z, x, 60); H.hd = null; collect(K, y, ctxF);
      const f = K.facts(w, y, ctxF); A3.facts = { name: f.includes(t(x.name)) || f.includes(x.name), n: f.includes('3'), cash: f.includes('20'), tie: f.includes(t('是一家人')) };
      A3.ids = ids(K, y, ctxF).join(); A3.lean = { hostile: pick(K, y, ctxF), mNo: marg(K, y, ctxF, 'no') };
      const aff0 = x.relationships.getOrCreate(y.agentId, y.name).affinity; const z0 = cash(z); const L2 = leak(() => steady(() => MARKET.feed(w, x, 3)));
      A3.next = { who: L2.ret?.agentId === z.agentId, z: r3(z0 - cash(z)), y: cash(y), mem: memHas(x, '{h}不肯替我出飯錢，我今天只能餓著。'), aff: r3(x.relationships.relationships[y.agentId].affinity - aff0) };
      // 都不肯：照原本沒錢吃飯
      setAff(z, x, -60); setCash(z, 9); H.hd = null; const z1 = cash(z), y1 = cash(y); const f3 = steady(() => MARKET.feed(w, x, 3)); A3.none = { fed: !!f3, kept: cash(z) === z1 && cash(y) === y1 };
      // 小孩的飯錢照舊由家裡出（不問）
      const kid = take(); plain(kid); orphan(kid); kid.age = 10; kid._parentNames = [y.name]; setCash(kid, 0); setCash(y, 50); setAff(y, kid, -80); H.hd = null; const nk = seen.length; const L4 = leak(() => steady(() => MARKET.feed(w, kid, 3))); A3.kid = { who: L4.ret?.agentId === y.agentId, asked: seen.slice(nk).filter(e => e.kind === 'feedHelp').length }; kid.age = 20; kid._parentNames = [];
      // 沒開：最有錢的家人照付
      setAff(y, x, -60); setCash(y, 30); H.hd = null; const L5 = offDecide(() => MARKET.feed(w, x, 3)); A3.off = L5?.agentId === y.agentId;
      A3.noAi = !!KK.feedHelp.noAi; }
    out.A3 = A3;

    // ============ A4 親戚的孩子 ============
    const A4 = {}; { const p = take(), g = take(x => x.age >= 45), u = take(), c = take(); for (const q of [p, g, u, c]) { plain(q); orphan(q); unpair(q); } p._parentNames = [g.name]; u._parentNames = [g.name]; c.age = 10; c._parentNames = [p.name];
      setAff(g, c, 70); setAff(u, c, 40); g.personality.traits = ['greedy', 'abrasive']; setCash(g, 10); u.personality.traits = ['kind']; u.personality.values = ['家庭']; setCash(u, 200);
      w.exile = w.exile || null; const X = EXILE.S(w); X.pending[p.agentId] = { crime: true, day: day() }; const n0 = asked.length; steady(() => EXILE.kids(w, p.agentId, true)); delete X.pending[p.agentId];
      const q = asked.slice(n0).filter(e => e.kind === 'adopt'); A4.order = { first: q[0]?.who === g.agentId, second: q[1]?.who === u.agentId, n: q.length };
      A4.res = { guard: c._guardian === u.agentId, parent: (c._parentNames || []).includes(u.name), here: !!w.agents[c.agentId], gNo: memHas(c, '{r}不肯收留我。'), uMem: memHas(u, '{p}被趕出小鎮，我把{c}接來家裡養。') };
      // 事實
      H.adopt[c.agentId] = { p: p.name, q: [], d: day() }; const f = KK.adopt.facts(w, u, { c: c.agentId }); collect(KK.adopt, u, { c: c.agentId }); A4.facts = { p: f.includes(t(p.name)) || f.includes(p.name), age: f.includes('10'), cash: f.includes('200') }; A4.ids = ids(KK.adopt, u, { c: c.agentId }).join(); delete H.adopt[c.agentId];
      // 都不接：孩子跟著走
      const c2 = take(); plain(c2); orphan(c2); c2.age = 9; c2._parentNames = [p.name]; u.personality.traits = ['greedy', 'abrasive']; u.personality.values = []; setCash(u, 10); X.pending[p.agentId] = { crime: true, day: day() }; steady(() => EXILE.kids(w, p.agentId, true)); delete X.pending[p.agentId];
      A4.allNo = { gone: !w.agents[c2.agentId], log: logs().some(s => s.includes(t(c2.name)) || s.includes(c2.name)) };
      // 沒開：照原本最親的收養
      const c3 = take(); plain(c3); orphan(c3); c3.age = 8; c3._parentNames = [p.name]; X.pending[p.agentId] = { crime: true, day: day() }; const n1 = asked.length; offDecide(() => EXILE.kids(w, p.agentId, true)); delete X.pending[p.agentId]; A4.off = { asked: asked.length - n1, adopted: !!c3._guardian }; }
    out.A4 = A4;

    // ============ A5 國王挑誰成婚 ============
    const A5 = {}; { const k = king; unpair(k); plain(k); const L0 = CIVIC.brides(w, k); A5.cands = L0.length;
      const list = L0.slice(0, 3); for (const x of list) { plain(x); used.add(x.agentId); }
      const ctxP = { c: list.map(x => x.agentId), r: list[0].agentId, d: day() }; const K = KK.royalPick; const f = K.facts(w, k, ctxP); collect(K, k, ctxP);
      A5.facts = { names: list.every(x => f.includes(t(x.name)) || f.includes(x.name)) };
      A5.ids = ids(K, k, ctxP); A5.ruleTop = pick(K, k, ctxP) === 'pick' && opOf(K, k, ctxP, 'pick:' + list[0].agentId) && (() => { const ops = K.options(w, k, ctxP); const Ln = DECIDE.lean(w, k); return ops.slice().sort((a, b) => DECIDE.score(Ln, b) - DECIDE.score(Ln, a))[0].id === 'pick:' + list[0].agentId; })();
      // 交情改變人選：浪漫又很喜歡第二位的國王挑第二位
      k.personality.traits = ['romantic']; setAff(k, list[1], 90); const ops2 = K.options(w, k, ctxP); const Ln2 = DECIDE.lean(w, k); A5.love = ops2.slice().sort((a, b) => DECIDE.score(Ln2, b) - DECIDE.score(Ln2, a))[0].id === 'pick:' + list[1].agentId; plain(k); setAff(k, list[1], 0);
      // 被挑上的人拒絕：崇尚自由、討厭國王
      const b1 = list[0]; b1.personality.values = ['自由']; setAff(b1, k, -50); const n0 = asked.length; steady(() => HOME.royalAsk(w, k, list)); const q = asked.slice(n0);
      A5.no = { pick: q.some(e => e.kind === 'royalPick' && e.who === k.agentId), prop: q.some(e => e.kind === 'proposed' && e.who === b1.agentId && e.ctx?.royal), single: !k.relationships.getPartner(), blocked: (H.royalNo[b1.agentId] ?? -1) > day(), kmem: memHas(k, '我向{b}求婚，被拒絕了。') };
      // 下一次：拒絕過的不在人選裡；想要權力的答應，成了王族
      const b2 = list[1]; b2.personality.values = ['權力']; setAff(b2, k, 40); const n1 = asked.length; steady(() => HOME.royalAsk(w, k, list)); const q2 = asked.slice(n1).filter(e => e.kind === 'royalPick'); const ctx2 = q2[0]?.ctx;
      A5.yes = { notB1: ctx2 && !ctx2.c.includes(b1.agentId), married: k.relationships.getPartner()?.targetId === b2.agentId && k.relationships.getPartner()?.status === 'married', royal: !!CLASS.S(w).titles[b2.agentId]?.royal, log: logs().some(s => s.includes('👑💍')) };
      // 原本的「對方向你求婚」照舊（不是國王來的）
      A5.plainProp = (() => { const a = take(), b = take(); for (const x of [a, b]) { plain(x); unpair(x); } return KK.proposed.facts(w, a, { by: b.agentId }) === '' && KK.proposed.options(w, a, { by: b.agentId }).length === 0; })();
      // 每天 2% 想成婚照舊看天，對象由國王挑
      unpair(k); for (const x of list) unpair(x); const n2 = asked.length; Math.random = () => 0.01; try { CIVIC.grand(w, CIVIC.S(w), day()); } finally { Math.random = R0; } A5.grand = asked.slice(n2).some(e => e.kind === 'royalPick');
      unpair(k); const k0 = k.relationships.getPartner(); Math.random = () => 0.5; try { CIVIC.grand(w, CIVIC.S(w), day()); } finally { Math.random = R0; } A5.dice = !k.relationships.getPartner() && !k0;
      // 沒開：直接娶階層最高的
      unpair(k); for (const x of CIVIC.brides(w, k).slice(0, 3)) unpair(x); const top = CIVIC.brides(w, k)[0]; Math.random = () => 0.01; try { offDecide(() => CIVIC.grand(w, CIVIC.S(w), day())); } finally { Math.random = R0; } A5.off = k.relationships.getPartner()?.targetId === top?.agentId;
      unpair(k); }
    out.A5 = A5;

    // ============ A6 聯姻 ============
    const A6 = {}; { const D = DIPLO.S(w); const ps = DIPLO.places(w); A6.places = ps.length; const p = ps[0]; const L = DIPLO.leader(w);
      const mk = () => { const a = take(x => x.age >= 18 && x.age <= 40); a.age = Math.min(40, Math.max(18, a.age)); plain(a); unpair(a); orphan(a); a._parentNames = [L.name]; return a; };
      const prep = () => { D.status[p.id] = 'ally'; D.rel[p.id] = 60; delete D.wed[p.id]; };
      // 答應：嫁過去、關係大升、永遠離開
      prep(); for (const o of npcs()) if ((o._parentNames || []).includes(L.name)) o._parentNames = o._parentNames.filter(n => n !== L.name); const a1 = mk(); a1.personality.values = ['社群']; const r0 = D.rel[p.id]; const n0 = asked.length; steady(() => DIPLO.act(w, D, 'wed', p.id));
      A6.yes = { asked: asked.slice(n0).some(e => e.kind === 'wedAway' && e.who === a1.agentId), gone: !w.agents[a1.agentId], wed: D.wed[p.id]?.name === a1.name, rel: r3(D.rel[p.id] - r0) };
      // 拒絕：有心上人、崇尚自由；關係變差、首長沒面子
      prep(); const a2 = mk(); a2.personality.values = ['自由']; setAff(L, a2, 30); const r1 = D.rel[p.id]; const la = L.relationships.getOrCreate(a2.agentId, a2.name).affinity;
      const ctxW = { pid: p.id, by: L.agentId, d: day() }; const f = KK.wedAway.facts(w, a2, ctxW); collect(KK.wedAway, a2, ctxW); A6.facts = { p: f.includes(t(DIPLO.pname(p))), l: f.includes(t(L.name)) || f.includes(L.name) }; A6.ids = ids(KK.wedAway, a2, ctxW).join();
      const legit0 = w.crown?.legit ?? 0; runOp(KK.wedAway, a2, ctxW, 'no'); A6.no = { here: !!w.agents[a2.agentId], rel: r3(D.rel[p.id] - r1), laff: r3(L.relationships.relationships[a2.agentId].affinity - la), wedNo: HOME.wedSkip(w, a2), legit: r3((w.crown?.legit ?? 0) - legit0), noWed: !D.wed[p.id] };
      // 逃婚（有心上人）：跟心上人成親，關係更差
      prep(); const a3 = mk(); const lover = take(x => x.gender !== a3.gender); plain(lover); unpair(lover); const rl = a3.relationships.getOrCreate(lover.agentId, lover.name), rl2 = lover.relationships.getOrCreate(a3.agentId, a3.name); rl.status = 'dating'; rl2.status = 'dating'; rl.affinity = 80; rl2.affinity = 80;
      A6.loverIds = ids(KK.wedAway, a3, ctxW).join(); A6.loverPick = pick(KK.wedAway, a3, ctxW); const r2 = D.rel[p.id]; runOp(KK.wedAway, a3, ctxW, 'run'); A6.run = { married: a3.relationships.relationships[lover.agentId]?.status === 'married', rel: r3(D.rel[p.id] - r2), here: !!w.agents[a3.agentId] };
      // 逃婚（沒有心上人、個性叛逆）：躲到外地
      prep(); const a4 = mk(); a4.personality.traits = ['abrasive']; A6.rebelIds = ids(KK.wedAway, a4, ctxW).join(); runOp(KK.wedAway, a4, ctxW, 'run'); A6.hide = { away: !w.agents[a4.agentId] && !!w.isAway?.(a4.agentId) };
      prep(); const plainA = mk(); A6.plainIds = ids(KK.wedAway, plainA, ctxW).join(); used.add(plainA.agentId);
      // 沒開：照原本直接嫁過去
      prep(); for (const o of npcs()) if ((o._parentNames || []).includes(L.name)) o._parentNames = o._parentNames.filter(n => n !== L.name); const a5 = mk(); const n1 = asked.length; offDecide(() => DIPLO.act(w, D, 'wed', p.id)); A6.off = { asked: asked.length - n1, gone: !w.agents[a5.agentId] }; delete D.wed[p.id]; }
    out.A6 = A6;

    // ============ B7 王令 ============
    const B7 = {}; { const k = king; plain(k); const C = w.crown; const foes = adults().filter(x => x !== k && !used.has(x.agentId)).slice(0, 2); for (const x of foes) setAff(x, k, -40);
      const ctxD = { r: 'festival', d: day() }; const K = KK.decree; const f = K.facts(w, k, ctxD); collect(K, k, ctxD); const tr = Math.floor(w.stockpile.get('silver'));
      const poor = npcs().filter(a => (a.age ?? 30) >= 16 && cash(a) < 10).length;
      B7.facts = { tr: f.includes(String(tr)), tax: f.includes(String(Math.round(w.wallet.tax * 100)) + '%'), legit: f.includes(String(Math.round(C.legit)) + '/100'), poor: f.includes(String(poor)), foe: foes.every(x => f.includes(t(x.name)) || f.includes(x.name)) };
      B7.ids = ids(K, k, ctxD).join(); B7.rule = pick(K, k, ctxD);
      // 每一種的結算
      const res = {};
      { const pr = adults().filter(a => !used.has(a.agentId)).slice(0, 3); for (const x of pr) setCash(x, 2); w.stockpile.add('silver', 500, w.tickCount, 'test'); const c0 = pr.map(cash); const s0 = w.stockpile.get('silver'); const Lr = leak(() => runOp(K, k, ctxD, 'relief')); res.relief = { up: pr.every((x, i) => cash(x) > c0[i]), down: w.stockpile.get('silver') < s0, leak: Lr.leak, rec: C.decrees.slice(-1)[0]?.key === 'relief' }; }
      { const t0 = w.wallet.tax; runOp(K, k, ctxD, 'tax_up'); res.up = r3(w.wallet.tax - t0); const t1 = w.wallet.tax; runOp(K, k, ctxD, 'tax_down'); res.down = r3(w.wallet.tax - t1); }
      { const who = adults()[7]; const m0 = who.moodModifier || 0; const Lf = leak(() => runOp(K, k, ctxD, 'festival')); res.festival = { mood: r3((who.moodModifier || 0) - m0), leak: Lf.leak, rec: C.decrees.slice(-1)[0]?.key === 'festival' }; }
      { w.dark = w.dark || {}; w.dark.labor = [{ id: 'x' }]; runOp(K, k, ctxD, 'amnesty'); res.amnesty = (w.dark.labor || []).length === 0; }
      { const m0 = adults()[5].moodModifier || 0; runOp(K, k, ctxD, 'curfew'); res.curfew = r3((adults()[5].moodModifier || 0) - m0); }
      { const n = C.decrees.length; runOp(K, k, ctxD, 'none'); res.none = { n: C.decrees.length - n, log: logs().some(s => s.includes(t('📜 國王{k}這次沒有頒布王令。').replace('{k}', t(k.name)))) }; }
      B7.res = res;
      // 傾向：心腸好的國王在窮人多的時候賑災；貪心的加稅
      for (const x of adults().filter(a => !used.has(a.agentId)).slice(0, 3)) setCash(x, 2);
      k.personality.traits = ['kind']; k.personality.values = ['社群']; const mR = marg(K, k, { r: 'relief', d: day() }, 'relief'); k.personality.traits = ['greedy']; k.personality.values = ['權力']; const mR2 = marg(K, k, { r: 'relief', d: day() }, 'relief'); const mU = marg(K, k, { r: 'relief', d: day() }, 'tax_up'); k.personality.traits = []; k.personality.values = []; const mU0 = marg(K, k, { r: 'relief', d: day() }, 'tax_up');
      B7.lean = { mR, mR2, mU, mU0 };
      // 每十天由國王自己決定（取代原本照順序挑）；問不到國王時照原本
      C.lastDecree = day() - 10; const n0 = asked.length; const dn = C.decrees.length; steady(() => CROWN.daily(w)); B7.daily = { asked: asked.slice(n0).some(e => e.kind === 'decree' && e.who === k.agentId), issued: C.decrees.length - dn };
      C.lastDecree = day() - 10; const n1 = asked.length; const dn2 = C.decrees.length; offDecide(() => CROWN.daily(w)); B7.off = { asked: asked.length - n1, issued: C.decrees.length - dn2 };
      for (const x of foes) setAff(x, k, 0); }
    out.B7 = B7;

    // ============ B8 外交 ============
    const B8 = {}; { const D = DIPLO.S(w); const ps = DIPLO.places(w); const L = DIPLO.leader(w); plain(L); const p = ps[0]; D.status[p.id] = 'ally'; D.rel[p.id] = 60; delete D.wed[p.id]; for (const q of ps.slice(1)) { D.status[q.id] = 'none'; D.rel[q.id] = 30; }
      w.goods = w.goods || {}; w.goods.town = w.goods.town || []; w.goods.town.push({ id: 'tg1', key: 'painting', d: day() });
      const ctxS = { r: ['envoy', p.id], d: day() }; const K = KK.diploSeason; const f = K.facts(w, L, ctxS); collect(K, L, ctxS);
      B8.facts = { places: ps.every(q => f.includes(t(DIPLO.pname(q)))), rel: f.includes(String(Math.round(D.rel[p.id]))), goods: f.includes(String((w.goods.town || []).filter(x => !x.rel && !x.gift).length)), ally: f.includes(t(DIPLO.pname(p))) };
      const ops = K.options(w, L, ctxS); B8.ids = [...new Set(ops.map(o => String(o.id).split(':')[0]))].join(); B8.envN = ops.filter(o => String(o.id).startsWith('envoy:')).length; B8.rule = pick(K, L, ctxS);
      // 派使節：第一位推辭（怕生又懶），換第二位，第二位出使
      const cands = ops.filter(o => String(o.id).startsWith('envoy:')).map(o => w.agents[String(o.id).split(':')[1]]); const e1 = cands[0], e2 = cands[1]; const keepT = (a) => (a.personality.traits || []).filter(x => ['charismatic', 'kind'].includes(x));
      e1.personality.traits = [...keepT(e1), 'shy', 'lazy']; e1.personality.values = ['自由']; e1.age = 72; e2.personality.traits = [...keepT(e2), 'ambitious']; e2.personality.values = ['冒險']; e2.age = Math.min(e2.age, 50); used.add(e1.agentId); used.add(e2.agentId);
      B8.same = K.options(w, L, ctxS).filter(o => String(o.id).startsWith('envoy:')).map(o => String(o.id).split(':')[1]).join() === [e1.agentId, e2.agentId].join();
      const relSum = () => ps.reduce((x, q) => x + (D.rel[q.id] || 0), 0); const r0 = relSum(); const n0 = asked.length; steady(() => runOp(K, L, ctxS, 'envoy:' + e1.agentId)); const q = asked.slice(n0).filter(e => e.kind === 'postOffer');
      B8.envoy = { first: q[0]?.who === e1.agentId, second: q[1]?.who === e2.agentId, e1Here: !!w.agents[e1.agentId], e2Away: !w.agents[e2.agentId] && !!w.isAway?.(e2.agentId), rel: r3(relSum() - r0) > 0, decl: (H.decl.envoy[e1.agentId] ?? -1) > day() };
      // 都推辭：這次作罷
      const ops2 = K.options(w, L, ctxS); const cs2 = ops2.filter(o => String(o.id).startsWith('envoy:')).map(o => w.agents[String(o.id).split(':')[1]]); for (const x of cs2) { x.personality.traits = [...keepT(x), 'shy', 'lazy']; x.personality.values = ['自由']; x.age = 75; }
      const en0 = H.st.envoyNone || 0; steady(() => runOp(K, L, ctxS, 'envoy:' + cs2[0].agentId)); B8.none = (H.st.envoyNone || 0) === en0 + 1 && !H.offer.envoy;
      // 送禮：珍品送出去、關係變好
      const tg = D.rel[ps[ps.length - 1].id]; const worst = ps.slice().sort((a, b) => (D.rel[a.id] || 0) - (D.rel[b.id] || 0))[0]; const rw = D.rel[worst.id]; runOp(K, L, ctxS, 'gift'); B8.gift = { rel: r3(D.rel[worst.id] - rw), gone: !(w.goods.town || []).some(x => x.id === 'tg1') };
      // 提聯姻：問被嫁的人
      const kid = take(x => x.age >= 18 && x.age <= 40); kid.age = Math.min(40, Math.max(18, kid.age)); plain(kid); unpair(kid); orphan(kid); kid._parentNames = [L.name]; const n1 = asked.length; runOp(K, L, ctxS, 'wed'); B8.wed = asked.slice(n1).some(e => e.kind === 'wedAway' && e.who === kid.agentId);
      // 這次不理
      const lg0 = D.log.length; runOp(K, L, ctxS, 'none'); B8.skip = D.log.length === lg0;
      // 每十天由首長決定；沒開照原本
      D.lastAct = day() - 10; D.lastDay = null; const n2 = asked.length; steady(() => DIPLO.daily(w)); B8.daily = asked.slice(n2).some(e => e.kind === 'diploSeason' && e.who === L.agentId);
      D.lastAct = day() - 10; D.lastDay = null; const n3 = asked.length; const lg1 = JSON.stringify(D.log.slice(-1)); D.log.push({ day: -1, k: 'x', p: {} }); offDecide(() => DIPLO.daily(w)); B8.off = { asked: asked.slice(n3).filter(e => e.kind === 'diploSeason').length, acted: D.log.slice(-1)[0]?.day !== -1 }; D.log = D.log.filter(x => x.day !== -1); }
    out.B8 = B8;

    // ============ B9 接不接位子 ============
    const B9 = {}; { const C = w.crown; const k = king;
      // 王位：長子不接（怕生又懶）→ 次子接
      const h1 = take(x => x.age >= 30), h2 = take(x => x.age >= 18); for (const x of [h1, h2]) { plain(x); orphan(x); } h1.age = Math.max(h1.age, h2.age + 2); const prevName = 'Aldric'; h1._parentNames = [prevName]; h2._parentNames = [prevName];
      h1.personality.traits = ['shy', 'lazy']; h1.personality.values = ['自由']; h2.personality.traits = ['ambitious'];
      C.king = null; C.crisis = null; C.history.push({ id: 'old_k', name: prevName, from: day() - 100, how: 'first' }); H.offer.throne = null; for (const x of [h1, h2]) delete H.decl.throne[x.agentId];
      const ctxT = { post: 'throne', d: day() }; const K = KK.postOffer; const f = K.facts(w, h1, ctxT); collect(K, h1, ctxT); B9.tFacts = { prev: f.includes(t(prevName)) || f.includes(prevName), sib: f.includes(t(h2.name)) || f.includes(h2.name), lg: f.includes(String(Math.round(C.legit))) };
      setAff(h1, h2, 70); B9.tIds = ids(K, h1, ctxT).join(); setAff(h1, h2, 0);
      const n0 = asked.length; steady(() => CROWN.succession(w)); const q = asked.slice(n0).filter(e => e.kind === 'postOffer');
      B9.throne = { first: q[0]?.who === h1.agentId, second: q[1]?.who === h2.agentId, king: C.king === h2.agentId, h1Log: logs().some(s => s.includes(t('👑 {a}不肯接王位，說自己擔不起。').replace('{a}', t(h1.name)))) };
      // 讓給弟妹
      const h3 = take(x => x.age >= 30), h4 = take(x => x.age >= 18); for (const x of [h3, h4]) { plain(x); orphan(x); } h3.age = Math.max(h3.age, h4.age + 2); const pn2 = 'Bertram'; h3._parentNames = [pn2]; h4._parentNames = [pn2]; h3.personality.traits = ['kind']; setAff(h3, h4, 90); h4.personality.traits = ['ambitious'];
      C.king = null; C.crisis = null; C.history.push({ id: 'old_k2', name: pn2, from: day() - 50, how: 'heir' }); H.offer.throne = null;
      B9.yieldLean = (() => { const kind = marg(K, h3, ctxT, 'yield'); h3.personality.traits = ['ambitious']; const amb = marg(K, h3, ctxT, 'yield'); h3.personality.traits = ['kind']; return { kind, amb }; })();
      const yo = opOf(K, h3, ctxT, 'yield'); B9.yieldOpt = !!yo; const ny = asked.length; if (yo) steady(() => yo.run(w, h3, ctxT)); B9.yieldAsk = asked.slice(ny).some(e => e.kind === 'postOffer' && e.who === h4.agentId); B9.yield = { king: C.king === h4.agentId, kingName: w.agents[C.king]?.name || C.king, h3: h3.name, h4: h4.name, dec: seen.filter(e => e.who === h3.agentId || e.who === h4.agentId).slice(-4).map(e => e.id), log: logs().some(s => s.includes(t(h4.name)) || s.includes(h4.name)) };
      // 都不接：進繼承危機
      const h5 = take(x => x.age >= 20); plain(h5); orphan(h5); const pn3 = 'Cedric'; h5._parentNames = [pn3]; h5.personality.traits = ['shy', 'lazy']; h5.personality.values = ['自由'];
      C.king = null; C.crisis = null; C.history.push({ id: 'old_k3', name: pn3, from: day() - 10, how: 'heir' }); H.offer.throne = null; steady(() => CROWN.succession(w)); B9.crisis = !C.king && !!C.crisis;
      // 恢復國王
      C.crisis = null; C.king = k.agentId;
      // 議員遞補：落選者第一位推辭、第二位遞補
      const A = ASSEMBLY.S(w); const cl = w.council; cl._formed = true; const s1 = take(), s2 = take(); for (const x of [s1, s2]) { plain(x); cl.members = cl.members.filter(id => id !== x.agentId); } s1.personality.traits = ['shy', 'lazy']; s1.personality.values = ['自由']; s2.personality.traits = ['ambitious'];
      cl.members = cl.members.filter(id => w.agents[id]); while (cl.members.length >= ASSEMBLY.wantSeats(w)) cl.members.pop(); A.runners = [s1.agentId, s2.agentId]; delete H.decl.seat[s1.agentId]; delete H.decl.seat[s2.agentId];
      const sf = K.facts(w, s1, { post: 'seat', d: day() }); collect(K, s1, { post: 'seat', d: day() }); const ns = asked.length; steady(() => ASSEMBLY.fillFromRunners.call(cl, w));
      B9.seat = { s1In: cl.members.includes(s1.agentId), s2In: cl.members.includes(s2.agentId), asked: asked.slice(ns).filter(e => e.kind === 'postOffer' && (e.who === s1.agentId || e.who === s2.agentId)).map(e => e.who === s1.agentId ? 1 : 2).join(), facts: sf.includes(t(LV0(w).member)) };
      B9.seatOk = { declined: HOME.seatOk(w, s1, 'pick'), off: offDecide(() => HOME.seatOk(w, s1, 'pick')) };
      // 代理首長：不肯接的跳過，下一位答應
      const E = w.election; const p1 = take(), p2 = take(); for (const x of [p1, p2]) plain(x); p1.personality.traits = ['shy', 'lazy']; p1.personality.values = ['自由']; p2.personality.traits = ['ambitious']; delete H.decl.acting[p1.agentId]; delete H.acc.acting[p1.agentId]; delete H.acc.acting[p2.agentId];
      const pa0 = E._pickActing, rm0 = E._realMayor; E._realMayor = () => null; /* 情境：首長不在鎮上 */ for (const x of [p1, p2]) delete H.pend.acting[x.agentId]; E._pickActing = (w2, skip) => [p1, p2].find(x => !(skip && skip.has(x.agentId))) || null; let got = null; const na = asked.length; try { got = steady(() => HOME.actingPick(w, E)); } finally { E._pickActing = pa0; E._realMayor = rm0; }
      B9.acting = { got: got?.agentId === p2.agentId, asked: asked.slice(na).filter(e => e.kind === 'postOffer').length, off: (() => { E._pickActing = (w2, skip) => [p1, p2].find(x => !(skip && skip.has(x.agentId))) || null; try { return offDecide(() => HOME.actingPick(w, E))?.agentId === p1.agentId; } finally { E._pickActing = pa0; } })() };
      // 傾向：有野心的接，怕生又懶的不接
      const s3 = take(); plain(s3); s3.personality.traits = ['ambitious']; s3.personality.values = ['權力']; cl.members = cl.members.filter(id => id !== s3.agentId && id !== p1.agentId); B9.lean = { amb: marg(K, s3, { post: 'seat', d: day() }, 'yes'), shy: marg(K, p1, { post: 'seat', d: day() }, 'yes') }; }
    out.B9 = B9;

    // ============ B10 醜事被揭穿 ============
    const B10 = {}; { const cl = w.council; const D = DARK.S(w); D.secrets = D.secrets || [];
      const mkC = () => { const c = take(); plain(c); if (!cl.members.includes(c.agentId)) cl.members.push(c.agentId); return c; };
      const mkS = (c, v, asm) => { const s = { id: 'sx' + Math.random().toString(36).slice(2, 7), kind: 'kickback', asm, culprit: c.agentId, victim: v?.agentId || null, found: true, day: day() - 3, k: '{c}收了{v}的錢', p: {} }; D.secrets.push(s); return s; };
      const v = take(); plain(v); const known = take(); plain(known);
      const c1 = mkC(); setAff(known, c1, 10); const s1 = mkS(c1, v, 'bribe'); const n0 = asked.length; ASSEMBLY.R(w, c1.agentId).exposed = 0; steady(() => ASSEMBLY.scanSecrets(w));
      B10.asked = asked.slice(n0).some(e => e.kind === 'scandal' && e.who === c1.agentId);
      const ctxS = { type: 'bribe', sid: s1.id, v: v.agentId, q: 0.5, d: day() }; const K = KK.scandal; const f = K.facts(w, c1, ctxS); collect(K, c1, ctxS); B10.facts = { v: f.includes(t(v.name)) || f.includes(v.name), council: f.includes(t(LV0(w).council)) }; B10.ids = ids(K, c1, ctxS).join();
      // 四種反應
      const P = POWER.S(w);
      { const c = mkC(); const s = mkS(c, v, 'bribe'); const cx = Object.assign({}, ctxS, { sid: s.id }); runOp(K, c, cx, 'resign'); B10.resign = !cl.members.includes(c.agentId); }
      { const c = mkC(); const s = mkS(c, v, 'bribe'); const cx = Object.assign({}, ctxS, { sid: s.id }); setAff(known, c, 10); const sc0 = P.scandal[c.agentId] || 0; runOp(K, c, cx, 'deny');
        const e = H.scan.find(x => x.id === c.agentId); B10.deny = { stay: cl.members.includes(c.agentId), aff: r3(known.relationships.relationships[c.agentId].affinity - 10), sc: r3((P.scandal[c.agentId] || 0) - sc0), sched: !!e && e.p === 0.5 };
        if (e) e.d = day(); Math.random = () => 0.1; try { HOME.scandalCheck(w); } finally { Math.random = R0; } B10.deny.forced = !cl.members.includes(c.agentId); }
      { const c = mkC(); const s = mkS(c, v, 'bribe'); const cx = Object.assign({}, ctxS, { sid: s.id }); setAff(known, c, 10); const sc0 = P.scandal[c.agentId] || 0; runOp(K, c, cx, 'sorry'); B10.sorry = { stay: cl.members.includes(c.agentId), aff: r3(known.relationships.relationships[c.agentId].affinity - 10), sc: r3((P.scandal[c.agentId] || 0) - sc0) };
        const e = H.scan.find(x => x.id === c.agentId); if (e) e.d = day(); Math.random = () => 0.5; try { HOME.scandalCheck(w); } finally { Math.random = R0; } B10.sorry.held = cl.members.includes(c.agentId); }
      { const c = mkC(); const s = mkS(c, v, 'bribe'); const cx = Object.assign({}, ctxS, { sid: s.id }); const va = v.relationships.getOrCreate(c.agentId, c.name).affinity; const sc0 = P.scandal[c.agentId] || 0; runOp(K, c, cx, 'counter'); B10.counter = { stay: cl.members.includes(c.agentId), vaff: r3(v.relationships.relationships[c.agentId].affinity - va), sc: r3((P.scandal[c.agentId] || 0) - sc0), vmem: memHas(v, '{c}自己做了醜事，還反咬我一口。') }; }
      // 傾向
      { const c = mkC(); const s = mkS(c, v, 'bribe'); const cx = Object.assign({}, ctxS, { sid: s.id }); c.personality.traits = ['kind']; c.dark = c.dark || {}; const mK = marg(K, c, cx, 'resign') ?? null; c.personality.traits = ['ambitious', 'abrasive']; c.personality.values = ['權力']; const mA = marg(K, c, cx, 'resign'); B10.lean = { mK, mA, ambPick: pick(K, c, cx) }; }
      // 首長買票被揭穿：辭職就下台，接著問下台以後做什麼
      { const E = w.election; let m = E._officeHolder?.(w); if (!m) { m = take(); setJob(m, 'mayor'); } if (m) { plain(m); H.prev[m.agentId] = 'blacksmith'; const sm = { id: 'smx', kind: 'scheme', culprit: m.agentId, victim: v.agentId, found: true, day: day() - 2, k: '{c}私下塞錢給{v}買票', p: {} }; const cxm = { type: 'mayor', sid: sm.id, v: v.agentId, q: 0.9, d: day() }; D.secrets.push(sm);
        B10.mayorIds = ids(K, m, cxm).join(); const n1 = asked.length; runOp(K, m, cxm, 'resign'); const q = asked.slice(n1);
        B10.mayor = { out: m.job?.key !== 'mayor', after: q.some(e => e.kind === 'afterOffice' && e.who === m.agentId) };
        // 下台以後：回去做老本行
        const ca = { why: 'scandal', d: day(), prev: 'blacksmith' }; const fa = KK.afterOffice.facts(w, m, ca); collect(KK.afterOffice, m, ca); B10.afterIds = ids(KK.afterOffice, m, ca).join(); B10.afterFacts = fa.includes(t(jobTitle('blacksmith'))); runOp(KK.afterOffice, m, ca, 'prev'); B10.afterJob = m.job?.key; used.add(m.agentId); } }
      // 沒開：照原本（被揭穿兩次以上一定辭職）
      { const c = mkC(); const s = mkS(c, v, 'bribe'); ASSEMBLY.R(w, c.agentId).exposed = 1; const n2 = asked.length; offDecide(() => ASSEMBLY.scanSecrets(w)); B10.off = { asked: asked.slice(n2).filter(e => e.kind === 'scandal').length, out: !cl.members.includes(c.agentId) }; } }
    out.B10 = B10;

    // ============ C 三種新提案 ============
    const Cx = {}; { const P = w.proposals; const law = () => HOMEPROP.view(w); const Hl = H.law; Hl.last = {}; Hl.theft = 'normal'; Hl.pause = null; Hl.pay = 0;
      const clear = () => { for (const p of P.items) if (HOMEPROP.KINDS.includes(p.kind) && ['open', 'shelved', 'approved'].includes(p.status)) p.status = 'rejected'; Hl.last = {}; };
      // 偷竊罰則：被偷過的人提從重
      for (const k of Object.keys(H.vic)) delete H.vic[k]; for (const k of Object.keys(H.thief)) delete H.thief[k]; const vs = [take(), take(), take()]; for (const x of vs) { plain(x); H.vic[x.agentId] = day() - 1; } clear(); w.fullAgentMode = false; Math.random = () => 0; let pT = null; try { HOMEPROP.daily(w); } finally { Math.random = R0; } pT = P.items.slice(-1)[0];
      Cx.theftProp = { kind: pT?.kind, dir: pT?.dir, byVictim: vs.some(x => x.agentId === pT?.proposerId), title: P.title(pT || { tk: '', tp: {} }) };
      // 表決：被偷過的人贊成、家人被關過的人反對；理由看得出立場
      for (const k of Object.keys(H.thief)) delete H.thief[k]; const th = take(); plain(th); const kin = take(); plain(kin); setAff(kin, th, 80); H.thief[th.agentId] = day() - 2; const vv = vs[0]; const fake = Object.assign({}, pT, { votes: {}, why: {}, proposerId: 'zz' });
      P._ruleVote(w, fake, vv); P._ruleVote(w, fake, kin); P._ruleVote(w, fake, th); Cx.theftVote = { victim: fake.votes[vv.agentId] + ':' + fake.why[vv.agentId], kin: fake.votes[kin.agentId] + ':' + fake.why[kin.agentId], thief: fake.votes[th.agentId], whyText: typeof VOTE_WHY !== 'undefined' && !!VOTE_WHY.theft_victim };
      // 生效：從重關 5 天
      HOMEPROP.enact(w, pT); Cx.harsh = law().theft;
      const C = CIVIC.S(w); const catchOne = () => { const thief = take(); plain(thief); thief.personality.traits = ['lazy']; setCash(thief, 4); const vic = take(); plain(vic); setCash(vic, 100); const by = [take(), take()]; for (const x of by) { plain(x); setCash(x, 30); } const keep = {}; for (const a of npcs()) if (a !== thief && a !== vic && !by.includes(a)) { keep[a.agentId] = C.jail[a.agentId]; C.jail[a.agentId] = day() + 1; } C.thefts = 0; const T0 = w.stockpile.get('silver');
        const L1 = leak(() => { Math.random = () => 0; try { CIVIC.crime(w, C, day()); } finally { Math.random = R0; } }); const jail = C.jail[thief.agentId] ? C.jail[thief.agentId] - day() : 0; for (const [id, v] of Object.entries(keep)) { if (v == null) delete C.jail[id]; else C.jail[id] = v; } delete C.jail[thief.agentId]; return { jail, leak: L1.leak, vic: cash(vic), fine: r3(w.stockpile.get('silver') - T0) }; };
      Cx.harshJail = catchOne();
      Hl.theft = 'light'; Cx.lightJail = catchOne(); Hl.theft = 'normal'; Cx.normalJail = catchOne();
      // 移民：找不到工作的人提暫停；暫停期間不收；到期、人口太少自動失效；東家提重新開放
      clear(); for (const k of Object.keys(H.vic)) delete H.vic[k]; for (const k of Object.keys(H.thief)) delete H.thief[k]; const jl = adults().filter(a => !used.has(a.agentId)).slice(0, 12); const jobs0 = jl.map(a => a.job); for (const a of jl) a.job = null; Math.random = () => 0; try { HOMEPROP.daily(w); } finally { Math.random = R0; } const pI = P.items.slice(-1)[0];
      Cx.immigProp = { kind: pI?.kind, dir: pI?.dir, byJobless: jl.some(a => a.agentId === pI?.proposerId) }; const fakeI = Object.assign({}, pI, { votes: {}, why: {}, proposerId: 'zz' }); P._ruleVote(w, fakeI, jl[1]); Cx.immigVote = fakeI.votes[jl[1].agentId] + ':' + fakeI.why[jl[1].agentId]; jl.forEach((a, i) => { a.job = jobs0[i]; });
      if (pI?.dir === 'pause') HOMEPROP.enact(w, pI); Cx.paused = HOME.immigPaused(w); const tp0 = w.events.TARGET_POPULATION; w.events.TARGET_POPULATION = npcs().length + 15; const pop0 = npcs().length; Math.random = () => 0; try { w.events._managePopulation(w); } finally { Math.random = R0; } Cx.noSpawn = npcs().length === pop0;
      if (Hl.pause) Hl.pause.until = day(); Cx.expired = !HOME.immigPaused(w) && !Hl.pause; HOMEPROP.enact(w, Object.assign({}, pI, { dir: 'pause', days: 30 })); Cx.repaused = !!Hl.pause; w.events.TARGET_POPULATION = npcs().length * 3; Cx.lowPop = !HOME.immigPaused(w); w.events.TARGET_POPULATION = tp0;
      Hl.pause = { from: day(), until: day() + 30 }; clear(); w.events.TARGET_POPULATION = npcs().length + 10; Math.random = () => 0; try { HOMEPROP.daily(w); } finally { Math.random = R0; } const pO = P.items.slice(-1)[0]; w.events.TARGET_POPULATION = tp0; Cx.openProp = { kind: pO?.kind, dir: pO?.dir }; if (pO?.dir === 'open') HOMEPROP.enact(w, pO); Cx.opened = !Hl.pause;
      // 公職薪水：調高一級，公職的薪水倍率真的多一成；調低回來
      clear(); const pr0 = FISCAL.pubRate(w); const pubW = take(); plain(pubW); setJob(pubW, 'guard'); try { delete WAYS.S(w).shame[pubW.agentId]; } catch (e) {} const pP = HOMEPROP.propose(w, 'home_pay', pubW, 1, ''); Cx.payProp = { kind: pP?.kind, title: pP ? P.title(pP) : '' }; const fakeP = Object.assign({}, pP, { votes: {}, why: {}, proposerId: 'zz' }); P._ruleVote(w, fakeP, pubW); Cx.payVote = fakeP.votes[pubW?.agentId] + ':' + fakeP.why[pubW?.agentId];
      HOMEPROP.enact(w, pP); Cx.payUp = r3(FISCAL.pubRate(w) / pr0); clear(); const pD = HOMEPROP.propose(w, 'home_pay', pubW, -1, ''); HOMEPROP.enact(w, pD); Cx.payBack = r3(FISCAL.pubRate(w) / pr0);
      // 開 AI：村民發想提案時看得到可以改的規定，回答的效果會開成正式提案
      clear(); const pp = HOMEPROP.promptParts(w); Cx.prompt = { has: pp.ctx.includes('home_theft:light') && pp.ctx.includes('home_immig:pause') && pp.ctx.includes('home_pay:up'), cjk: /[一-鿿]/.test(pp.ctx + pp.fx) }; const pA = HOMEPROP.fromAI(w, vs[1], { effects: [{ type: 'homelaw', key: 'home_theft:light' }] }); Cx.fromAI = { kind: pA?.kind, dir: pA?.dir };
      // 送進原本的提案流程：通過後執行
      if (pA) { pA.status = 'approved'; P._execute(w, pA, day()); } Cx.exec = { status: pA?.status, law: law().theft };
      clear(); Hl.theft = 'normal'; Hl.pause = null; Hl.pay = 0; }
    out.C = Cx;

    // ============ AI ============
    { const o = {}; const ce = w.conversationEngine; const a0 = ce._askJson; const prompts = []; let reply = []; ce._askJson = async (p) => { prompts.push(String(p)); return reply; }; if (ce.llm) { ce.llm._quotaLow = () => false; ce.llm._canMakeRequest = () => true; }
      w.fullAgentMode = true; app._fullAgentOn = () => true; o.aiOn = DECIDE.aiOn(w);
      if (o.aiOn) {
        // 家裡的事：生孩子（預設額度）
        const a = take(x => x.age >= 22 && x.age <= 32), b = take(x => x.age >= 22 && x.age <= 32 && x.gender !== a.gender); a.age = 27; b.age = 28; plain(a); plain(b); orphan(a); orphan(b); wed(a, b); const k = HOME.couple(w, a).k; delete H.bp[k];
        X0._asked = 0; X0._kAsked = {}; X0._gAsked = {}; X0._cDay = day(); X0.lastDay = day(); reply = [{ n: 1, pick: 'no', why: 'model reason 52', feel: 'tired' }];
        const n0 = seen.length; DECIDE.askNow(w, [{ a, kind: 'birthPlan', ctx: { k, d: day() } }]); const pending = seen.length === n0; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e = seen.slice(n0).find(x => x.kind === 'birthPlan'); o.home = { pending, id: e?.id, src: e?.src, reason: e?.reason, rec: H.bp[k]?.k, glob: X0._asked };
        const p1 = prompts.find(x => /want＝/.test(x)) || ''; const i0 = p1.indexOf(t('【遇到的事】')); o.p1 = { codes: /want＝/.test(p1) && /wait＝/.test(p1) && /no＝/.test(p1), facts: i0 >= 0 && (p1.slice(i0).includes(I18N?.localizeNames ? I18N.localizeNames(b.name, true) : b.name) || p1.slice(i0).includes(b.name)), cjk: /[一-鿿]/.test(p1), sample: (p1.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 公家的事：王令（civic 那一組）
        X0._gAsked = {}; X0._kAsked = {}; prompts.length = 0; reply = [{ n: 1, pick: 'festival', why: 'edict 33', feel: 'pride' }]; const n1 = seen.length; const dn = w.crown.decrees.length; HOME.decreeAsk(w, king, 'relief'); await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        const e2 = seen.slice(n1).find(x => x.kind === 'decree'); const rec = w.crown.decrees.slice(-1)[0]; o.civic = { id: e2?.id, src: e2?.src, issued: w.crown.decrees.length - dn, key: rec?.key, text: rec?.text, group: X0._gAsked.civic };
        const p2 = prompts.find(x => /festival＝/.test(x)) || ''; o.p2 = { codes: /relief＝/.test(p2) && /none＝/.test(p2), cjk: /[一-鿿]/.test(p2), sample: (p2.match(/.{0,30}[一-鿿]+.{0,30}/) || [''])[0] };
        // 家人沒錢吃飯從來不送去問 AI
        prompts.length = 0; const x = take(), y = take(); plain(x); plain(y); orphan(x); orphan(y); wed(x, y); setCash(x, 0); setCash(y, 100); H.hd = null; MARKET.feed(w, x, 3); await DECIDE.flush(); o.feedNoAi = !prompts.some(p => p.includes('pay＝'));
        // 額度：同一種一天最多 aiKind 件，其餘照個性
        X0._gAsked = {}; X0._kAsked = {}; prompts.length = 0; reply = []; const many = adults().filter(z => !used.has(z.agentId) && !(w.council?.members || []).includes(z.agentId)).slice(0, 4); const n2 = seen.length; DECIDE.askNow(w, many.map(z => ({ a: z, kind: 'postOffer', ctx: { post: 'seat', d: day(), mode: 'pick' } }))); const ruled = seen.slice(n2).filter(z => z.kind === 'postOffer' && z.src === 'rule').length; await DECIDE.flush(); await new Promise(r2 => setTimeout(r2, 20)); await DECIDE.flush();
        o.quota = { kind: KK.postOffer.aiKind, ai: X0._kAsked.postOffer, ruled, n: many.length };
      }
      w.fullAgentMode = false; ce._askJson = a0; app._fullAgentOn = () => false; out.mind = o; }

    // ============ 這個檔裡每一句中文都有翻譯（不靠運氣：逐句查） ============
    { const lits = new Set(); for (const line of src.split('\n')) { if (/^\s*\/\//.test(line)) continue; const code = line.replace(/\/\/ .*$/, ''); for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) { const k = m[1].replace(/\\'/g, "'"); if (/[一-鿿]/.test(k)) lits.add(k); } }
      const bad = [...lits].filter(k => /[一-鿿]/.test(t(k)) && !/^[一-鿿]$/.test(k)); out.lits = { n: lits.size, bad: bad.slice(0, 8), nbad: bad.length }; }

    // ============ 放著跑 120 天 ============
    { const errs0 = []; const d0 = day(); MM.lastT = MONEY.total(w) - MM.pend; const n0 = seen.length; const per = {};
      DECIDE.observe((ev, o) => { if (ev === 'asked' && KEYS.includes(o.kind)) per[o.kind] = (per[o.kind] || 0) + 1; });
      for (let i = 0; i < LONG; i++) { try { tick1(); } catch (e) { errs0.push(String(e.stack || e.message).slice(0, 300)); } if (i % 10 === 0) await new Promise(r2 => setTimeout(r2, 0)); }
      let other = 0; for (const [kk, D] of Object.entries(w.money?.days || {})) if (+kk >= d0) other += Math.abs(D.other || 0);
      out.run = { days: day() - d0, errs: errs0.slice(0, 3), other: Math.round(other * 100) / 100, per, kinds: [...new Set(seen.slice(n0).map(e => e.kind))], pop: npcs().length }; }
    // ============ 存讀檔 ============
    { const o = {}; try { H.bp['x|y'] = { k: 'want', d: day(), by: 'x', n: 0, j: 0, h: '' }; H.law.theft = 'harsh'; H.law.pause = { from: day(), until: day() + 9 }; const data = JSON.parse(JSON.stringify(w.serialize()));
        o.has = !!data.home && data.home.bp?.['x|y']?.k === 'want' && !('hd' in data.home);
        w.loadSave(data); o.back = w.home?.bp?.['x|y']?.k === 'want' && HOME.theftLaw(w) === 'harsh' && HOME.immigPaused(w) === true;
        const old = JSON.parse(JSON.stringify(data)); delete old.home; w.loadSave(old); o.old = !w.home; HOME.S(w); o.oldLaw = HOME.theftLaw(w) === 'normal' && !HOME.immigPaused(w);
        w.home.lastDay = null; HOME.daily(w); o.oldDaily = true; } catch (e) { o.err = String(e.stack || e).slice(0, 300); } out.save = o; }

    const nm = Object.values(w.agents).map(a => a.name).filter(Boolean).sort((x, y) => y.length - x.length); const loc = (s2) => { let r2 = String(s2); try { for (const n of nm) if (r2.includes(n)) r2 = r2.split(n).join(I18N.localizeNames ? I18N.localizeNames(n, true) : n); } catch (e) {} return r2; };
    const nameLoc = [...new Set(nm.map(n => { try { return I18N.localizeNames ? I18N.localizeNames(n, true) : n; } catch (e) { return n; } }))].sort((x, y) => y.length - x.length); const unname = (s2) => { let r2 = String(s2); for (const n of nameLoc) if (n && r2.includes(n)) r2 = r2.split(n).join('NAME'); return r2; }; // 人名歸名字系統管（有些名字的英文只翻了一半），這裡只查文字
    out.seenTexts = seen.map(x => x.reason + ' ' + x.res).filter(Boolean).slice(-150).map(loc).map(unname);
    out.texts = texts.filter(Boolean).map(loc).map(unname);
    return out;
    function LV0(w2) { try { return TIERS.LV[TIERS.level(w2)]; } catch (e) { return { council: '鎮議會', member: '鎮議員' }; } }
    function jobTitle(k2) { try { return JOB_DEFINITIONS[k2].title; } catch (e) { return k2; } }
  }, { KEYS, src, LONG });
  const tag = `[${dev} ${lang}]`; const cjk = (s) => /[一-鿿]/.test(String(s));
  ok(r.on && r.pop >= 90 && r.lv >= 3, `${tag} 決策核心開著，王都 ${r.pop} 人`, { on: r.on, pop: r.pop, lv: r.lv });
  ok(r.reg.every(x => !x.missing && x.scan === false && x.title) && ['decree', 'diploSeason', 'postOffer', 'scandal'].every(k => r.reg.find(x => x.k === k).g === 'civic') && ['birthPlan', 'will', 'adopt', 'royalPick', 'wedAway', 'afterOffice', 'feedHelp'].every(k => !r.reg.find(x => x.k === k).g) && r.civic === 6, `${tag} 登記了十一個選擇點：事件當下送進來；王令、外交、接不接位子、醜事用 civic 那一組（一天 6 件），家裡的事用預設額度`, r.reg);
  { const A = r.A1;
    ok(Object.values(A.facts).every(Boolean) && A.ids === 'want,wait,no', `${tag} 生孩子：事實裡有另一半是誰、結婚幾天、交情、兩人的錢、還沒有孩子、另一半想要孩子；選項想生／再等等／不生了`, { f: A.facts, ids: A.ids });
    ok(A.ask.n === 1 && A.ask.who && A.ask.again === 0 && A.ask.rec, `${tag} 沒商量過的夫妻在算機率時被問一次（問其中一位），同一天不重複問`, A.ask);
    ok(A.prob.want === 1 && A.prob.wait === 0 && A.prob.none === 0, `${tag} 答案只改機率：同一個擲骰值，想生的生得出來，再等等、沒商量過（原本的 2%）的生不出來`, A.prob);
    ok(A.mult.want > 1 && A.mult.wait < 0.5 && A.mult.no < 0.05, `${tag} 想生提高、再等等大幅降低、不生了趨近零（${A.mult.want}／${A.mult.wait}／${A.mult.no}）`, A.mult);
    ok(A.run.k === 'no' && A.run.by && A.run.mem && A.run.upset, `${tag} 選了之後記下來，另一半知道；想法不一樣的另一半心裡不痛快`, A.run);
    ok(A.same === 0 && A.changed === 1 && A.alt, `${tag} 處境沒變六十天內不再問；多了孩子十天後再問，這次換另一位`, { same: A.same, changed: A.changed, alt: A.alt });
    ok(A.lean.pWant === 'want' && A.lean.pFree !== 'want' && A.lean.mWant > A.lean.mFree + 0.8, `${tag} 照個性：兩個人都顧家的想生；崇尚自由、年紀大、孩子多的不想`, A.lean);
    ok(A.off.mult === 1 && A.off.asked === 0, `${tag} 決策核心沒開：不問，機率照原本`, A.off); }
  { const A = r.A2;
    ok(A.ask.asked && A.ask.max3 && A.ask.onlyOld && A.ask.made, `${tag} 遺囑：60 歲以上或病重的人被問，一天最多三個`, A.ask);
    ok(Object.values(A.facts).every(Boolean) && Object.values(A.ids).every(Boolean), `${tag} 事實裡有年紀、錢、繼承人、最常來看他的、最疼的、好朋友；選項有平分、多給某一位（兩位人選）、留給朋友、捐給鎮上`, { f: A.facts, ids: A.ids });
    ok(A.order && A.fav.half && A.fav.even && Math.abs(A.fav.sum - A.fav.net) < 0.02 && A.fav.leak === 0 && A.fav.hurt && A.fav.aff <= -7 && A.fav.spMood, `${tag} 照遺囑分：多給的那一位拿一半再平分其餘（${A.fav.k1}／${A.fav.k2}／${A.fav.sp}），產業房子排第一；被少分的家人記得、對他冷淡；錢守恆`, A.fav);
    ok(A.friend.ok && A.friend.leak === 0 && A.town.ok && A.town.leak === 0 && A.none.eq && A.none.leak === 0, `${tag} 留三成給朋友、捐一半給鎮上都照分；沒立遺囑的照原本平分；錢守恆`, { f: A.friend, t: A.town, n: A.none });
    ok(A.again.quiet && A.again.changed, `${tag} 立過遺囑的不重複問；家裡多了一個孩子、過了十五天再問`, A.again);
    ok(A.lean.mT1 > A.lean.mT2 + 0.5 && A.lean.fav1 > A.lean.fav2 + 0.3, `${tag} 照個性與交情：大方、看重社群的比貪心的想捐；偏疼某個孩子的比一樣疼的想多給`, A.lean);
    ok(A.off === 0, `${tag} 決策核心沒開：不問，照原本平分`, A.off); }
  { const A = r.A3;
    ok(A.pay.who && A.pay.decided && A.pay.logged && A.pay.y === 3 && A.pay.xSame && A.cache === 0, `${tag} 家人沒錢吃飯：另一半照個性決定替他出（沒寫進紀錄、同一天不重算），錢守恆`, { p: A.pay, c: A.cache });
    ok(Object.values(A.facts).every(Boolean) && A.ids === 'pay,no', `${tag} 事實裡有誰沒錢、多少錢、交情、自己的錢；選項替他出／這次不出`, { f: A.facts, ids: A.ids });
    ok(A.lean.hostile === 'no' && A.next.who && A.next.z === 3 && A.next.mem && A.next.aff < 0 && A.next.y === 20, `${tag} 感情差、自己也拮据的不出：他記在心裡，換下一位家人出`, { l: A.lean, n: A.next });
    ok(A.none.fed === false && A.none.kept, `${tag} 都不肯：照原本沒錢吃飯`, A.none);
    ok(A.kid.who && A.kid.asked === 0, `${tag} 小孩的飯錢照舊由家裡出，不問`, A.kid);
    ok(A.off && A.noAi, `${tag} 決策核心沒開：最有錢的家人照付；這一項從來不問 AI`, { off: A.off, noAi: A.noAi }); }
  { const A = r.A4;
    ok(A.order.first && A.order.second && A.res.guard && A.res.parent && A.res.here && A.res.gNo && A.res.uMem, `${tag} 親戚的孩子：最親的祖父母先被問、不接，再問阿姨，阿姨收養；孩子記得誰不肯`, { o: A.order, r: A.res });
    ok(Object.values(A.facts).every(Boolean) && A.ids === 'take,no', `${tag} 事實裡有被逐出的是誰、孩子幾歲、自己的錢；選項接來養／不接`, { f: A.facts, ids: A.ids });
    ok(A.allNo.gone && A.allNo.log, `${tag} 都不接：孩子跟著離開小鎮`, A.allNo);
    ok(A.off.asked === 0 && A.off.adopted, `${tag} 決策核心沒開：照原本最親的收養`, A.off); }
  { const A = r.A5;
    ok(A.cands >= 2 && A.facts.names && A.ids.filter(x => x === 'pick').length >= 2 && A.ids.includes('wait') && A.ruleTop, `${tag} 國王成婚：事實裡有幾位人選；照個性時原本的第一人選（階層最高）排第一`, { c: A.cands, ids: A.ids, f: A.facts, top: A.ruleTop });
    ok(A.love, `${tag} 浪漫、很喜歡另一位人選的國王挑他`, A.love);
    ok(A.no.pick && A.no.prop && A.no.single && A.no.blocked && A.no.kmem, `${tag} 被挑上的人走原本的「對方向你求婚」：崇尚自由又討厭國王的拒絕，國王沒成婚、記在心裡`, A.no);
    ok(A.yes.notB1 && A.yes.married && A.yes.royal && A.yes.log && A.plainProp, `${tag} 拒絕過的不在下一次的人選裡；想要權力的答應，成了王族；原本的求婚照舊`, { y: A.yes, plain: A.plainProp });
    ok(A.grand && A.dice, `${tag} 什麼時候想成婚照舊看天（每天 2%）`, { g: A.grand, d: A.dice });
    ok(A.off, `${tag} 決策核心沒開：照原本娶階層最高的`, A.off); }
  { const A = r.A6;
    ok(A.places > 0 && A.yes.asked && A.yes.gone && A.yes.wed && A.yes.rel === 25, `${tag} 聯姻：被嫁的人被問；答應就嫁過去、離開小鎮，兩地關係大升`, A.yes);
    ok(A.facts.p && A.facts.l && A.ids === 'yes,no,run' && A.plainIds === 'yes,no', `${tag} 事實裡有嫁去哪裡、誰要他嫁；崇尚自由的才有「逃婚」`, { f: A.facts, ids: A.ids, plain: A.plainIds });
    ok(A.no.here && A.no.rel === -10 && A.no.laff <= -12 && A.no.wedNo && A.no.noWed && A.no.legit < 0, `${tag} 拒絕：人留下，兩地關係變差，首長（國王）沒面子、對他冷淡，60 天內不再找他`, A.no);
    ok(A.loverIds === 'yes,no,run' && A.loverPick !== 'yes' && A.run.married && A.run.rel === -20, `${tag} 有心上人的不肯嫁；逃婚就跟心上人成親，關係更差`, { ids: A.loverIds, pick: A.loverPick, run: A.run });
    ok(A.rebelIds.includes('run') && A.hide.away, `${tag} 沒有心上人、個性叛逆的逃到外地躲起來`, { ids: A.rebelIds, h: A.hide });
    ok(A.off.asked === 0 && A.off.gone, `${tag} 決策核心沒開：照原本直接嫁過去`, A.off); }
  { const B = r.B7;
    ok(Object.values(B.facts).every(Boolean), `${tag} 王令：事實裡有公庫、稅率、民心、窮人有幾個、誰在罵他`, B.facts);
    ok(B.ids === 'relief,tax_up,tax_down,festival,amnesty,curfew,none' && B.rule === 'festival', `${tag} 選項有賑災、加稅、減稅、慶典、大赦、宵禁、這次不頒；照個性時原本會挑的那一道排第一`, { ids: B.ids, rule: B.rule });
    ok(B.res.relief.up && B.res.relief.down && B.res.relief.leak === 0 && B.res.relief.rec && B.res.up === 0.05 && B.res.down === -0.05 && B.res.festival.mood >= 6 && B.res.festival.rec && B.res.festival.leak === 0 && B.res.amnesty && B.res.curfew < 0 && B.res.none.n === 0 && B.res.none.log, `${tag} 每一種照原本結算：賑災錢從公庫到窮人、稅率加減 5%、慶典大家開心（公庫的錢付給食堂與農莊）、大赦、宵禁心情變差、不頒就沒有王令；錢守恆`, B.res);
    ok(B.lean.mR > B.lean.mR2 + 0.5 && B.lean.mU > B.lean.mU0 + 0.3, `${tag} 照個性：心腸好的賑災，貪心愛權的加稅`, B.lean);
    ok(B.daily.asked && B.daily.issued === 1 && B.off.asked === 0 && B.off.issued === 1, `${tag} 每十天由國王自己決定；決策核心沒開照原本的順序挑`, { d: B.daily, off: B.off }); }
  { const B = r.B8;
    ok(Object.values(B.facts).every(Boolean) && B.ids === 'envoy,gift,wed,none' && B.envN === 2 && B.rule === 'envoy', `${tag} 外交：事實裡有各地關係、珍品、盟友；選項派使節（兩位人選）、送禮、提聯姻、這次不理`, { f: B.facts, ids: B.ids, n: B.envN, rule: B.rule });
    ok(B.same && B.envoy.first && B.envoy.second && B.envoy.e1Here && B.envoy.e2Away && B.envoy.rel && B.envoy.decl, `${tag} 被挑上的使節可以推辭：第一位推辭，換第二位出使，關係變好`, B.envoy);
    ok(B.none, `${tag} 人選都推辭：這次作罷`, B.none);
    ok(B.gift.rel === 20 && B.gift.gone && B.wed && B.skip, `${tag} 送禮關係加 20、珍品送出去；提聯姻就問被嫁的人；這次不理就沒有動作`, { g: B.gift, wed: B.wed, skip: B.skip });
    ok(B.daily && B.off.asked === 0 && B.off.acted, `${tag} 每十天由首長自己決定；決策核心沒開照原本`, { d: B.daily, off: B.off }); }
  { const B = r.B9;
    ok(Object.values(B.tFacts).every(Boolean) && B.tIds.includes('yield'), `${tag} 王位：事實裡有先王、弟妹、民心；感情好的弟妹可以讓`, { f: B.tFacts, ids: B.tIds });
    ok(B.throne.first && B.throne.second && B.throne.king && B.throne.h1Log, `${tag} 長子不接（怕生又懶），往下找，次子接下王位`, B.throne);
    ok(B.yieldOpt && B.yieldAsk && B.yield.king && B.yieldLean.kind > B.yieldLean.amb + 0.5, `${tag} 讓給弟妹：弟妹被問、接下王位；心腸好又跟弟妹親的比有野心的想讓`, { y: B.yield, ask: B.yieldAsk, lean: B.yieldLean });
    ok(B.crisis, `${tag} 繼承人都不接：進繼承危機（照原本）`, B.crisis);
    ok(B.seat.s2In && !B.seat.s1In && B.seat.asked === '1,2' && B.seat.facts && B.seatOk.declined === 'no' && B.seatOk.off === 'yes', `${tag} 議員遞補：第一位推辭，換第二位遞補；推辭的人一個月內不再問；沒開照原本直接遞補`, { s: B.seat, ok: B.seatOk });
    ok(B.acting.got && B.acting.asked === 2 && B.acting.off, `${tag} 代理首長：不肯接的跳過，下一位答應；沒開照原本`, B.acting);
    ok(B.lean.amb > 0 && B.lean.shy < 0, `${tag} 照個性：有野心的接，怕生又懶的不接`, B.lean); }
  { const B = r.B10;
    ok(B.asked && B.facts.v && B.facts.council && B.ids === 'resign,deny,sorry,counter', `${tag} 醜事被揭穿：本人被問；事實裡有牽涉到誰；選項辭職、否認、道歉不辭、反咬一口`, { a: B.asked, f: B.facts, ids: B.ids });
    ok(B.resign && B.deny.stay && B.deny.aff === -6 && B.deny.sc === 2 && B.deny.sched && B.deny.forced, `${tag} 辭職就下台；否認的人留著，但認識他的人更不滿、醜聞分數加 2，五天後新證據逼他下台`, { r: B.resign, d: B.deny });
    ok(B.sorry.stay && B.sorry.aff === -3 && B.sorry.sc === 1 && B.sorry.held && B.counter.stay && B.counter.vaff <= -25 && B.counter.sc === 3 && B.counter.vmem, `${tag} 道歉不辭：代價小一點，撐得過；反咬一口：被咬的人恨他、醜聞分數加 3`, { s: B.sorry, c: B.counter });
    ok(B.lean.mK > B.lean.mA + 0.5 && B.lean.ambPick !== 'resign', `${tag} 照個性：心腸好的辭職，有野心、愛權的不辭`, B.lean);
    ok(B.mayorIds && B.mayor.out && B.mayor.after && B.afterIds === 'trader,prev,farmer' && B.afterFacts && B.afterJob === 'blacksmith', `${tag} 首長買票被揭穿辭職下台，接著自己決定下台以後做什麼（回去當鐵匠）`, { ids: B.mayorIds, m: B.mayor, a: B.afterIds, f: B.afterFacts, j: B.afterJob });
    ok(B.off.asked === 0 && B.off.out, `${tag} 決策核心沒開：照原本辭職`, B.off); }
  { const C = r.C;
    ok(C.theftProp.kind === 'home_theft' && C.theftProp.dir === 'harsh' && C.theftProp.byVictim, `${tag} 偷竊罰則：一個月內被偷的人多了，被偷過的人提「從重」`, C.theftProp);
    ok(C.theftVote.victim === 'for:theft_victim' && C.theftVote.kin === 'against:theft_kin' && C.theftVote.thief === 'against' && C.theftVote.whyText, `${tag} 表決：被偷過的贊成、家人被關過的反對，理由看得出立場`, C.theftVote);
    ok(C.harsh === 'harsh' && C.harshJail.jail === 5 && C.lightJail.jail === 0 && C.lightJail.fine > 0 && C.lightJail.leak === 0 && C.normalJail.jail === 3 && C.harshJail.leak === 0, `${tag} 生效：從重關 5 天、從輕不關改罰錢給公庫、照舊關 3 天；錢守恆`, { h: C.harshJail, l: C.lightJail, n: C.normalJail });
    ok(C.immigProp.kind === 'home_immig' && C.immigProp.dir === 'pause' && C.immigProp.byJobless && C.immigVote === 'for:immig_job', `${tag} 移民：找不到工作的人多了，失業的人提暫停收人，失業的人贊成`, { p: C.immigProp, v: C.immigVote });
    ok(C.paused && C.noSpawn && C.expired && C.repaused && C.lowPop && C.openProp.dir === 'open' && C.opened, `${tag} 暫停期間沒人搬來；到期、人口太少自動失效；人變少時東家提重新開放`, C);
    ok(C.payProp.kind === 'home_pay' && C.payVote === 'for:pay_mine' && C.payUp === 1.1 && C.payBack === 1, `${tag} 公職薪水：領公家薪水的贊成；調高一級後公職薪水倍率多一成，調低回來`, { p: C.payProp, v: C.payVote, up: C.payUp, back: C.payBack });
    ok(C.prompt.has && (zh || !C.prompt.cjk) && C.fromAI.kind === 'home_theft' && C.fromAI.dir === 'light' && C.exec.status === 'done' && C.exec.law === 'light', `${tag} 開 AI：發想提案時看得到可以改的規定，回答的效果開成正式提案，通過後真的改`, { p: C.prompt, a: C.fromAI, e: C.exec }); }
  ok(!r.save.err && r.save.has && r.save.back && r.save.old && r.save.oldLaw && r.save.oldDaily, `${tag} 存讀檔：商量過的、規定都還在；舊存檔（沒有這一版的欄位）讀進來照常跑`, r.save);
  { const M = r.mind;
    ok(M.aiOn && M.home && M.home.pending && M.home.id === 'no' && M.home.src === 'ai' && M.home.reason === 'model reason 52' && M.home.rec === 'no' && M.home.glob >= 1, `${tag} 開 AI：家裡的事（生孩子）題目當場送出、等回話，採用它的答案與理由，用預設額度`, M.home);
    ok(M.p1 && M.p1.codes && M.p1.facts && M.civic && M.civic.src === 'ai' && M.civic.issued === 1 && M.civic.key === 'festival' && M.civic.text === 'edict 33' && M.civic.group === 1 && M.p2.codes, `${tag} 王令用 civic 那一組：AI 選的慶典真的頒了，理由當作詔書`, { p1: M.p1, c: M.civic, p2: M.p2 });
    ok(zh || (!M.p1.cjk && !M.p2.cjk), `${tag} 英文題目裡沒有中文`, zh ? null : { p1: M.p1.sample, p2: M.p2.sample });
    ok(M.feedNoAi && M.quota && M.quota.ai === M.quota.kind && M.quota.n >= 3 && M.quota.ruled === M.quota.n - M.quota.kind, `${tag} 家人沒錢吃飯不問 AI；同一種一天最多 ${M.quota?.kind} 件問 AI，其餘當場照個性決定`, { f: M.feedNoAi, q: M.quota }); }
  ok(r.lits.n > 200 && (zh || r.lits.nbad === 0), `${tag} sim-decide-home.js 裡 ${r.lits.n} 句中文逐句查過，英文模式都有英文`, zh ? null : r.lits);
  { const Ru = r.run;
    ok(Ru.errs.length === 0 && Ru.days === LONG && Ru.other === 0, `${tag} 王都放著跑 ${Ru.days} 天：沒有錯誤、帳上沒有對不上的錢`, Ru); console.log('   ', JSON.stringify(Ru)); }
  ok(zh || (!r.texts.some(cjk) && !r.seenTexts.some(cjk)), `${tag} 標題、事實、選項、理由、結果都有英文`, zh ? null : { texts: r.texts.filter(cjk).slice(0, 6), seen: r.seenTexts.filter(cjk).slice(0, 4) });
  ok(errs.length === 0, `${tag} 沒有頁面錯誤`, errs.slice(0, 3));
  await ctx.close();
}
(async () => { const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en'); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
