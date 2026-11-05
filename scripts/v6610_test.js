// v6.61.0 宗教第二部:宗教領袖(稱號依等級、官職標籤、城市以上算貴族)、加冕由宗教領袖主持(加正當性／拒絕)、分裂自立教派與異端審判、科技與信仰衝突、AI 知道神職、存讀檔
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w); CLASS.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-30).some(m => re.test(m.content || ''));
      const memHas = (a, re) => (a.memory.entries || []).slice(-8).some(m => re.test(m.text ? m.text() : m.content));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const out = {}; const F = FAITH.S(w); const R = F.rels[0];
      // 讓 8 個人信第一個宗教,其中一位是祭司
      const all = npcs().filter(a => a.job?.key !== 'mayor'); const mem8 = all.slice(0, 8); for (const a of mem8) F.of[a.agentId] = { rel: R.id, piety: 60 };
      const pr = mem8[0]; for (const a of npcs()) if (a.job?.key === 'priest' && a !== pr) a.job.key = 'farmer'; pr.job.key = 'priest'; F.of[pr.agentId].piety = 100; F.heads = {};
      FAITH2.pickHeads(w); out.head = FAITH2.headOf(w, R) === pr && logHas(/⛪/);
      const b0 = TIERS.badge(w, pr); out.badge = b0?.cls === 'clergy'; out.lv0 = CLASS.compute(w, pr);
      w.tierState.lv = 2; out.lv2 = CLASS.compute(w, pr); out.title2 = FAITH2.headTitle(w, pr)?.zh;
      out.brief = FAITH.brief(w, pr); out.viewHead = !!FAITH.view(w).find(v => v.id === R.id)?.head;
      // 加冕
      w.tierState.lv = 3; w.crown = null; w.council._formCouncil(w); for (const id of w.council.members) { const m = w.agents[id]; for (const o of npcs()) m.relationships.getOrCreate(o.agentId, o.name).affinity = 10; }
      for (const o of npcs()) pr.relationships.getOrCreate(o.agentId, o.name).affinity = 10;
      // 確保信徒最多的是 R
      for (const a of npcs()) if (!F.of[a.agentId]?.rel || F.of[a.agentId].rel !== R.id) { if (Math.random() < 0.5) F.of[a.agentId] = { rel: R.id, piety: 50 }; }
      const big = F.rels.slice().sort((x, y) => FAITH.believers(w, y).length - FAITH.believers(w, x).length)[0]; if (big !== R) { for (const a of npcs()) F.of[a.agentId].rel = R.id; }
      fix(0.5, () => CROWN.daily(w)); const k = CROWN.king(w);
      out.crowned = !!k && (k === pr || (!!w.crown.rite && logHas(/加冕：|crowned .* in the name/)));
      // 拒絕
      const k2 = npcs().find(a => a !== pr && a !== k); pr.relationships.getOrCreate(k2.agentId, k2.name).affinity = -60; const lg = w.crown.legit; const rf = FAITH2.coronation(w, k2, 'first');
      out.refused = rf?.refused === true && w.crown.legit < lg;
      // 分裂與異端(聖堂型)
      R.sk = 'sheng'; const rebel = mem8[1]; rebel.personality.traits = [...rebel.personality.traits.filter(x => x !== 'charismatic'), 'charismatic']; F.of[rebel.agentId].piety = 75;
      for (const b of FAITH.believers(w, R)) b.relationships.getOrCreate(pr.agentId, pr.name).affinity = 10; rebel.relationships.getOrCreate(pr.agentId, pr.name).affinity = -40; for (const f of mem8.slice(2, 5)) { f.relationships.getOrCreate(rebel.agentId, rebel.name).affinity = 50; F.of[f.agentId].piety = 50; }
      const n0 = F.rels.length; const v0 = (w.proposals.items || []).filter(p => p.kind === 'verdict').length;
      fix(0.01, () => FAITH2.schism(w, 5));
      out.schism = F.rels.length === n0 + 1 && F.of[rebel.agentId].rel === F.rels[F.rels.length - 1].id && logHas(/決裂|broke with/);
      out.followers = mem8.slice(2, 5).filter(f => F.of[f.agentId].rel === F.rels[F.rels.length - 1].id).length;
      out.heresy = logHas(/異端|heresy/) && (w.proposals.items || []).filter(p => p.kind === 'verdict').length > v0;
      out.newHead = FAITH2.headOf(w, F.rels[F.rels.length - 1]) === rebel;
      // 科技衝突
      const pious = mem8[5]; F.of[pious.agentId] = { rel: R.id, piety: 90 }; pious.personality.traits = pious.personality.traits.filter(x => x !== 'creative'); if (pious.job?.key === 'researcher') pious.job.key = 'farmer';
      const key = Object.keys(TECH_IDEAS)[0]; const before = w.ideaSystem.openness(w, pious, key); F.of[pious.agentId].piety = 10; const after = w.ideaSystem.openness(w, pious, key); F.of[pious.agentId].piety = 90; out.openness = before < after;
      delete w.ideaSystem.ideas[key]; fix(0.01, () => w.ideaSystem.onResearchComplete(w, key)); out.techMem = memHas(pious, /違背|goes against/); out.techLog = logHas(/公開反對|publicly opposed/);
      // 畫面與存讀檔
      app.state = w.getState(); const cardWho = CROWN.king(w) === rebel ? pr : rebel; app._showNpcCard(cardWho.agentId); out.card = document.getElementById('npc-quick-card')?.innerHTML || ''; app._hideNpcCard();
      const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-faith')?.innerText || ''; box.remove();
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.faith?.heads?.[R.id] === pr.agentId && w2.faith.rels.length === F.rels.length;
      return out;
    });
    ok(r.head, '宗教領袖：優先由祭司擔任，有公告', r);
    ok(r.badge && r.lv0 >= 3 && r.lv2 === 4 && r.title2, '領袖有神職標籤；算士紳，城市以上算貴族，稱號升級', r);
    ok(/你是|you are/.test(r.brief) && r.viewHead, 'AI 知道自己是宗教領袖；鎮況頁列出領袖', r);
    ok(r.crowned, '國王由信徒最多的宗教領袖主持加冕、加正當性', r);
    ok(r.refused, '宗教領袖跟新王不合會拒絕主持，民心下降', r);
    ok(r.schism && r.followers >= 1 && r.newHead, '有魅力的信徒跟領袖不合，自立新教派、帶走朋友', r);
    ok(r.heresy, '聖堂型領袖指控分裂者是異端，交付審判', r);
    ok(r.openness && r.techMem && r.techLog, '越虔誠越難接受新觀念；新研究完成時虔誠信徒反對、領袖公開表態', r);
    ok(/nqc-office-clergy/.test(r.card) && /⚡|創立者|Founder/.test(r.ui), '角色卡有神職標籤；鎮況頁顯示新教派', { ui: r.ui.slice(0, 300) });
    ok(r.rt, '神職與新教派存讀檔保留', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
