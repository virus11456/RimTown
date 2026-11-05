// v6.72.0 你與 AI:發現祕密後公開／掩護／勒索(規則／AI)、原諒的理由、AI 禱詞、託夢(解讀、誤解、行動、冷卻、寫進教義)、預言押注(選舉／政變、準確率)、畫面、存讀檔
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) {
    console.log(lang);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine, E = w.election; app._setPaused?.(true); WALLET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const _r = Math.random; const fix = async (v, f) => { Math.random = () => v; try { return await f(); } finally { Math.random = _r; } };
      const stubAI = (resp) => { const s = { fa: w.fullAgentMode, ok: CE.fullAgentOk, aj: CE._askJson }; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => resp; return () => { w.fullAgentMode = s.fa; CE.fullAgentOk = s.ok; CE._askJson = s.aj; }; };
      let D = 1700; const _ad = w._absDay; w._absDay = () => D; const out = {}; const Sd = DREAM.S(w); const all = npcs().filter(a => a.job?.key !== 'mayor'); DARK.S(w);
      const mkSec = (c, f) => { const s = DARK.secret(w, { kind: 'scheme', culprit: c.agentId, victim: all[9].agentId, k: '{a}私下塞錢給{m}拉票爭王位', p: { a: c.name, m: all[9].name } }); s.found = true; s.foundBy = f.agentId; s.foundDay = D; return s; };
      // 掩護(朋友)
      const [c1, f1] = all; f1.relationships.getOrCreate(c1.agentId, c1.name).affinity = 60; w.dark.rep[c1.agentId] = { exposed: 1 }; mkSec(c1, f1);
      await fix(0.01, () => DREAM.secrets(w, Sd, D)); out.cover = (w.dark.rep[c1.agentId].exposed || 0) === 0 && logHas(/掩護|covered/);
      // 勒索(不老實、對方有錢)
      const [c2, f2] = all.slice(2, 4); f2.relationships.getOrCreate(c2.agentId, c2.name).affinity = 0; w.wallet.bal[c2.agentId] = 100; w.wallet.bal[f2.agentId] = 0; const _h = DARK.honesty; DARK.honesty = (a) => a === f2 ? 1 : 3; mkSec(c2, f2);
      await fix(0.01, () => DREAM.secrets(w, Sd, D)); DARK.honesty = _h; out.blackmail = WALLET.get(w, f2) > 0 && logHas(/勒索|blackmail/);
      // 公開(正直的人)
      const [c3, f3] = all.slice(4, 6); f3.relationships.getOrCreate(c3.agentId, c3.name).affinity = 0; mkSec(c3, f3); DARK.honesty = (a) => a === f3 ? 4 : 3;
      await fix(0.9, () => DREAM.secrets(w, Sd, D)); DARK.honesty = _h; out.expose = logHas(/公開|go public/);
      // AI 決定
      const [c4, f4] = all.slice(6, 8); mkSec(c4, f4); let restore = stubAI({ act: 'cover', why: '他上次幫過我' }); await DREAM.secrets(w, Sd, D); restore(); out.aiChoice = logHas(/他上次幫過我/);
      // 原諒的理由
      const [x1, x2] = all.slice(0, 2); w.dark.wrongs.push({ by: x1.agentId, to: x2.agentId, w: 1, day: D - 3, tries: 1, last: D, forgiven: true, done: true });
      await DREAM.forgiveness(w, D); out.why = logHas(/💬/);
      w.dark.wrongs.push({ by: x2.agentId, to: x1.agentId, w: 1, day: D - 3, tries: 1, last: D, forgiven: false }); restore = stubAI(['他根本沒有悔意。']); await DREAM.forgiveness(w, D); restore(); out.aiWhy = logHas(/悔意/);
      // 禱詞
      const F = FAITH.S(w); const R = F.rels[0]; F.of[x1.agentId] = { rel: R.id, piety: 70 }; F.prayers = { [x1.agentId]: { day: D, wish: '讓日子好過一點', rel: R.id } };
      restore = stubAI(['求您保佑我的孩子平安長大。']); await DREAM.prayers(w, D); restore(); out.prayer = F.prayers[x1.agentId].text === '求您保佑我的孩子平安長大。' && logHas(/禱詞|prayer/);
      // 託夢:和好
      const dr = all[8]; const foe = all[9]; dr.relationships.getOrCreate(foe.agentId, foe.name).affinity = -40; dr.personality.traits = dr.personality.traits.filter(x => !['neurotic', 'pessimist'].includes(x));
      Sd.lastDream = -99; const s1 = await DREAM.send(w, dr.agentId, '去跟你的仇人和好吧'); out.dream = s1.ok && s1.dream.kind === 'reconcile' && dr.relationships.relationships[foe.agentId].affinity > -40 && logHas(/夢|dream/);
      out.dreamMem = (dr.memory.entries || []).slice(-6).some(m => /夢見|dreamed/.test(m.text ? m.text() : m.content));
      const s2 = await DREAM.send(w, dr.agentId, '再一次'); out.cooldown = !s2.ok && s2.why === 'cooldown';
      // 誤解
      const nv = all[10] || all[1]; nv.personality.traits = [...nv.personality.traits.filter(x => x !== 'neurotic'), 'neurotic']; D++; const s3 = await fix(0.01, () => DREAM.send(w, nv.agentId, '小心河邊')); out.wrong = s3.ok && s3.dream.wrong === true;
      // AI 解讀 + 宗教領袖寫進教誨
      const head = all[3]; F.of[head.agentId] = { rel: R.id, piety: 100 }; head.job.key = 'priest'; F.heads = { [R.id]: head.agentId }; D++;
      restore = stubAI({ meaning: '神要我們在河邊蓋一座橋', kind: 'build' }); const s4 = await DREAM.send(w, head.agentId, '水的兩邊應該相連'); restore();
      out.aiDream = s4.ok && s4.dream.meaning === '神要我們在河邊蓋一座橋' && s4.dream.doctrine === true && (R.pre[0][0] === '水的兩邊應該相連');
      // 預言押注:選舉
      const [A, B] = all.slice(0, 2); E.active = true; E.phase = 'campaign'; E.candidates = [{ agentId: A.agentId, name: A.name, votes: 0 }, { agentId: B.agentId, name: B.name, votes: 0 }]; E.lastElectionDay = D;
      app.state = w.getState(); let box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.betBtns = box.querySelectorAll('[data-action="dream-bet"]').length; box.remove();
      out.bet = DREAM.bet(w, 'election', A.agentId) && !DREAM.bet(w, 'election', B.agentId);
      DREAM.settle(w, 'election', A.agentId); const acc1 = DREAM.accuracy(w); out.hit = acc1.hits === 1 && logHas(/應驗|came true/);
      // 政變押注
      w.crown = { plot: { leader: A.agentId, members: [A.agentId], start: D, ready: D + 5 }, king: null, legit: 30, history: [], decrees: [] };
      DREAM.bet(w, 'coup', 'success'); w.crown.plot = null; Sd.lastDay = null; D++; await DREAM.daily(w); const acc2 = DREAM.accuracy(w); out.miss = acc2.misses === 1 && acc2.pct === 50;
      E.active = false; E.phase = 'none'; E.candidates = []; w._absDay = _ad;
      app.state = w.getState(); app._showNpcCard(dr.agentId); out.card = document.getElementById('npc-quick-card')?.innerHTML || ''; app._hideNpcCard();
      box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-dream')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.dream?.dreams?.length === Sd.dreams.length && w2.dream.hits === 1; w2.reset(); out.reset = !w2.dream;
      return out;
    });
    ok(r.cover, '發現朋友的祕密會幫忙掩護', r);
    ok(r.blackmail, '不老實的人會私下勒索', r);
    ok(r.expose, '正直的人會公開', r);
    ok(r.aiChoice, '完整智能體模式由 AI 決定爆不爆料並說理由', r);
    ok(r.why && r.aiWhy, '原諒或不原諒都說得出理由（規則／AI）', r);
    ok(r.prayer, 'AI 寫出村民的禱詞', r);
    ok(r.dream && r.dreamMem, '託夢：他記得夢、依解讀行動（主動和好）', r);
    ok(r.cooldown, '一天只能託一次夢', r);
    ok(r.wrong, '神經質的人可能誤解夢', r);
    ok(r.aiDream, 'AI 解讀夢；宗教領袖把夢寫進教誨', r);
    ok(r.betBtns >= 2 && r.bet && r.hit, '選舉前可以押注，開票後記下命中', r);
    ok(r.miss, '政變押注落空也會記錄，算出準確率', r);
    ok(/data-nqc="dream"/.test(r.card), '角色卡有託夢按鈕', r.card.slice(0, 100));
    ok(/🔮/.test(r.ui) && /50%/.test(r.ui), '鎮況頁有託夢與預言、準確率', r.ui);
    ok(r.rt && r.reset, '託夢與預言存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
