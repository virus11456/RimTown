// v9.0.0 世界新事物（通用）：鎮上出現新東西，村民自己形成好惡並跟它互動——看法（規則版、AI 版）、去用、推薦、抱怨、勸家人、到門口抗議、提案禁止、報社專題、受害者與拉一把、自動發現新建築、新鮮感過期；賭場蓋到地圖上、晚上真的有人走進去；守恆、存讀檔、AI 知道自己的看法、介面
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, lang, vp) {
  console.log(`— ${lang} ${vp.width}px`); const mobile = vp.width <= 768;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    const tick = (n) => { for (let k = 0; k < n; k++) { w.paused = false; w.tick(); } };
    tick(96 * 21);
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && !w.isAway?.(a.agentId));
    const B = w.wallet.bal; const T = () => MONEY.total(w); const P0 = () => MONEY.S(w).pend;
    const logs = () => (w.messageLog || []).slice(-60).map(m => String(m.content || '')).join('\n');
    const fix = (v, f) => { const R = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = R; } };
    const fixA = async (v, f) => { const R = Math.random; Math.random = () => v; try { return await f(); } finally { Math.random = R; } };
    const conserved = (f) => { const t0 = T(), p0 = P0(); f(); return Math.abs((T() - t0) - (P0() - p0)) < 0.02; };
    const daily = async (v) => { const X = THINGS.S(w); X.lastDay = -1; return v == null ? THINGS.daily(w) : fixA(v, () => THINGS.daily(w)); };
    const _lv = TIERS.level; TIERS.level = () => 1;
    try {
      INFL.S(w).p = 1; INFL.S(w).wage = 1; INFL.sync(w);
      const all = npcs(); const boss = all[0]; boss.personality.traits = ['greedy', 'ambitious']; for (const a of all) B[a.agentId] = 40; B[boss.agentId] = 800;
      fix(0.001, () => { w.casino && (w.casino.lastDay = -1); CASINO.daily(w); }); const C = w.casino; const X = THINGS.S(w); const id = C.thing; const Th = X.list[id];
      out.reg = { open: C.open, id: !!id, kind: Th?.kind, owner: X.att[id]?.[boss.agentId], place: Th?.place, dealer: !!C.dealer };
      // ---------- 地圖：蓋一棟、門口留空地、地點名稱 ----------
      THINGS.syncMap(w, app.tileMap); const tm = app.tileMap;
      out.map = { zone: !!tm.buildingZones.casino, door: tm.buildingZones.casino?.doorPixelX > 0, front: !!tm.natureZones?.casino_front, loc: !!w.townMap.locations.casino, label: tm.labelPositions?.casino?.name || '', site: !!Th.site, rebuild: tm._sceneSrc === null };
      // ---------- 規則版看法：個性 × 性質（多抽幾次取平均） ----------
      const avg = (a) => { let s = 0; for (let k = 0; k < 20; k++) s += THINGS.ruleAtt(w, Th, a).v; return s / 20; };
      const g = all[1], p = all[2]; const sv = [g.personality, p.personality];
      g.personality = { ...g.personality, traits: ['greedy', 'optimist'], values: ['冒險', '財富'] }; p.personality = { ...p.personality, traits: ['kind', 'ascetic'], values: ['家庭', '和平'] };
      out.rule = { lover: Math.round(avg(g)), hater: Math.round(avg(p)), owner: THINGS.ruleAtt(w, Th, boss).v };
      g.personality = sv[0]; p.personality = sv[1];
      // ---------- AI 版看法：完整智能體模式交給 AI（模擬回覆），拿得到這東西的事實 ----------
      { const ce = w.conversationEngine; const sOk = ce.fullAgentOk, sAsk = ce._askJson; let prompt = ''; const NB = typeof CROWD !== 'undefined' ? CROWD.notable : null;
        w.fullAgentMode = true; ce.fullAgentOk = () => true; const nmz = Array.isArray(Th.name) ? Th.name : [Th.name, Th.name]; ce._askJson = async (pr) => { { const head = pr.split('\n')[0]; /* v9.19.0 只認開頭那一行:村民的帳本裡也可能提到這東西(他對它的看法) */ if (/鎮上出現了新東西|Something new has appeared/.test(head) && (head.includes(nmz[0]) || head.includes(nmz[1]))) prompt = pr; } return [{ v: 2, why: 'AI 說我就愛這一味', act: 'recommend' }, { v: -2, why: 'AI 說這會毀了我們家', act: 'complain' }]; };
        if (NB) CROWD.notable = () => new Set(all.map(a => a.agentId));
        for (const a of all) if (a !== boss) delete X.att[id][a.agentId];
        const ai0 = X.st.ai; try { await daily(0.3); /* 0.3：都聽說了，但還不到會出手推薦或抱怨的機率 */ await THINGS.flush(); } finally { ce.fullAgentOk = sOk; ce._askJson = sAsk; w.fullAgentMode = false; if (NB) CROWD.notable = NB; }
        const whys = Object.values(X.why[id]).map(x => { try { return Memory.render(x.k, x.p); } catch (e) { return ''; } });
        out.ai = { n: X.st.ai - ai0, facts: /莊家長期穩賺|house wins/.test(prompt), name: prompt.includes(Array.isArray(Th.name) ? Th.name[0] : '') || prompt.includes(Th.name?.[1] || '###'), love: whys.includes('AI 說我就愛這一味'), hate: whys.includes('AI 說這會毀了我們家'), p: prompt.slice(0, 60), all: all.filter(a => X.att[id][a.agentId] != null).length };
      }
      // ---------- 想不想去：喜歡的人去得多、答應家人戒賭的不去 ----------
      const lover = all[3], hater = all[4]; X.att[id][lover.agentId] = 90; X.att[id][hater.agentId] = -90;
      out.use = { lover: THINGS.useMult(w, id, lover), hater: THINGS.useMult(w, id, hater) };
      // ---------- 晚上真的走進賭場 ----------
      { THINGS.goTonight(w, id, lover, 19, 23); let gk = 0; while (!(w.clock.hour === 20 && w.clock.minute === 0) && gk++ < 200) tick(1); tick(2); out.night = { at: lover._thingAt, target: lover.targetLocation || lover.currentLocation }; }
      // ---------- 到門口抗議：帶頭的人找看法相近的人一起去；老闆回應；人多就提案禁止 ----------
      { const crowd = all.filter(a => a !== boss && a !== lover).slice(3, 11); for (const a of crowd) { X.att[id][a.agentId] = -85; for (const b of crowd) if (a !== b) a.relationships.getOrCreate(b.agentId, b.name).affinity = 40; }
        (X.intent || (X.intent = {}))[id + '|' + crowd[0].agentId] = 'protest'; Th.protest = null; Th.banProp = -99; w.proposals.items = (w.proposals.items || []).filter(q => q.kind !== 'thing_ban');
        await daily(0.05); const pr = (w.proposals.items || []).find(q => q.kind === 'thing_ban');
        out.protest = { n: Th.protest?.n || 0, go: crowd.filter(a => a._thingGo?.place === 'casino_front').length, log: /門口抗議|protest outside/.test(logs()), owner: /捐了|donates|冷冷|coldly/.test(logs()), prop: !!pr && pr.thing === id };
        tick(1); out.protest.at = crowd.filter(a => a._thingAt === 'casino_front').length; out.pr = pr ? pr.id : null; }
      // ---------- 勸家人別再去：成功就答應戒賭 ----------
      { const reg = all[12] || all[5], fam = all[13] || all[6]; C.v[reg.agentId] = 5; reg.relationships.getOrCreate(fam.agentId, fam.name).status = 'married'; fam.relationships.getOrCreate(reg.agentId, reg.name).status = 'married'; reg.relationships.getOrCreate(fam.agentId, fam.name).affinity = 60;
        X.att[id][fam.agentId] = -80; X.att[id][reg.agentId] = 30; X.intent[id + '|' + fam.agentId] = 'persuade'; const p0 = X.st.pers;
        await daily(0.0); out.persuade = { tried: X.st.pers - p0, quit: THINGS.quitting(w, id, reg), mult: THINGS.useMult(w, id, reg), log: /苦勸|pleads with/.test(logs()) }; }
      // ---------- 受害者：家人跟著心寒；交情好的朋友拉一把 ----------
      { const v = all[14] || all[7], sp = all[15] || all[8], fr = all[16] || all[9]; v.relationships.getOrCreate(sp.agentId, sp.name).status = 'married'; X.att[id][sp.agentId] = 0;
        THINGS.victim(w, id, v, '我輸光了。'); out.victim = { v: X.att[id][v.agentId], sp: X.att[id][sp.agentId] };
        fr.relationships.getOrCreate(v.agentId, v.name).affinity = 70; fr.personality.traits = ['kind']; B[fr.agentId] = 300; B[v.agentId] = 0; X.victims[v.agentId].day = w._absDay() - 3;
        let ok2 = false; const c0 = B[v.agentId]; const cons = conserved(() => { ok2 = true; }); await daily(0.0);
        out.rescue = { helped: !!X.victims[v.agentId]?.helped, got: (B[v.agentId] || 0) > c0, quit: THINGS.quitting(w, id, v), log: /拿了|gives/.test(logs()) }; }
      // ---------- 報社：吵得兇的東西寫成專題 ----------
      { boss.personality.traits = ['kind']; Th.pressDay = -99; const p0 = X.st.press; await daily(0.5); out.press = { n: X.st.press - p0, news: (w.dailyNews?.events || w.dailyNews?._events || []).length >= 0 && /專題|Feature/.test(logs()) }; boss.personality.traits = ['greedy', 'ambitious']; }
      // ---------- 投票：照各自的看法（討厭的贊成禁止、喜歡的和老闆反對）；通過後賭場關門、撤下 ----------
      { const pr = (w.proposals.items || []).find(q => q.id === out.pr); out.vote = { has: !!pr };
        if (pr) { X.att[id][lover.agentId] = 90; X.att[id][hater.agentId] = -90; let hf = 0, lf = 0, of = 0; for (let k = 0; k < 10; k++) for (const [a, acc] of [[hater, 'h'], [lover, 'l'], [boss, 'o']]) { delete pr.votes[a.agentId]; w.proposals._ruleVote(w, pr, a); if (pr.votes[a.agentId] === 'for') { if (acc === 'h') hf++; else if (acc === 'l') lf++; else of++; } }
          out.vote = { has: true, hf, lf, of, why: pr.why?.[hater.agentId], bossAtt: X.att[id][boss.agentId], owner: C.owner === boss.agentId, pthing: pr.thing === id }; pr.status = 'approved'; w.proposals._execute(w, pr, w._absDay());
          THINGS.syncMap(w, tm); out.vote.closed = !C.open && C.ban; out.vote.gone = !!X.list[id].gone; out.vote.label = tm.labelPositions?.casino?.name || ''; } }
      // ---------- 自動發現新建築；新鮮感過了就變成日常 ----------
      { (w.buildings.completed = w.buildings.completed || []).push({ id: 'brewery', buildingKey: 'brewery', name: '釀酒廠', description: '釀酒的地方' }); await daily(0.2);
        const bt = Object.values(X.list).find(x => x.kind === 'building' && !x.gone && /釀酒廠|brewery/i.test(JSON.stringify(x.name))); out.disc = { reg: !!bt, tags: bt ? Object.keys(bt.tags).join(',') : '', ttl: bt?.ttl };
        if (bt) { await daily(0.5); out.disc.ops = Object.keys(X.att[bt.id] || {}).length; bt.born = w._absDay() - 60; await daily(0.5); out.disc.retired = !!bt.gone; } }
      // ---------- AI 知道自己的看法 ----------
      { const H = all.find(a => (X.att[id]?.[a.agentId] ?? 0) <= -60); X.list[id].gone = false; out.brief = H ? THINGS.brief(w, H) : ''; const b2 = w.conversationEngine._agentBrief(w, H || hater, null); out.brief2 = (b2.mem || []).some(s => /看法|feel about/.test(s)); X.list[id].gone = true; }
      // ---------- 存讀檔 ----------
      { const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.save = !!w2.things && Object.keys(w2.things.list).length === Object.keys(X.list).length && JSON.stringify(w2.things.att[id]) === JSON.stringify(X.att[id]) && !!w2.things.list[id].site; }
      // ---------- 守恆：重新開一家，跑 20 天（看法、賭博、賒帳、討債、工資、拉一把） ----------
      { C.ban = false; w.proposals.items = (w.proposals.items || []).filter(q => q.kind !== 'thing_ban'); B[boss.agentId] = 900; fix(0.001, () => { C.lastDay = -1; CASINO.daily(w); }); out.reopen = C.open;
        const M = MONEY.S(w); M.lastT = MONEY.total(w); M.pend = 0; const d0 = w._absDay(); for (const k of Object.keys(M.days)) if (+k >= d0) delete M.days[k].other; tick(96 * 20);
        out.other = Math.round(Object.entries(M.days).filter(([k]) => +k > d0).reduce((x, [, v]) => x + (v.other || 0), 0) * 100) / 100; out.opinions = Object.keys(X.att[C.thing] || {}).length; out.after = { open: C.open, ban: C.ban, why: C.closedWhy }; }
      // ---------- 介面 ----------
      app.state = w.getState(); app._ppTab = 'town'; const box = document.createElement('div'); document.body.appendChild(box); app.renderProposals(box);
      const blk = box.querySelector('.pp-things'); out.ui = { has: !!blk, text: blk?.textContent || '', bar: !!blk?.querySelector('.pp-things-bar i') }; box.remove();
    } finally { TIERS.level = _lv; }
    return out;
  });
  const en = lang === 'en';
  ok(r.reg.open && r.reg.id && r.reg.kind === 'casino' && r.reg.owner >= 80 && r.reg.place === 'casino', '賭場開張就登記成鎮上的新東西，老闆自己最喜歡', r.reg);
  ok(r.reg.dealer, '開賭場雇了一個荷官（多一份工作）', r.reg);
  ok(r.map.zone && r.map.door && r.map.front && r.map.loc && r.map.site && r.map.rebuild, '賭場蓋到地圖上：建築、門口空地、地點名稱，存下位置、重畫地圖', r.map);
  ok(r.map.label.length > 0, '地圖上的賭場有名稱圓牌', r.map.label);
  ok(r.rule.lover > 20 && r.rule.hater < -20 && r.rule.owner >= 80, '沒有 AI 時照個性與價值觀推估：愛冒險愛錢的人喜歡、顧家愛和平的人討厭', r.rule);
  ok(r.ai.n >= 2 && r.ai.facts && r.ai.name && r.ai.love && r.ai.hate, '完整智能體模式交給 AI 判斷，AI 拿得到這東西的事實，每個人的理由是 AI 說的', r.ai);
  ok(r.ai.all >= 5, '其他村民也陸續聽說、各有看法', r.ai);
  ok(r.use.lover > 1.5 && r.use.hater < 0.3, '喜歡的人去得多，討厭的人幾乎不去', r.use);
  ok(r.night.at === 'casino' && r.night.target === 'casino', '晚上真的走進賭場', r.night);
  ok(r.protest.n >= 3 && r.protest.log && r.protest.go >= 3, '討厭的人號召朋友一起到賭場門口抗議，人真的走到門口', r.protest);
  ok(r.protest.at >= 3, '抗議的人站在門口那塊空地上', r.protest);
  ok(r.protest.owner, '老闆出來回應（捐錢安撫或冷冷頂回去）', r.protest);
  ok(r.protest.prop, '抗議的人多，就有人提案禁止賭場', r.protest);
  ok(r.persuade.tried >= 1 && r.persuade.quit && r.persuade.mult === 0 && r.persuade.log, '勸家人別再去：答應之後一段時間不去了', r.persuade);
  ok(r.victim.v <= -50 && r.victim.sp <= -40, '被害慘的人和家人都討厭它', r.victim);
  ok(r.rescue.helped && r.rescue.got && r.rescue.quit && r.rescue.log, '交情好的朋友拉被害的人一把（給錢、勸他別再碰）', r.rescue);
  ok(r.press.n >= 1 && r.press.news, '吵得兇的東西，報社寫成專題', r.press);
  ok(r.vote.has && r.vote.hf === 10 && r.vote.lf === 0 && r.vote.of === 0, '投票照各自的看法：討厭的贊成禁止，喜歡的和老闆反對', r.vote);
  ok(r.vote.closed && r.vote.gone && /歇業|closed/.test(r.vote.label), '通過後賭場關門，地圖上的招牌寫「歇業」', r.vote);
  ok(r.disc.reg && /fun/.test(r.disc.tags) && r.disc.ttl > 0 && r.disc.ops >= 3, '鎮上新蓋好的建築也會自動變成「新東西」，大家各有看法', r.disc);
  ok(r.disc.retired, '新鮮感過了就變成日常的一部分', r.disc);
  ok(/看法|feel about/.test(r.brief) && r.brief2, 'AI 村民聊天時知道自己對這東西的看法', r.brief);
  ok(r.save, '存讀檔後新東西、看法、地圖位置都在', r.save);
  ok(r.reopen && r.opinions >= 3, '重新開一家，大家重新形成看法（之後怎麼樣由村民決定）', { reopen: r.reopen, n: r.opinions, after: r.after });
  ok(Math.abs(r.other) < 3, '跑 20 天（看法、賭博、賒帳、討債、工資、拉一把），不明來源的銀幣幾乎為零', r.other);
  ok(r.ui.has && r.ui.bar && (en ? /what people think/.test(r.ui.text) && !/[一-鿿]/.test(r.ui.text.replace(/「[^」]*」|"[^"]*"/g, '')) : /大家怎麼看/.test(r.ui.text)), '鎮況分頁顯示「鎮上的新東西：大家怎麼看」（喜歡／討厭的人數與心聲）', r.ui);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'zh', { width: 1280, height: 800 });
  await run(browser, 'en', { width: 390, height: 844 });
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
