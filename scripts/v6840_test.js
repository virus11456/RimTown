// v6.84.0 從政履歷:開鎮首任、當選／連任屆數、落選下台、任內批准／否決與大案、AI 角色資料記得自己的官職、
// 墓誌銘寫最高官職、村民詳情的「從政履歷」區塊、小卡摘要、存讀檔保留、舊存檔沒有 holderId 也能接上;設定頁「匯出存檔」按鈕能下載;中英、桌機與 390px
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
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block', acceptDownloads: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 60000 }); await page.waitForTimeout(1000);
    const r = await page.evaluate(async (lang) => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const out = {}; const E = w.election; const T = TIERS.S(w);
      const runDay = () => { const d0 = w._absDay(); for (let i = 0; i < 200 && w._absDay() === d0; i++) { w.paused = false; w.tick(); } w.paused = true; };
      runDay(); TIERS.track(w);
      const m0 = E._officeHolder(w); out.m0 = m0?.name || null;
      const c0 = (T.career[m0?.agentId] || []).find(x => x.role === 'leader' && x.to === null);
      out.init = !!c0?.init; out.firstText = TIERS.resume(w, m0)[0]?.notes?.[0] || '';
      // 任內拍板:批准一案、否決一案(其中一案當大案)
      const ps = w.proposals; const day = ps._abs(w); const cands = ps._candidates(w, day) || [];
      const mk = () => { const c = cands.shift(); return c ? ps._create(w, day, c) : null; };
      const p1 = mk(), p2 = mk();
      if (p1) { p1.council = { pass: true, for: 3, against: 0 }; ps._decide(w, p1, 'approve', 'mayor'); }
      if (p2) ps._decide(w, p2, 'reject', 'mayor');
      out.a = c0?.a || 0; out.v = c0?.v || 0; out.bills = (c0?.b || []).length;
      // 選舉:現任參選但落敗
      const res = E._residents(w).filter(a => a.agentId !== m0.agentId);
      const ch = res[0]; const pol = { policy: 'economy', policyLabel: 'x', policyIcon: '💰', speech: 's' };
      const mkC = (a) => Object.assign({ agentId: a.agentId, name: a.name, votes: 0 }, pol);
      E.candidates = [mkC(m0), mkC(ch)]; E.votes = {}; const voters = E._residents(w);
      voters.forEach((v, i) => { E.votes[v.agentId] = i < Math.ceil(voters.length * 0.7) ? ch.agentId : m0.agentId; });
      E._announceResults(w); runDay(); TIERS.track(w);
      const old = (T.career[m0.agentId] || []).filter(x => x.role === 'leader').pop();
      out.oldClosed = old?.to !== null; out.oldEnd = old?.e; out.newHolder = E._officeHolder(w)?.agentId === ch.agentId;
      const nw = (T.career[ch.agentId] || []).find(x => x.role === 'leader' && x.to === null); out.newW = nw?.w; out.newInit = !!nw?.init;
      out.badgeOld = TIERS.badge(w, m0)?.text || ''; out.badgeNew = TIERS.badge(w, ch)?.text || '';
      // 連任:同一人再贏一次 → 2 屆
      E.candidates = [mkC(ch), mkC(m0)]; E.votes = {}; voters.forEach((v, i) => { E.votes[v.agentId] = i < Math.ceil(voters.length * 0.7) ? ch.agentId : m0.agentId; });
      E._announceResults(w); runDay(); TIERS.track(w);
      out.reW = nw?.w; out.chText = TIERS.careerText(w, ch); out.oldText = TIERS.careerText(w, m0);
      // 履歷文字
      const rs = TIERS.resume(w, m0); out.resumeN = rs.length; out.resumeOld = JSON.stringify(rs[0] || {});
      // AI 角色資料
      const ce = w.conversationEngine || w.conversation || app.world.conversationEngine; const CE = ce || Object.create(ConversationEngine.prototype);
      try { const b = CE._agentBrief(w, m0, null); out.brief = (b.mem || []).join(' | '); } catch (e) { out.brief = 'ERR ' + e.message; }
      try { const p = CE._buildCharacterProfile.call(Object.assign(Object.create(ConversationEngine.prototype), { _world: w }), m0); out.profile = p.status || ''; } catch (e) { out.profile = 'ERR ' + e.message; }
      // 詳情頁區塊
      app.state = w.getState(); app.selectedAgent = m0.agentId; const box = document.createElement('div'); document.body.appendChild(box);
      app.renderAgentDetail(box); const sec = box.querySelector('.career-section'); out.detail = !!sec; out.detailItems = sec ? sec.querySelectorAll('.career-item').length : 0; out.detailText = sec ? sec.textContent.replace(/\s+/g, ' ').slice(0, 400) : '';
      out.detailOverflow = sec ? sec.scrollWidth > sec.clientWidth + 2 : null; box.remove();
      // 存讀檔
      const data = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(data); const T2 = TIERS.S(w);
      out.saveKeep = ((T2.career[ch.agentId] || []).find(x => x.role === 'leader' && x.to === null) || {}).w === out.reW;
      // 舊存檔(沒有 holderId)
      delete T2.holderId; delete T2.actingId; let mig = 'ok'; try { runDay(); TIERS.track(w); } catch (e) { mig = e.message; } out.mig = mig; out.migHolder = T2.holderId === E._officeHolder(w)?.agentId;
      // 墓誌銘:前首長過世
      const m0b = w.agents[m0.agentId]; let ep = ''; try { w.lifecycle._killNpc(w, m0b); ep = (w.lifecycle.graveyard || []).slice(-1)[0]?.epitaph || ''; } catch (e) { ep = 'ERR ' + e.message; } out.epitaph = ep;
      return out;
    }, lang);
    const zh = lang === 'zh';
    ok(r.m0 && r.init && (zh ? /開鎮首任/.test(r.firstText) : /first in office/.test(r.firstText)), '開局的首長記成「開鎮首任」', { m0: r.m0, t: r.firstText });
    ok(r.a >= 1 && r.v >= 1 && r.bills >= 1, '任內批准／否決都有記，大案列入', { a: r.a, v: r.v, b: r.bills });
    ok(r.oldClosed && r.oldEnd === 'lost' && r.newHolder, '現任參選落敗：任期結束、記成「落選下台」', { c: r.oldClosed, e: r.oldEnd, h: r.newHolder });
    ok(r.newW === 1 && !r.newInit, '新首長從選舉上任：當選 1 次', { w: r.newW, init: r.newInit });
    ok((zh ? /^前/.test(r.badgeOld) : /^Former/.test(r.badgeOld)) && r.badgeNew && !/^前|^Former/.test(r.badgeNew), '名牌：卸任的掛「前首長」，新任的掛現任', { o: r.badgeOld, n: r.badgeNew });
    ok(r.reW === 2 && (zh ? /2 屆/.test(r.chText) : /×2/.test(r.chText)), '連任一次 → 2 屆，小卡摘要寫出屆數', { w: r.reW, t: r.chText });
    ok(zh ? /前/.test(r.oldText) : /former/.test(r.oldText), '小卡摘要：卸任的人寫「前」', r.oldText);
    ok(r.resumeN >= 1 && (zh ? /落選下台/.test(r.resumeOld) && /批准 \d+ 案/.test(r.resumeOld) && /任|～/.test(r.resumeOld) : /lost re-election/.test(r.resumeOld) && /approved \d+/.test(r.resumeOld)), '完整履歷：任期起訖、卸任原因、批准／否決數', r.resumeOld);
    ok(zh ? /你的從政經歷/.test(r.brief) && /落選下台/.test(r.brief) : /political career/.test(r.brief) && /lost re-election/.test(r.brief), 'AI 決策資料裡記得自己當過首長、怎麼下台', r.brief);
    ok(zh ? /你的從政經歷/.test(r.profile) : /political career/.test(r.profile), 'AI 聊天的角色資料也帶從政經歷', r.profile);
    ok(r.detail && r.detailItems >= 1 && (zh ? /從政履歷/.test(r.detailText) && /任內大案/.test(r.detailText) : /Political career/.test(r.detailText) && /Major bills/.test(r.detailText)), '村民詳情有「從政履歷」與任內大案', r.detailText);
    ok(r.detailOverflow === false, '從政履歷在這個寬度不會橫向溢出', r.detailOverflow);
    ok(r.saveKeep, '存讀檔後屆數不變', r.saveKeep);
    ok(r.mig === 'ok' && r.migHolder, '舊存檔沒有 holderId 也能接上', { m: r.mig, h: r.migHolder });
    ok(zh ? /^曾任.*(村長|鎮長|市長)/.test(r.epitaph) : /^Served .*as /.test(r.epitaph), '前首長過世，墓誌銘寫最高官職', r.epitaph);
    // 匯出存檔按鈕
    const dl = await page.evaluate(() => { const app = window.rimtownApp; const box = document.createElement('div'); document.body.appendChild(box); try { app.renderSettings ? app.renderSettings(box) : null; } catch (e) {} const has = !!document.querySelector('[data-action="settings-export"]'); box.remove(); return has; });
    let file = null;
    try { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.evaluate(() => window.rimtownApp.exportSave())]); file = d.suggestedFilename(); } catch (e) { file = 'ERR ' + e.message; }
    ok(/^rimtown_save_.*\.json$/.test(file || ''), '匯出存檔會下載成 JSON 檔', file);
    ok(dl, '設定頁有「匯出存檔」按鈕', dl);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
