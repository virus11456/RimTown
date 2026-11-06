// v6.76.2 執行效能:翻譯結果快取(語言／字典／人名／城鎮等級一變就作廢)、getState 的關係／記憶／提案／紀錄讀到才算、
// 已定案提案沿用算好的內容、伴侶／配偶查詢依感情狀態版本快取、錢包單人查詢不再掃全鎮
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
    const r = await page.evaluate(async (lang) => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; w.paused = false; w.fullAgentMode = false; const out = {};
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      // 1) 稱號換字:等級一變快取就作廢
      const T = TIERS.S(w); const lv0 = T.lv; T.lv = 0; const z0 = t('鎮長'); T.lv = 1; const a1 = t('鎮長'); T.lv = 2; const a2 = t('鎮長'); T.lv = 1; const a3 = t('鎮長'); T.lv = 0; const z1 = t('鎮長'); T.lv = lv0;
      out.tier = { z0, z1, a1, a2, a3, want0: lang === 'zh' ? TIERS.LV[0].leader : TIERS.LV[0].leaderEn, want2: lang === 'zh' ? TIERS.LV[2].leader : null };
      // 2) 人名對照登記後,已快取的句子也換成新英文名
      const s0 = t('阿測試今天來了'); I18N.registerName('阿測試', 'Testy'); const s1 = t('阿測試今天來了');
      out.name = { s0, s1 };
      // 3) 切語言:快取跟著換
      const k = '存檔';
      const before = t(k); I18N.setLang(lang === 'zh' ? 'en' : 'zh'); await new Promise(r => I18N.ensureDict(r)); await new Promise(r => setTimeout(r, 300));
      const mid = t(k); I18N.setLang(lang); await new Promise(r => setTimeout(r, 200)); const after = t(k);
      out.lang = { before, mid, after };
      // 4) 中文半形標點照樣轉全形(快取前後一致)
      if (lang === 'zh') { const p1 = t('喲,這不是你嗎?'); const p2 = t('喲,這不是你嗎?'); out.punct = { p1, p2 }; }
      // 5) 長段落不進快取但結果一樣
      const long = '鎮長' + '很長的一段話'.repeat(80); out.longOk = t(long).length > 400;
      // 6) 伴侶／配偶查詢:改狀態、刪關係都會重查
      const free = npcs().filter(a => !a.relationships.getPartner());
      const A = free[0], B = free[1]; const rel = A.relationships.getOrCreate(B.agentId, B.name);
      const p0 = A.relationships.getPartner(); rel.status = 'dating'; const p1 = A.relationships.getPartner(); const s1x = A.relationships.getSpouse();
      rel.status = 'married'; const s2 = A.relationships.getSpouse(); rel.status = 'ex'; const p3 = A.relationships.getPartner();
      rel.status = 'married'; A.relationships.getSpouse(); delete A.relationships.relationships[B.agentId]; const p4 = A.relationships.getPartner(), s4 = A.relationships.getSpouse();
      out.pair = { p0: p0 === null, p1: p1 === rel, s1: s1x === null, s2: s2 === rel, p3: p3 === null, p4: p4 === null, s4: s4 === null };
      // 7) 跑 20 天,查詢結果跟直接掃一遍完全一樣
      let err = null; const d0 = w._absDay();
      for (let i = 0; i < 25 * 96 && w._absDay() - d0 < 20; i++) { w.paused = false; try { w.tick(); } catch (e) { err = e.message; break; } }
      out.err = err; out.days = w._absDay() - d0;
      let mism = 0, bfMism = 0, riMism = 0;
      for (const a of Object.values(w.agents)) {
        const R = a.relationships; const vals = Object.values(R.relationships);
        if ((vals.find(x => x.status === 'dating' || x.status === 'married') || null) !== R.getPartner()) mism++;
        if ((vals.find(x => x.status === 'married') || null) !== R.getSpouse()) mism++;
        const fr = vals.filter(x => x.affinity > 20); const bf = fr.length ? fr.reduce((x, y) => x.affinity > y.affinity ? x : y) : null; if (bf !== R.getBestFriend()) bfMism++;
        const ri = vals.filter(x => x.romanticInterest > 40); const ri2 = R.getRomanticInterests(); if (ri.length !== ri2.length || ri.some((x, i) => x !== ri2[i])) riMism++;
      }
      out.mism = { mism, bfMism, riMism };
      // 8) 存檔裡感情狀態照存(status 走 getter)
      const blob = w.serialize(); let stOk = 0, stAll = 0;
      for (const a of npcs()) { const sa = blob.agents?.[a.agentId]; if (!sa) continue; for (const x of Object.values(a.relationships.relationships)) { if (!x.status) continue; stAll++; const sr = sa.relationships?.[x.targetId]; if (sr && sr.status === x.status) stOk++; } }
      out.save = { stOk, stAll };
      // 9) getState:讀到才算,JSON 與展開都拿得到
      const st = w.getState(); const any = npcs()[0];
      const js = JSON.parse(JSON.stringify(st));
      out.lazy = { keys: ['proposals', 'recent_messages'].every(k2 => Object.keys(st).includes(k2)), rels: Array.isArray(js.agents[any.agentId].relationships) && js.agents[any.agentId].relationships.length === Object.keys(any.relationships.relationships).length,
        mems: Array.isArray(js.agents[any.agentId].recent_memories) && js.agents[any.agentId].recent_memories.length === any.memory.entries.length,
        msgs: Array.isArray(js.recent_messages) && js.recent_messages.length === Math.min(500, w.messageLog.length), props: !!js.proposals && Array.isArray(js.proposals.open) && Array.isArray(js.proposals.history),
        spread: Array.isArray({ ...st.agents[any.agentId] }.relationships), set: (() => { const s2 = w.getState(); s2.proposals = 'x'; return s2.proposals === 'x'; })() };
      // 10) 已定案提案:沿用算好的,但成效出來會重算;還在進行的照常即時
      const P = w.proposals; let hist = P.items.filter(p => ['done', 'failed', 'rejected', 'expired'].includes(p.status));
      if (!hist.length && P.items.length) { const p = P.items[0]; p.status = 'rejected'; p.resolvedDay = w._absDay(); hist = [p]; }
      const h = hist.sort((a, b) => b.n - a.n)[0];
      const d1 = P.toDict(w); const i1 = d1.history.find(x => x.id === h.id); const d2 = P.toDict(w); const i2 = d2.history.find(x => x.id === h.id);
      const oc = h.outcome; h.outcome = { verdict: 'good', note: 'x' }; const d3 = P.toDict(w); const i3 = d3.history.find(x => x.id === h.id); h.outcome = oc;
      const fresh = P.toItem(w, h); delete fresh.affordable;
      const same = JSON.stringify(Object.assign({}, i1, { affordable: undefined })) === JSON.stringify(Object.assign({}, P.toItem(w, h), { affordable: undefined }));
      out.hist = { reuse: i1 === i2, recalc: !!i3 && i3 !== i1 && !!i3.outcome, same, notSaved: !JSON.stringify(P.items).includes('"_ti"'), max20: d1.history.length <= 20 };
      const openP = P.items.find(p => p.status === 'open');
      if (openP) { const before2 = P.toDict(w).open.find(x => x.id === openP.id).forCount; const v = npcs().find(a => !openP.votes[a.agentId]); if (v) { openP.votes[v.agentId] = 'for'; } const after2 = P.toDict(w).open.find(x => x.id === openP.id).forCount; out.live = { before2, after2, voted: !!v }; delete openP.votes[v?.agentId]; }
      // 11) 錢包:新居民第一次查就有起始存款,而且之後一致
      const nb = npcs()[npcs().length - 1]; delete w.wallet.bal[nb.agentId];
      const g1 = WALLET.get(w, nb), g2 = WALLET.get(w, nb); WALLET.add(w, nb, 5); const g3 = WALLET.get(w, nb);
      out.wallet = { g1, g2, g3 };
      // 讀檔後(新的錢包物件)照常
      const sv = w.serialize(); w.loadSave(JSON.parse(JSON.stringify(sv))); const nb2 = Object.values(w.agents).find(a => a.agentId === nb.agentId);
      out.wallet2 = { g: WALLET.get(w, nb2), want: Math.max(0, Math.round((sv.wallet?.bal?.[nb.agentId] || 0) * 10) / 10) };
      return out;
    }, lang);
    const want = lang === 'zh' ? '鎮長' : 'Mayor';
    ok(r.tier.a1 === want && r.tier.a3 === want && r.tier.a2 !== want && (lang !== 'zh' || r.tier.a2 === r.tier.want2) && r.tier.z0 === r.tier.want0 && r.tier.z1 === r.tier.want0, '稱號換字跟著城鎮等級變(村莊 0 → 城鎮 1 → 城市 2,快取會作廢)', r.tier);
    ok(lang === 'zh' ? r.name.s1 === r.name.s0 : (r.name.s1.includes('Testy') && !r.name.s0.includes('Testy')), lang === 'zh' ? '中文介面人名不換' : '登記英文名後,先前快取的句子也換成新名字', r.name);
    ok(r.lang.before === r.lang.after && r.lang.mid !== r.lang.before, '切語言後翻譯跟著換,切回來也正確', r.lang);
    if (lang === 'zh') ok(r.punct.p1 === '喲，這不是你嗎？' && r.punct.p2 === r.punct.p1, '中文半形標點照樣轉全形', r.punct);
    ok(r.longOk, '長段落照常翻譯(不進快取)', r.longOk);
    ok(Object.values(r.pair).every(Boolean), '伴侶／配偶:交往、結婚、分手、刪關係都即時反映', r.pair);
    ok(!r.err && r.days >= 20, '跑 20 天沒有錯誤', { err: r.err, days: r.days });
    ok(r.mism.mism === 0 && r.mism.bfMism === 0 && r.mism.riMism === 0, '20 天後伴侶／配偶／摯友／心儀對象查詢跟直接掃一遍完全一樣', r.mism);
    ok(r.save.stAll === 0 || r.save.stOk === r.save.stAll, '感情狀態照常寫進存檔', r.save);
    ok(Object.values(r.lazy).every(Boolean), 'getState 讀到才算:JSON／展開／指定都正常', r.lazy);
    ok(r.hist.reuse && r.hist.recalc && r.hist.same && r.hist.notSaved && r.hist.max20, '已定案提案沿用、成效出來重算、內容跟即時算的一樣、不進存檔', r.hist);
    if (r.live) ok(!r.live.voted || r.live.after2 === r.live.before2 + 1, '進行中的提案票數即時更新', r.live);
    ok(r.wallet.g1 > 0 && r.wallet.g2 === r.wallet.g1 && Math.abs(r.wallet.g3 - r.wallet.g1 - 5) < 0.11, '錢包:新居民第一次查就有起始存款且一致', r.wallet);
    ok(r.wallet2.g === r.wallet2.want, '讀檔後錢包照常', r.wallet2);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
