// v6.60.0 宗教:依鎮名生成 1–3 個宗教(六種骨架、隨機名稱、中英)、村民信仰與虔誠度、什一與濟貧、節日、祈禱與應驗、事件卡依信仰解讀、喪親、傳教改宗與家庭失和、神職貪污、AI 知道信仰、鎮況頁與角色卡、存讀檔
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
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
      const app = window.rimtownApp, w = app.world, CE = w.conversationEngine; app._setPaused?.(true); WALLET.S(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const logHas = (re) => (w.messageLog || []).slice(-30).some(m => re.test(m.content || ''));
      const memHas = (a, re) => (a.memory.entries || []).slice(-8).some(m => re.test(m.text ? m.text() : m.content));
      const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
      const out = {}; const F = FAITH.S(w);
      out.n = F.rels.length; out.sks = F.rels.map(R => R.sk); out.names = F.rels.map(R => R.name[0]);
      out.allAssigned = npcs().every(a => F.of[a.agentId]); out.nb = FAITH.nonBelievers(w);
      // 同一個鎮名 → 同樣的宗教(種子固定)
      const saved = w.faith; w.faith = null; const again = FAITH.S(w).rels.map(R => R.name[0]); w.faith = saved; out.same = JSON.stringify(again) === JSON.stringify(out.names);
      // 各骨架都產得出名字
      out.allSk = FAITH.KEYS.every(k => { const R = FAITH.makeReligion(FAITH.rng(7), k, 0); return R.name[0].length >= 2 && R.name[1].length >= 3 && R.deity[0] && R.book[0] && R.fest[0]; });
      out.view = FAITH.view(w).map(v => v.name + '|' + v.deity + '|' + v.place).join(' ; ');
      // 讓第一個宗教當主角
      const R = F.rels[0]; const bs = FAITH.believers(w, R); const a = bs[0] || npcs()[0]; F.of[a.agentId] = { rel: R.id, piety: 60 };
      // 祈禱 → 好事卡 → 應驗
      a.mood = 20; F.lastDay = null; F.prayers = {}; fix(0.01, () => FAITH.daily(w)); if (!F.prayers[a.agentId]) FAITH.prayBy?.(w, a); /* v9.27.0 祈不祈禱由本人決定(不再擲骰)：這裡讓他決定祈禱 */ out.prayed = !!F.prayers[a.agentId] && logHas(/🙏/);
      const p0 = FAITH.pietyOf(w, a); FAITH.onCard(w, { cat: 'fortune' }); out.answered = FAITH.pietyOf(w, a) >= p0 + 15 && memHas(a, /應驗|answered/);
      // 災禍卡 → 依信仰解讀
      fix(0.01, () => FAITH.onCard(w, { cat: 'disaster' })); const line = FAITH.SK[R.sk].bad; out.interp = memHas(a, new RegExp((line[0] + '|' + line[1]).replace(/[.?*+()]/g, '\\$&').slice(0, 200)));
      // 實際打出事件卡也走這條
      const cid = (w.eventCards.all?.() || []).map(c => c.id || c).find(id => w.eventCards.canPlay?.(w, id)?.ok); if (cid) { const before = JSON.stringify(F.of); fix(0.01, () => w.eventCards.play(w, cid)); out.realCard = before !== JSON.stringify(F.of); } else out.realCard = 'none';
      // 傳教改宗 + 家庭失和
      const o = npcs().find(x => x !== a && F.of[x.agentId]?.rel !== R.id) || npcs().find(x => x !== a); F.of[o.agentId] = { rel: F.rels[1]?.id || null, piety: 10 };
      const fam = npcs().find(x => x !== a && x !== o); if (F.rels[1]) F.of[fam.agentId] = { rel: F.rels[1].id, piety: 80 }; o._parentNames = [fam.name];
      for (const x of Object.values(a.relationships.relationships)) if (x.targetId !== o.agentId && x.affinity >= 30) x.affinity = 29; // 傳教挑朋友清單的第一位:讓 o 是唯一夠熟的朋友(以前隨機小鎮裡 a 若已有別的熟朋友就會勸別人)
      a.relationships.getOrCreate(o.agentId, o.name).affinity = 50; F.of[a.agentId].piety = 95; const affFam0 = fam.relationships.getOrCreate(o.agentId, o.name).affinity;
      F.lastDay = null; fix(0.01, () => FAITH.daily(w)); if (F.of[o.agentId].rel !== R.id && FAITH.byCrowd?.(w)) FAITH.convertBy(w, o, { by: a.agentId, rel: R.id }, true); /* v9.27.0 去不去勸、改不改信由本人決定(不再擲骰)：這裡讓被勸的人決定改信 */ out.converted = F.of[o.agentId].rel === R.id && logHas(/改信|converted/);
      out.discord = !F.rels[1] || fam.relationships.getOrCreate(o.agentId, o.name).affinity < affFam0;
      // 喪親
      const mourner = npcs().find(x => x !== a && x !== o && x !== fam && F.of[x.agentId]?.rel); F.of[mourner.agentId].piety = 20; const lost = npcs().find(x => x !== mourner && x !== a);
      mourner.relationships.getOrCreate(lost.agentId, lost.name).affinity = 60; w.lifecycle.graveyard = w.lifecycle.graveyard || []; F.lastGrave = w.lifecycle.graveyard.length; w.lifecycle.graveyard.push({ name: lost.name, age: 50 });
      F.lastDay = null; fix(0.9, () => FAITH.daily(w)); out.grief = !F.of[mourner.agentId].rel && logHas(/失去了信仰|lost their faith/); w.lifecycle.graveyard.pop(); F.lastGrave = w.lifecycle.graveyard.length;
      // 什一與濟貧(聖堂型)、貪污
      const sheng = F.rels.find(x => x.sk === 'sheng') || F.rels[0]; sheng.sk = 'sheng'; const tither = npcs().find(x => x !== a && x !== o); F.of[tither.agentId] = { rel: sheng.id, piety: 50 }; w.wallet.bal[tither.agentId] = 200;
      const poor = npcs().find(x => x !== tither && x !== a); w.wallet.bal[poor.agentId] = 0; sheng.fund = 0;
      const _ad = w._absDay; w._absDay = () => 7; F.lastDay = null; fix(0.9, () => FAITH.daily(w)); w._absDay = _ad;
      out.tithe = WALLET.get(w, tither) < 200; out.charity = WALLET.get(w, poor) > 0 || sheng.fund > 0;
      const priest = npcs().find(x => x !== a); priest.job.key = 'priest'; priest.personality.traits = priest.personality.traits.filter(x => x !== 'ascetic'); F.of[priest.agentId] = { rel: sheng.id, piety: 80 }; sheng.fund = 100;
      F.lastDay = null; const ns = (w.dark?.secrets || []).length; fix(0.01, () => FAITH.daily(w));
      { const keeper = FAITH.believers(w, sheng).find(x => x.job?.key === 'priest'); if (keeper) { keeper.personality.traits = keeper.personality.traits.filter(x => x !== 'ascetic'); sheng.fund = 100; FAITH.embezzleBy(w, keeper); } } // v9.26.0 拿不拿奉獻箱的錢由管錢的神職自己決定(不再擲骰)，這裡讓他決定拿
      out.corrupt = (w.dark?.secrets || []).length > ns && sheng.fund < 100;
      // 節日
      const fr = F.rels[0]; const seasons = ['春季', '夏季', '秋季', '冬季']; const cs = w.clock.season, cd = w.clock.day; w.clock.season = seasons[fr.festSeason]; w.clock.day = fr.festDay; fr._festDay = null; F.lastDay = null;
      fix(0.9, () => FAITH.daily(w)); w.clock.season = cs; w.clock.day = cd; out.fest = logHas(/齊聚|gathered/);
      // AI 與畫面
      out.brief = JSON.stringify(CE._agentBrief(w, a, null)); out.town = CE._townBrief(w);
      app.state = w.getState(); app._showNpcCard(a.agentId); out.card = document.getElementById('npc-quick-card')?.innerText || ''; app._hideNpcCard();
      const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-faith')?.innerText || ''; box.remove();
      // 旅人識破:越虔誠越容易
      F.of[a.agentId].piety = 100; const hi = TRAVELER.piety(a); F.of[a.agentId].piety = 0; const lo = TRAVELER.piety(a); out.travel = hi > lo;
      // 存讀檔與新城鎮
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.faith?.rels?.length === F.rels.length && !!w2.faith.of[a.agentId]; w2.reset(); out.reset = !w2.faith;
      return out;
    });
    ok(r.n >= 1 && r.n <= 3 && r.allAssigned, '每鎮 1～3 個宗教，每個村民都有信仰狀態', r);
    ok(r.nb >= 0 && r.same, '同一座城鎮的宗教固定（依鎮名）', r);
    ok(r.allSk, '六種骨架都能產生名稱、主神、經典、節日', r);
    ok(lang === 'zh' ? /[一-鿿]/.test(r.view) : !/[一-鿿]/.test(r.view), '宗教名稱與場所依語言顯示', r.view);
    ok(r.prayed && r.answered, '日子難過時向神祈禱；打出好事卡 → 相信祈禱應驗', r);
    ok(r.interp, '災禍卡依信仰解讀（天譴、祖靈不悅、共業…）', r);
    ok(r.realCard === true || r.realCard === 'none', '實際打出事件卡也會影響信仰', r);
    ok(r.converted && r.discord, '虔誠的人傳教改宗；家人改宗會失和', r);
    ok(r.grief, '喪親可能讓人失去信仰', r);
    ok(r.tithe && r.charity, '聖堂型收什一、拿奉獻濟貧', r);
    ok(r.corrupt, '神職可能私吞奉獻（真相頁看得到）', r);
    ok(r.fest, '宗教節日信徒齊聚', r);
    ok(/信仰|Faith/.test(r.brief) && /宗教|Religion/.test(r.town), 'AI 知道自己的信仰與鎮上的宗教', { b: r.brief.slice(0, 160), t: r.town.slice(-120) });
    ok(/🛕|☯️|🪷|🪶|✝️|🏮|📜/.test(r.card) && r.ui.length > 20, '角色卡有信仰標籤；鎮況頁有宗教一覽', { card: r.card.slice(0, 160), ui: r.ui.slice(0, 200) });
    ok(r.travel, '越虔誠越容易察覺旅人不是凡人', r);
    ok(r.rt && r.reset, '宗教存讀檔保留、新城鎮重新生成', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
