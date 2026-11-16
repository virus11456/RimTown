// v10.1.0 公告欄、信、流言。不連線、不呼叫真的 AI：AI 的回答用 DECIDE.applyAi 直接餵，其餘都是真的遊戲程式。
// 看：貼告示／寫信 → 看到的人各自回應 → 隔天有結果（付錢、到場、和好、鬧翻）；流言一手一手記下來，傳到本人耳裡由他決定；
//     個人企劃的熱鬧事會貼上公告欄；存讀檔；介面（桌機、手機 390px 中英）：企劃併進「往來」，提案頁維持五個子分頁
// 用法：node scripts/v101000_test.js     需要本機服務 chrome-extension/（預設 8126，可用 BASE 換）
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/'; const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'test-results', 'board');
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 700) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function open(browser, lang, vp) {
  const page = await (await browser.newContext({ viewport: vp, serviceWorkers: 'block' })).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
  return { page, errs };
}
const stage = () => {
  const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; app._gameAlert = () => {};
  const notices = []; const _cn = app._showCornerNotice.bind(app); app._showCornerNotice = (o) => { notices.push({ icon: o.icon, title: o.title, name: o.name, desc: o.desc }); return _cn(o); };
  let s = 7; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  w.reset(); w.observerMode = true; ORIGIN.seed(w, 2, { seed: 22 }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
  app._fullAgentOn = () => false; try { app._visitorMailboxTick(); } catch (e) {} w.fullAgentMode = false;
  const out = {}; const tickN = (n) => { for (let i = 0; i < n; i++) { w.paused = false; w.tick(); } };
  const toHour = (h, m = 0) => { let g = 0; while (g++ < 200 && !((w.clock.hour === h) && (w.clock.minute >= m))) tickN(1); };
  const midnight = () => { const d = w._absDay(); let g = 0; while (g++ < 200 && w._absDay() === d) tickN(1); };
  const aff = (a, b) => a.relationships?.relationships?.[b.agentId]?.affinity || 0;
  const setAff = (a, b, v) => { const r = a.relationships.getOrCreate(b.agentId, b.name); r.modifyAffinity(v - (r.affinity || 0)); };
  const setCash = (a, n) => { const c = WALLET.get(w, a); if (n > c) WALLET.add(w, a, n - c); else if (n < c) WALLET.take(w, a, c - n); };
  const X = BOARD.S(w); const V = (id) => BOARD.view(w, 60).find(v => v.id === id);
  // 1. AI 關著跑 12 天：照個性也有人貼告示、寫信，流程自己走完
  tickN(96 * 12); const L0 = X.list.slice();
  out.rule = { n: L0.length, kinds: [...new Set(L0.map(B => B.kind))], bad: L0.filter(B => !['open', 'set', 'done', 'gone'].includes(B.stage) || (B.stage === 'done' && !B.out)).length, stuck: L0.filter(B => B.stage === 'done' && B.re.some(q => q.s === 'asked')).length, ai: L0.filter(B => B.ai).length,
    replied: L0.reduce((n, B) => n + B.re.filter(q => q.s !== 'asked').length, 0), rumors: X.rumors.length, hops: X.rumors.reduce((n, R) => n + R.hops.length, 0), sample: BOARD.view(w, 4).map(v => ({ id: v.id, k: v.kindName, text: v.text, out: v.out?.text || '', re: v.re.map(q => q.label) })) };
  X.quiet = true; for (const B of X.list) if (B.stage === 'open' || B.stage === 'set') { B.stage = 'gone'; } if (typeof SCHEME !== 'undefined') { SCHEME.S(w).quiet = true; for (const P of SCHEME.S(w).list) if (P.stage === 'recruit' || P.stage === 'set') { P.stage = 'dropped'; P.out = { ok: false, k: '作罷', p: {} }; } }
  w.decide.q = []; // 之後只看排好的幾件
  const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId)); out.adults = A.length;
  const [a1, b1, c1, a2, b2, a3, b3, a4, f4, g4, h4, a5, j5, k5, a6, b6, a7, b7, s8, q8, x8, y8] = A;
  const K = DECIDE.KINDS; const reply = (kind, B, x, row) => { const ctx = { bid: B.id }; const o = K[kind].options(w, x, ctx); const ids = o.map(e => e.id); DECIDE.applyAi(w, x, K[kind], ctx, o, row); return ids; };
  const total = () => A.reduce((n, a) => n + WALLET.get(w, a), 0);
  // 2. 徵人：缺錢的人接下，拿到酬勞；第二個人來晚了
  setCash(a1, 80); setCash(b1, 2); const m0 = total(); const B2 = BOARD.create(w, a1, { kind: 'hire', price: 8, text: '找人幫我把柴房的屋頂補一補', why: '其實是想看看誰肯幫我', readers: [b1, c1], ai: true });
  out.h0 = { id: B2?.id, re: B2?.re.map(q => q.s), q: w.decide.q.length };
  out.hOpts = reply('boardRead', B2, b1, { pick: 'take', why: '這幾天手頭真的很緊', feel: '缺錢', say: '這活我來，明天一早就到' }); out.hLate = (reply('boardRead', B2, c1, { pick: 'take', why: '順手賺一點' }), B2.re[1].s);
  out.h1 = { s: B2.re[0].s, y: B2.re[0].y?.raw, pub: B2.re[0].pub, paid: B2.paid, a: WALLET.get(w, a1), b: WALLET.get(w, b1), same: total() === m0, taker: B2.taker === b1.agentId };
  // 3. 賣東西：錢不夠買不成；另一個人嫌貴
  setCash(b2, 1); const B3 = BOARD.create(w, a2, { kind: 'sell', price: 9, text: '祖傳的銅壺，九個銀幣', readers: [b2, c1], ai: true }); reply('boardRead', B3, b2, { pick: 'buy', why: '想要' }); reply('boardRead', B3, c1, { pick: 'haggle', why: '哪值這個價' });
  out.s1 = { re: B3.re.map(q => q.s), taker: B3.taker, cash: WALLET.get(w, b2) };
  // 4. 尋物：不老實的人撿到了不還（只有觀察者知道）
  b3.personality.traits = ['gossip', 'lazy', 'jealous']; const sec0 = (w.dark?.secrets || []).length; const B4 = BOARD.create(w, a3, { kind: 'lost', price: 3, text: '我的銀釦子掉了', readers: [b3], ai: true }); const o4 = reply('boardRead', B4, b3, { pick: 'kept', why: '誰撿到就是誰的' });
  out.l1 = { opts: o4, s: B4.re[0].s, kept: B4.kept, secret: (w.dark?.secrets || []).length - sec0 };
  // 5. 抱怨：一個附和、一個替他說話、本人回嗆
  setAff(g4, f4, 0); setAff(h4, f4, 60); const gf0 = aff(g4, f4), fh0 = aff(f4, h4), af0 = aff(a4, f4);
  const B5 = BOARD.create(w, a4, { kind: 'gripe', about: f4, text: `${f4.name}借了東西從來不還`, why: '就是要他難看', readers: [f4, g4, h4], ai: true });
  out.g0 = { tOpts: reply('boardRead', B5, f4, { pick: 'fire', why: '他憑什麼', say: '你自己欠的才多' }), rOpts: reply('boardRead', B5, g4, { pick: 'agree', why: '我也被他借過' }) }; reply('boardRead', B5, h4, { pick: 'defend', why: '他幫過我' });
  out.g1 = { re: B5.re.map(q => q.s), gf: aff(g4, f4) - gf0, fh: aff(f4, h4) - fh0, af: aff(a4, f4) - af0, about: B5.about === f4.agentId };
  // 6. 邀約：兩個人說要去
  setAff(j5, a5, 90); setAff(k5, a5, 90); setCash(a5, 40); const B6 = BOARD.create(w, a5, { kind: 'invite', place: 'tavern', hour: 18, price: 3, text: '明天傍晚酒館，我請', readers: [j5, k5], ai: true }); reply('boardRead', B6, j5, { pick: 'join', why: '有酒當然去' }); reply('boardRead', B6, k5, { pick: 'join', why: '好久沒聚' });
  // 7. 情書被拿給別人看：變成一則八卦
  const G = w.gossipNetwork; const g0 = G.activeGossip.length; const B7 = BOARD.create(w, a6, { kind: 'letter', want: 'love', to: b6, text: '我每天都在想你', why: '再不說就來不及了', ai: true });
  out.v0 = { opts: reply('letterGot', B7, b6, { pick: 'show', why: '太好笑了', feel: '好玩' }), priv: V(B7.id)?.priv, noRecipient: BOARD.create(w, a6, { kind: 'letter', want: 'love', to: '沒有這個人', text: '你好' }) === null };
  out.v1 = { s: B7.re[0].s, leak: B7.leak, gossip: G.activeGossip.length - g0, about: G.activeGossip[G.activeGossip.length - 1]?.about === a6.name };
  // 8. 約見面：答應了
  setAff(b7, a7, 80); setAff(a7, b7, 60); const B8 = BOARD.create(w, a7, { kind: 'letter', want: 'meet', to: b7, place: 'town_square', hour: 17, text: '明天下午廣場見，有話想說', ai: true }); reply('letterGot', B8, b7, { pick: 'yes', why: '他難得開口' });
  // 9. 個人企劃的熱鬧事貼上公告欄，看到的人自己報名
  const P9 = SCHEME.create(w, c1, { tone: 'fun', title: '在廣場辦一場擲石頭比賽', why: '日子太悶了', helpers: [b1], place: 'town_square', ai: true }); const B9 = X.list.find(B => B.sid === P9?.id);
  out.e0 = { post: !!B9, kind: B9?.kind, bid: P9?.bid === B9?.id, readers: B9?.re.length, notAsked: B9 ? !B9.re.some(q => q.id === b1.agentId) : null };
  if (B9 && B9.re[0]) { const x = w.agents[B9.re[0].id]; reply('boardRead', B9, x, { pick: 'join', why: '看起來好玩' }); out.e1 = { walk: P9.ask.some(q => q.id === x.agentId && q.walk && q.s === 'yes'), view: SCHEME.view(w, 40).find(v => v.id === P9.id)?.ask.some(q => q.walk) }; }
  const secret9 = SCHEME.create(w, a2, { tone: 'spite', title: '在他的貨裡動手腳', target: b2, helpers: [c1], ai: true }); out.e2 = { secretNotPosted: !X.list.some(B => B.sid === secret9?.id) };
  // 10. 流言：一手一手記下來；傳到本人耳裡由他決定
  let rc = 0; const _r = Math.random; Math.random = () => { rc++; return _r(); };
  const gA = { about: s8.name, content: `${s8.name}偷拿了店裡的錢`, source: q8.name, spreadCount: 1, tickCreated: w.tickCount, isTrue: false, tone: 'diss', juicy: true }; G.activeGossip.push(gA);
  const c0 = rc; BOARD.hop(w, gA, q8, x8); gA.content = `${s8.name}偷了好幾次店裡的錢，老闆都知道了`; BOARD.hop(w, gA, x8, y8); out.r0 = { rng: rc - c0, rid: gA.rid, hops: BOARD.getR(w, gA.rid)?.hops.length, changed: !!BOARD.getR(w, gA.rid)?.hops[1].x, first: !BOARD.getR(w, gA.rid)?.hops[0].x }; Math.random = _r;
  const qs0 = aff(s8, q8); gA.spreadCount = 4; G._handleGossipReachesSubject(gA, w); const R1 = BOARD.getR(w, gA.rid);
  out.r1 = { st: R1.st, asked: R1.re?.s, held: aff(s8, q8) === qs0, queued: w.decide.q.some(e => e.kind === 'rumorHit') };
  { const ctx = { rid: R1.id }; const o = K.rumorHit.options(w, s8, ctx); out.r2opts = o.map(e => e.id); DECIDE.applyAi(w, s8, K.rumorHit, ctx, o, { pick: 'clear', why: '不說清楚以後怎麼做人', feel: '面子', say: '我沒有拿過店裡一毛錢，誰說的站出來' }); }
  const BC = R1.re?.bid ? BOARD.get(w, R1.re.bid) : null; out.r2 = { st: R1.st, s: R1.re?.s, y: R1.re?.y?.raw, pub: R1.re?.pub, post: BC?.kind, text: BC?.text?.raw, readers: BC?.re.map(q => q.id), again: (G._handleGossipReachesSubject(gA, w), R1.st) };
  // 對質：走原本的處理（交情真的掉）
  const gB = { about: a1.name, content: `${a1.name}做生意不老實`, source: b2.name, spreadCount: 4, tickCreated: w.tickCount, isTrue: false, tone: 'diss', juicy: true }; G.activeGossip.push(gB); BOARD.hop(w, gB, b2, c1); const ab0 = aff(a1, b2); G._handleGossipReachesSubject(gB, w); const R2 = BOARD.getR(w, gB.rid);
  { const ctx = { rid: R2.id }; const o = K.rumorHit.options(w, a1, ctx); DECIDE.applyAi(w, a1, K.rumorHit, ctx, o, { pick: 'confront', why: '當面問清楚' }); } out.r3 = { s: R2.re?.s, drop: aff(a1, b2) - ab0 };
  // 好話不攔：照原本的路走，不開流言的決定
  const gC = { about: a3.name, content: `${a3.name}最近超罩的`, source: b3.name, spreadCount: 4, tickCreated: w.tickCount, isTrue: true, tone: 'praise' }; G.activeGossip.push(gC); out.r4 = { took: BOARD.reach(w, gC), noCard: !gC.rid };
  // 真的經過八卦網路傳一手：回傳值不變，多記一筆
  { const gD = { about: a4.name, content: `${a4.name}脾氣很差`, source: f4.name, spreadCount: 0, tickCreated: w.tickCount, isTrue: true, tone: 'diss', juicy: true }; G.activeGossip.length = 0; G.activeGossip.push(gD); const ok0 = SOCIAL.gossipOk; SOCIAL.gossipOk = () => true; const r0 = Math.random; Math.random = () => 0.01; let got = null; try { got = G.spreadGossip(g4, h4, w); } finally { Math.random = r0; SOCIAL.gossipOk = ok0; } out.r5 = { same: got === gD, hops: gD.rid ? BOARD.getR(w, gD.rid).hops.length : 0 }; }
  out.noticeKinds = { board: notices.filter(n => /B\d{3}/.test(n.title || '')).length, rumor: notices.filter(n => /R\d{3}/.test(n.title || '')).length };
  // 半夜：有結果、說定
  const drain = () => DECIDE.drain(w, DECIDE.S(w), w._absDay()); drain(); midnight(); tickN(1);
  out.h2 = { stage: B2.stage, ok: B2.out?.ok, text: V(B2.id)?.out?.text }; out.s2 = { stage: B3.stage, ok: B3.out?.ok, text: V(B3.id)?.out?.text }; out.l2 = { stage: B4.stage, ok: B4.out?.ok, kept: V(B4.id)?.kept };
  out.g2 = { stage: B5.stage, text: V(B5.id)?.out?.text }; out.v2 = { stage: B7.stage, text: V(B7.id)?.out?.text };
  out.i1 = { stage: B6.stage, today: B6.when === w._absDay(), going: (B6.going || []).length, go: [a5, j5, k5].map(x => x._thingGo?.id === B6.id) }; out.m1 = { stage: B8.stage, go: [a7, b7].map(x => x._thingGo?.id === B8.id) };
  toHour(17, 0); tickN(2); const sq = w.townMap?.locations?.town_square; out.m2 = { at: [a7, b7].map(x => x.currentLocation) };
  toHour(19, 0); out.i2 = { stage: B6.stage, ok: B6.out?.ok, came: (B6.came || []).length, text: V(B6.id)?.out?.text, paid: 40 - WALLET.get(w, a5) > 0 }; out.m3 = { stage: B8.stage, hasOut: !!B8.out, text: V(B8.id)?.out?.text };
  midnight(); tickN(1); midnight(); tickN(1); out.e3 = B9 ? { stage: B9.stage, text: V(B9.id)?.out?.text } : null; out.c1 = BC ? { stage: BC.stage, text: V(BC.id)?.out?.text } : null;
  // 手記收得到
  out.notes = { notice: NOTES.entriesOf(w, a1.agentId).some(e => e.t === 'notice' && /屋頂/.test(e.text)), letter: NOTES.entriesOf(w, a6.agentId).some(e => e.t === 'letter'), kind: !!NOTES.KIND.notice && !!NOTES.KIND.letter };
  // 存檔、讀檔、開新鎮
  const sv = JSON.parse(JSON.stringify(w.serialize())); out.save = { has: !!sv.board, n: sv.board?.list.length, r: sv.board?.rumors.length, kb: Math.round(JSON.stringify(sv.board || {}).length / 102.4) / 10 };
  out.stats = BOARD.stats(w); out.viewN = { all: BOARD.view(w, 60).length, letters: BOARD.view(w, 60, 'letter').length, notes: BOARD.view(w, 60, 'notice').length, rumors: BOARD.rumors(w, 30).length };
  window.__sv = sv; return out;
};
const ui = ({ only }) => {
  const app = window.rimtownApp; const w = app.world; document.querySelectorAll('#season-recap,.season-recap,.rt-modal-overlay,.rt-toast').forEach(x => x.remove()); try { app._updateTabHighlight?.('proposals'); } catch (e) {}
  app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'proposals'; app._ppTab = 'mail'; app._bdOnly = only; app.renderSidebar();
  const root = document.getElementById('sidebar-content'); const tabs = [...root.querySelectorAll('.proposals-panel > .pp-tabs .pp-tab')]; const bar = root.querySelector('.proposals-panel > .pp-tabs'); const br = bar.getBoundingClientRect();
  const cut = (el) => el.scrollWidth > el.clientWidth + 1; const cjk = (s) => /[一-鿿]/.test(s);
  return { tabs: tabs.map(b => b.dataset.ppTab), tabFit: tabs.every(b => { const r = b.getBoundingClientRect(); return r.left >= br.left - 1 && r.right <= br.right + 1 && r.width >= 24; }), tabH: Math.min(...tabs.map(b => Math.round(b.getBoundingClientRect().height))),
    chips: [...root.querySelectorAll('[data-bd-only]')].map(b => b.dataset.bdOnly), chipH: Math.min(...[...root.querySelectorAll('[data-bd-only]')].map(b => Math.round(b.getBoundingClientRect().height))),
    cards: root.querySelectorAll('.sk-card').length, plan: root.querySelectorAll('.sk-card:not(.bd-card)').length, note: root.querySelectorAll('.bd-card:not(.bd-letter):not(.bd-rumor)').length, letter: root.querySelectorAll('.bd-letter').length, rumor: root.querySelectorAll('.bd-rumor').length,
    wide: Math.round(root.getBoundingClientRect().width), over: [...root.querySelectorAll('.sk-card')].filter(c => cut(c) || c.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).length, pageOver: document.documentElement.scrollWidth > window.innerWidth + 1,
    labelsCjk: [...root.querySelectorAll('.sk-stage,.sk-tone,.pv-chip,.pp-tabhint,.pp-tab,.pv-lab,.sk-meta')].map(e => e.textContent.trim()).filter(cjk).slice(0, 6), hint: root.querySelector('.pp-tabhint')?.textContent.slice(0, 30),
    hasWhy: !!root.querySelector('.bd-why'), hasPub: !!root.querySelector('.pv-pub'), hops: root.querySelectorAll('.bd-hops .sk-a').length, whoBtn: root.querySelectorAll('.bd-card .pv-who:not([disabled])').length };
};
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true }); const browser = await chromium.launch();
  const { page, errs } = await open(browser, 'zh', { width: 1280, height: 800 }); const o = await page.evaluate(stage); console.log(JSON.stringify(o).slice(0, 6000));
  ok(o.rule.n >= 3 && o.rule.kinds.length >= 2 && o.rule.bad === 0 && o.rule.stuck === 0 && o.rule.ai === 0, 'AI 關著跑 12 天：有人貼告示或寫信，每一件都走到合法的狀態', o.rule);
  ok(o.rule.replied >= 2, 'AI 關著時看到的人也會回應（照個性與交情）', o.rule.replied);
  ok(o.h0.id === 'B' + String(o.rule.n + 1).padStart(3, '0') && o.h0.re.join() === 'asked,asked' && o.h0.q === 2, '貼一張告示：有編號，看到的人排進決策核心', o.h0);
  ok(o.hOpts.includes('take') && o.hOpts.includes('pass') && o.h1.s === 'take' && o.h1.taker && o.h1.paid === 8 && o.h1.a === 72 && o.h1.b === 10 && o.h1.same, '徵人：接下的人真的拿到酬勞，錢從貼的人身上出，總數不變', o.h1);
  ok(o.h1.y === '這幾天手頭真的很緊' && o.h1.pub === '這活我來，明天一早就到', '回應的人心裡想的和嘴上說的分開記在卡片上', o.h1);
  ok(o.hLate === 'late', '已經有人接了：第二個人來晚了一步', o.hLate);
  ok(o.s1.re.join() === 'pass,haggle' && !o.s1.taker && o.s1.cash === 1, '賣東西：錢不夠買不成，沒有被扣錢；另一個人嫌貴', o.s1);
  ok(o.l1.opts.includes('kept') && o.l1.s === 'kept' && o.l1.kept === 1 && o.l1.secret === 1, '尋物：不老實的人撿到不還，記成只有觀察者知道的秘密', o.l1);
  ok(o.g0.tOpts.join() === 'sorry,fire,pass' && o.g0.rOpts.join() === 'agree,defend,pass', '抱怨：被講的人和旁人拿到的選項不一樣', o.g0);
  ok(o.g1.re.join() === 'fire,agree,defend' && o.g1.gf < 0 && o.g1.fh > 0 && o.g1.af < 0 && o.g1.about, '抱怨：附和的人對他印象變差、替他說話的人得到他的好感、回嗆讓兩人更僵', o.g1);
  ok(o.v0.opts.includes('show') && o.v0.priv === true && o.v0.noRecipient, '信：只有收信人會看到，卡片標成只有觀察者看得到；收信人不存在就寫不成', o.v0);
  ok(o.v1.s === 'show' && o.v1.leak === 1 && o.v1.gossip === 1 && o.v1.about, '情書被拿給別人看：變成一則關於寫信人的八卦', o.v1);
  ok(o.e0.post && o.e0.kind === 'event' && o.e0.bid && o.e0.readers >= 1 && o.e0.notAsked, '個人企劃的熱鬧事會貼上公告欄，看到的是沒被找過的人', o.e0);
  ok(o.e1 && o.e1.walk && o.e1.view, '看到告示說要去的人，進到企劃的名單裡（標成看到告示來的）', o.e1);
  ok(o.e2.secretNotPosted, '瞞著人的企劃不會貼出來', o.e2);
  ok(o.r0.rng === 0 && /^R\d{3}$/.test(o.r0.rid) && o.r0.hops === 2 && o.r0.changed && o.r0.first, '流言：每傳一手記一筆，話變了才記新的說法；記錄本身不擲骰', o.r0);
  ok(o.r1.st === 'reached' && o.r1.asked === 'asked' && o.r1.held && o.r1.queued, '流言傳到本人耳裡：先不照寫死的對質，交給他自己決定', o.r1);
  ok(o.r2opts.includes('confront') && o.r2opts.includes('clear') && o.r2opts.includes('back') && o.r2opts.includes('swallow') && o.r2opts.includes('laugh'), '本人的選項：對質、澄清、反過來傳、忍下來、一笑置之', o.r2opts);
  ok(o.r2.st === 'answered' && o.r2.s === 'clear' && o.r2.post === 'clear' && o.r2.text === '我沒有拿過店裡一毛錢，誰說的站出來' && o.r2.pub && o.r2.readers.length >= 1 && o.r2.again === 'answered', '選澄清：公告欄多一張澄清，內文是他自己說出口的話，貼給聽過的人看；不會問第二次', o.r2);
  ok(o.r3.s === 'confront' && o.r3.drop <= -8, '選對質：兩人的交情真的掉', o.r3);
  ok(o.r4.took === false && o.r4.noCard, '好話不攔，照原本的路走', o.r4);
  ok(o.r5.same && o.r5.hops === 1, '真的經過八卦網路傳一手：原本的回傳值不變，多記一筆', o.r5);
  ok(o.noticeKinds.board >= 6 && o.noticeKinds.rumor >= 2, '新告示、新的信、流言傳到本人耳裡，各有一張角落通知', o.noticeKinds);
  ok(o.h2.stage === 'done' && o.h2.ok === true && /8/.test(o.h2.text), '隔天徵人有結果：誰接下、拿了多少', o.h2);
  ok(o.s2.stage === 'done' && o.s2.ok === false && o.l2.stage === 'done' && o.l2.ok === false && o.l2.kept === true, '沒賣掉、沒找到都記成沒成；卡片上看得到其實有人撿走', { s: o.s2, l: o.l2 });
  ok(o.g2.stage === 'done' && /1/.test(o.g2.text) && o.v2.stage === 'done' && o.v2.text, '抱怨與被外流的信隔天都有一句結果', { g: o.g2, v: o.v2 });
  ok(o.i1.stage === 'set' && o.i1.today && o.i1.going >= 2 && o.i1.go[0] && o.m1.stage === 'set' && o.m1.go.every(Boolean), '邀約與約見面說定了：當天真的要走過去', { i: o.i1, m: o.m1 });
  ok(o.m2.at.every(x => x === 'town_square'), '約見面的兩個人時間到了真的在廣場', o.m2);
  ok(o.i2.stage === 'done' && o.i2.came >= 2 && o.i2.text && o.m3.stage === 'done' && o.m3.hasOut, '到場的人數、見面談得怎樣都有結果', { i: o.i2, m: o.m3 });
  ok(o.e3 && o.e3.stage === 'done' && o.c1 && o.c1.stage === 'done', '活動告示與澄清告示最後都收尾', { e: o.e3, c: o.c1 });
  ok(o.notes.notice && o.notes.letter && o.notes.kind, '鎮民手記收得到他貼的告示和寫的信', o.notes);
  ok(o.save.has && o.save.n === o.viewN.all && o.save.r >= 3 && o.save.kb < 60, '存檔帶著公告欄與流言，體積小', o.save);
  const re = await page.evaluate(() => { const app = window.rimtownApp; const w = app.world; const n0 = w.board.list.length, r0 = w.board.rumors.length; const okL = w.loadSave(window.__sv); const a = { ok: !!okL, n: w.board?.list.length === n0, r: w.board?.rumors.length === r0, view: BOARD.view(w, 5).length }; w.observerMode = true; return a; });
  ok(re.ok && re.n && re.r && re.view === 5, '讀檔後公告欄與流言都還在', re);
  // 介面：桌機
  const d = await page.evaluate(ui, { only: 'all' }); await page.screenshot({ path: path.join(SHOTS, 'desk_zh_all.png') });
  ok(d.tabs.filter(k => k !== 'market').join() === 'props,mail,voices,town,truth' && d.tabFit, '提案頁原本的五個子分頁都在（提案、往來、心聲、鎮況、真相），企劃併進往來；鎮上有私人開的店時 11.0.0 會多一個「市場」', d.tabs);
  ok(d.chips.join() === 'all,plans,notes,letters,rumors' && d.cards >= 8 && d.plan >= 1 && d.note >= 4 && d.letter >= 2 && d.rumor >= 2, '往來：一頁看到企劃、公告、信、流言四種卡片', d);
  ok(d.hasWhy && d.hasPub && d.hops >= 3 && d.whoBtn >= 6 && d.over === 0, '卡片上有心裡的盤算、嘴上說的話、流言一手一手的紀錄，人名可以點', d);
  for (const k of ['plans', 'notes', 'letters', 'rumors']) { const x = await page.evaluate(ui, { only: k }); const only = { plans: x.plan === x.cards, notes: x.note === x.cards, letters: x.letter === x.cards, rumors: x.rumor === x.cards }[k]; ok(x.cards >= 1 && only, `篩選鈕「${k}」只留那一種`, { cards: x.cards, plan: x.plan, note: x.note, letter: x.letter, rumor: x.rumor }); }
  const old = await page.evaluate(() => { const app = window.rimtownApp; app._bdOnly = null; app._ppTab = 'plans'; app.renderSidebar(); const root = document.getElementById('sidebar-content'); return { tab: app._ppTab, only: app._bdOnly, on: document.querySelector('.pp-tab.on')?.dataset.ppTab, cards: root.querySelectorAll('.sk-card').length, plan: root.querySelectorAll('.sk-card:not(.bd-card)').length }; }); ok(old.tab === 'mail' && old.only === 'plans' && old.on === 'mail' && old.cards >= 1 && old.cards === old.plan, '以前記住的「企劃」分頁自動帶到往來裡的企劃', old);
  const clicked = await page.evaluate(async () => { const app = window.rimtownApp; app._bdOnly = 'all'; app.renderSidebar(); document.querySelector('[data-bd-only="rumors"]').click(); const a = app._bdOnly; const b = document.querySelector('.bd-card .pv-who:not([disabled])'); const id = b?.dataset.pvGo; b?.click(); return { a, sel: app.selectedAgentId === id }; }); ok(clicked.a === 'rumors' && clicked.sel, '篩選鈕與卡片上的人名按了有反應', clicked);
  // 回應的人有自己的 AI 名額：全鎮每天的名額用完了，看到告示的人還是有 4 個由 AI 說話（一次問完）
  const own = await page.evaluate(async () => { const app = window.rimtownApp; const w = app.world; const ce = w.conversationEngine; const X = DECIDE.S(w); BOARD.S(w).quiet = true; w.decide.q = [];
    const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && a.currentLocation !== 'exploration' && !w.isAway?.(a.agentId)); const by = A[0], rs = A.slice(1, 6);
    const _aj = ce._askJson, _ok = ce.fullAgentOk, _fm = w.fullAgentMode; let calls = 0, people = 0; ce.fullAgentOk = () => true; w.fullAgentMode = true;
    ce._askJson = async (prompt) => { calls++; const n = (String(prompt).match(/=== \d+\. /g) || []).length; people += n; return Array.from({ length: n }, (_, i) => ({ n: i + 1, pick: 'agree', why: '他說的我也遇過', feel: '義氣', say: '這事我挺你' })); };
    X._asked = DECIDE.AI_MAX; X._kAsked = {}; const asked0 = X._asked; // 假裝今天全鎮的名額已經用完
    const B = BOARD.create(w, by, { kind: 'gripe', text: '最近東西越來越貴，日子怎麼過', readers: rs, ai: true }); DECIDE.drain(w, X, w._absDay()); await DECIDE.flush();
    ce._askJson = _aj; ce.fullAgentOk = _ok; w.fullAgentMode = _fm;
    return { calls, people, voiced: B.re.filter(q => q.y && q.pub).length, answered: B.re.filter(q => q.s !== 'asked').length, n: B.re.length, asked: X._asked - asked0 }; });
  ok(own.calls === 1 && own.people === 4 && own.voiced === 4 && own.answered === 5 && own.asked === 0, '看到告示的人有自己的 AI 名額：一次問 4 個人，第 5 個照個性；不佔全鎮每天的名額', own);
  ok(errs.length === 0, '桌機沒有程式錯誤', errs.slice(0, 3)); await page.close();
  // 手機 390px，中英
  for (const lang of ['zh', 'en']) {
    const m = await open(browser, lang, { width: 390, height: 844 }); await m.page.evaluate(stage); const u = await m.page.evaluate(ui, { only: 'all' }); await m.page.screenshot({ path: path.join(SHOTS, `m_${lang}_all.png`) });
    ok(u.tabs.length >= 5 && u.tabs.length <= 6 && u.tabFit && !u.pageOver && u.over === 0 && u.wide <= 390, `手機 ${lang}：子分頁（五個，有店家時六個）放得下，卡片不超出畫面`, u);
    ok(u.tabH >= 40 && u.chipH >= 40, `手機 ${lang}：分頁與篩選鈕夠大好按`, { tabH: u.tabH, chipH: u.chipH });
    if (lang === 'en') ok(u.labelsCjk.length === 0, '英文模式：標籤、狀態、說明沒有漏翻', u.labelsCjk);
    const r = await m.page.evaluate(ui, { only: 'rumors' }); await m.page.screenshot({ path: path.join(SHOTS, `m_${lang}_rumors.png`) }); ok(r.rumor >= 2 && r.over === 0, `手機 ${lang}：流言卡片放得下`, { rumor: r.rumor, over: r.over });
    ok(m.errs.length === 0, `手機 ${lang} 沒有程式錯誤`, m.errs.slice(0, 3)); await m.page.close();
  }
  await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
