// v6.88.0 社交距離與遺忘:圈層上限(內圈 5／好友 15／朋友 50／點頭之交 150)、家人伴侶不忘、越外圈淡得越快、記仇比記恩久、
// 淡到沒意義就忘掉、舊檔沒互動時間不會一讀就忘、二度「聽某某說過」與三度、AI 決策資料與 NPC 對話依距離寫、
// 八卦傳太多手沒人講、第 3 手起記成輾轉聽來、遠人小事記憶慢慢淡(家人與重要的事不淡)、詳情顯示圈層、存讀檔;中英、桌機與 390px
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = (process.env.BASE || 'http://localhost:8126/').replace(/\/?$/, '/');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {}; const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const all = npcs(); const [A, B, C, D, E, F] = all; const now = w.tickCount; const DAY = 96;
      const clear = (a) => { a.relationships.relationships = {}; };
      for (const a of all) clear(a);
      const link = (x, y, aff, idleDays = 0, extra = {}) => { const r = x.relationships.getOrCreate(y.agentId || y.id, y.name); r.affinity = aff; r.trust = extra.trust ?? Math.round(aff / 2); r.interactionCount = extra.n ?? 5; r.lastInteractionTick = now - idleDays * DAY; Object.assign(r, extra.set || {}); return r; };
      const base = w._absDay; let off = 0; w._absDay = () => base.call(w) + off;
      const step = (n = 1) => { for (let i = 0; i < n; i++) { off++; w.social = w.social || {}; w.social.lastDay = null; SOCIAL.daily(w); } };
      // 1) 圈層上限
      for (let i = 0; i < 80; i++) link(A, { id: 'fake' + i, name: '路人' + i }, 90 - i);
      const cnt = SOCIAL.counts(w, A); out.caps = cnt; for (let i = 0; i < 80; i++) delete A.relationships.relationships['fake' + i];
      // 2) 遺忘:點頭之交淡得比內圈快、家人不淡、記仇比記恩久、淡到沒意義就忘
      const kidRel = link(A, B, 30, 60); B._parentNames = [A.name, 'x'];
      const inner = link(A, C, 85, 60, { trust: 70 }); const acq = link(A, D, 12, 60, { trust: 6 });
      const foe = link(E, F, -40, 60, { trust: -20 }); const pal = link(E, D, 40, 60, { trust: 20 });
      const old = link(A, E, 15, 0); old.lastInteractionTick = 0; // 舊檔沒記互動時間
      const v0 = { kid: kidRel.affinity, inner: inner.affinity, acq: acq.affinity, foe: foe.affinity, pal: pal.affinity, old: old.affinity };
      step(5);
      out.forget = { kid: kidRel.affinity - v0.kid, inner: v0.inner - inner.affinity, acq: v0.acq - (A.relationships.relationships[D.agentId]?.affinity ?? 0), foe: foe.affinity - v0.foe, pal: v0.pal - pal.affinity, old: v0.old - old.affinity, oldStamped: old.lastInteractionTick > 0 };
      step(30); out.acqGone = !A.relationships.relationships[D.agentId]; out.kidKept = !!A.relationships.relationships[B.agentId] && A.relationships.relationships[B.agentId].affinity === 30;
      // 3) Dunbar 150
      for (let i = 0; i < 175; i++) link(F, { id: 'crowd' + i, name: '人' + i }, 20 + (i % 50), 0);
      step(1); out.dunbar = Object.keys(F.relationships.relationships).filter(k => k.startsWith('crowd')).length;
      for (const k of Object.keys(F.relationships.relationships)) if (k.startsWith('crowd')) delete F.relationships.relationships[k];
      // 4) 二度、三度
      for (const a of all) clear(a); off += 1;
      link(A, B, 50); link(B, A, 50); link(B, C, -30); link(C, B, -30); link(B, E, 50); link(E, B, 50); link(E, D, 50); link(D, E, 50); // A→B→E→D;B 跟 C 處不來,所以不會從 C 聽到消息
      out.d = { AB: SOCIAL.distance(w, A, B), AC: SOCIAL.distance(w, A, C), AD: SOCIAL.distance(w, A, D), AF: SOCIAL.distance(w, A, F) };
      const h = SOCIAL.heardOf(w, A, C.agentId); out.via = h?.via?.agentId === B.agentId; out.imp = h?.aff; out.AF = SOCIAL.distance(w, A, F) === Infinity;
      link(B, D, 40); out.AD2 = SOCIAL.distance(w, A, D); delete B.relationships.relationships[D.agentId];
      // 5) AI 決策資料
      const CE = w.conversationEngine || Object.create(ConversationEngine.prototype);
      out.briefKnown = CE._agentBrief(w, A, B).rel || ''; out.briefHeard = CE._agentBrief(w, A, C).rel || ''; out.briefNone = CE._agentBrief(w, A, F).rel || '';
      // NPC 對話的關係描述
      CE._socialCtx = { world: w, a: A, b: C }; const rc = A.relationships.getOrCreate(C.agentId, C.name); rc.affinity = 0; rc.trust = 0; rc.interactionCount = 0; out.convCtx = CE._buildRelContext(rc, C.name); CE._socialCtx = null; delete A.relationships.relationships[C.agentId];
      // 6) 八卦
      const G = w.gossipNetwork || w.events?.gossipNetwork; out.hasG = !!G;
      if (G) {
        A.personality.traits = [...new Set([...(A.personality.traits || []), 'gossip'])];
        G.activeGossip = [{ about: E.name, content: 'x', contentT: { k: '{who}最近心情超好的！', p: { who: E.name } }, source: B.name, spreadCount: 6, tickCreated: now, isTrue: true }];
        out.deadGossip = G.spreadGossip(A, D, w) === null;
        G.activeGossip = [{ about: B.name, content: 'x', contentT: { k: '{who}最近心情超好的！', p: { who: B.name } }, source: C.name, spreadCount: 2, tickCreated: now, isTrue: true }];
        const n0 = D.memory.entries.length; const g = G.spreadGossip(A, D, w); const m = D.memory.entries[D.memory.entries.length - 1];
        out.farMem = g && D.memory.entries.length > n0 ? (typeof m.text === 'function' ? m.text() : m.content) : ''; out.farImp = m?.importance;
      }
      // 7) 遠人小事慢慢淡
      const mm = A.memory; const t0 = now - 30 * DAY;
      mm.entries.push(Object.assign(Object.create(Object.getPrototypeOf(mm.entries[0] || {})), { tick: t0, timeStr: 'x', category: 'observation', importance: 3, relatedAgents: [F.name], content: '看到遠方的人' }));
      mm.entries.push(Object.assign(Object.create(Object.getPrototypeOf(mm.entries[0] || {})), { tick: t0, timeStr: 'x', category: 'social', importance: 3, relatedAgents: [B.name], content: '跟好友聊天' }));
      mm.entries.push(Object.assign(Object.create(Object.getPrototypeOf(mm.entries[0] || {})), { tick: t0, timeStr: 'x', category: 'event', importance: 8, relatedAgents: [F.name], content: '大事' }));
      const far = mm.entries[mm.entries.length - 3], near = mm.entries[mm.entries.length - 2], big = mm.entries[mm.entries.length - 1];
      step(35); out.mem = { far: mm.entries.includes(far) ? far.importance : 'gone', near: near.importance, big: big.importance };
      w._absDay = base;
      // 8) 詳情圈層
      app.state = w.getState(); app.selectedAgent = A.agentId; const box = document.createElement('div'); box.style.width = (window.innerWidth < 500 ? 340 : 420) + 'px'; document.body.appendChild(box);
      app.renderAgentDetail(box); const line = box.querySelector('.social-circles'); out.circLine = line ? line.textContent : ''; out.tags = [...box.querySelectorAll('.rel-circle')].map(x => x.textContent);
      out.overflow = line ? line.scrollWidth > line.clientWidth + 2 : null; box.remove();
      // 9) 存讀檔、跑幾天沒錯
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data); out.save = !!w2.social && w2.social.forgot === w.social.forgot && w2.agents[A.agentId].relationships.relationships[B.agentId]?.lastInteractionTick === A.relationships.relationships[B.agentId]?.lastInteractionTick;
      let err = null; const d0 = w._absDay(); for (let i = 0; i < 96 * 6 && w._absDay() - d0 < 5; i++) { w.paused = false; try { w.tick(); } catch (e) { err = e.message; break; } } out.err = err;
      return out;
    });
    const zh = lang === 'zh';
    ok(r.caps[1] <= 5 && r.caps[2] <= 15 && r.caps[3] <= 50 && r.caps[1] + r.caps[2] + r.caps[3] + r.caps[4] === 80, '圈層有上限：內圈 5、好友 15、朋友 50，其餘是點頭之交', r.caps);
    ok(r.forget.kid === 0 && r.kidKept, '家人不會淡掉', { k: r.forget.kid, kept: r.kidKept });
    ok(r.forget.acq > r.forget.inner / 2 && r.forget.inner > 0, '點頭之交淡得比內圈快（同樣很久沒見）', r.forget);
    ok(r.forget.foe < r.forget.pal && r.forget.foe > 0, '記仇比記恩久', r.forget);
    ok(r.acqGone, '淡到沒意義就整段忘掉', r.acqGone);
    ok(r.forget.oldStamped && r.forget.old === 0, '舊存檔沒互動時間的關係不會一讀檔就開始忘', r.forget);
    ok(r.dunbar <= 150, '一個人最多記得約 150 段關係', r.dunbar);
    ok(r.d.AB === 1 && r.d.AC === 2 && r.d.AD === 3 && r.AF && r.via && r.imp < 0, '社交距離：認識 1、朋友的朋友 2、再遠一層 3、陌生人；記得是聽誰說的、對方印象', { d: r.d, via: r.via, imp: r.imp });
    ok(r.AD2 === 2, '多一個共同朋友，距離就縮短', r.AD2);
    ok(zh ? /家人|內圈|好友|朋友|點頭之交/.test(r.briefKnown) : /Inner|friend|Acquaint|Family/i.test(r.briefKnown), 'AI 決策資料：認識的人寫圈層', r.briefKnown);
    ok(zh ? /只聽.+說過/.test(r.briefHeard) && /不怎麼樣/.test(r.briefHeard) : /heard about them from/.test(r.briefHeard), 'AI 決策資料：二度寫「聽某某說過」和印象', r.briefHeard);
    ok(zh ? /不認識/.test(r.briefNone) : /do not know/.test(r.briefNone), 'AI 決策資料：陌生人寫「不認識」', r.briefNone);
    ok(zh ? /只聽.+說過/.test(r.convCtx) : /heard about them from/.test(r.convCtx), 'NPC 對話的關係描述也依距離寫', r.convCtx);
    ok(r.hasG && r.deadGossip, '傳太多手的八卦沒人再講', r.deadGossip);
    ok((zh ? /輾轉聽來/.test(r.farMem) : /second-hand/.test(r.farMem)) && r.farImp <= 3, '第 3 手起記成「輾轉聽來的」，也比較不放在心上', { m: r.farMem, i: r.farImp });
    ok((r.mem.far === 'gone' || r.mem.far < 3) && r.mem.near === 3 && r.mem.big === 8, '只跟遠的人有關的小事慢慢淡掉；好友相關與重要的事不淡', r.mem);
    ok(zh ? /家人.*內圈.*好友.*朋友.*點頭之交/.test(r.circLine) : /Family.*Inner/.test(r.circLine), '村民詳情顯示各圈人數', r.circLine);
    ok(r.tags.length >= 1, '關係列表標出圈層', r.tags);
    ok(r.overflow === false, '圈層那行在這個寬度不會橫向溢出', r.overflow);
    ok(r.save, '存讀檔保留遺忘紀錄與互動時間', r.save);
    ok(!r.err, '跑幾天沒有錯誤', r.err);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
