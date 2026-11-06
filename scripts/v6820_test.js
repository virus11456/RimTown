// v6.82.0 議會實權:哪些案子算大事、議會否決、首長否決被三分之二推翻／否決成立、春季改選(候選人、開票、席次、首長不參選)、
// 出缺由落選者遞補、收錢被揭穿辭職、提案卡顯示議會表決與否決、改選卡、村民卡議事紀錄、存讀檔;中英、桌機與 390px
// 需要本機伺服器:cd wordpress && python3 -m http.server 8126
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 900, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'warning' && /\[Assembly\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(1500);
    const r = await page.evaluate(async (mob) => {
      const app = window.rimtownApp, w = app.world; app._setPaused?.(true); w.observerMode = true; w.fullAgentMode = false; w.politics = null;
      document.querySelectorAll('.modal-overlay,.rt-modal').forEach(m => m.remove());
      const ps = w.proposals, out = {}; const day = ps._abs(w);
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      const T = TIERS.S(w); T.lv = 1;
      const mayor = w.election?._officeHolder?.(w); const pool = npcs().filter(a => a !== mayor && (a.age || 0) >= 18);
      w.council._formed = true; w.council.members = pool.slice(0, 5).map(a => a.agentId);
      const logs = () => (w.messageLog || []).map(m => w.logText ? w.logText(m) : (m.content || '')).join('\n');
      let n = 0; const mk = (kind, extra = {}) => { const key = 'test' + (++n); return ps._createWith(w, day, { kind, key, make: () => Object.assign({ kind, key, tk: '測試案 {n}', tp: { n }, dk: '測試', dp: {}, effects: { mood_all: 1 } }, extra) }, pool[6] || pool[0]); };
      // 大事判定
      const pPol = mk('policy'), pFeast = mk('feast'), pBig = mk('festival', { cost: { silver: 120 } }), pTier = mk('tier_up', { refKey: 'city' });
      out.major = [ASSEMBLY.isMajor(w, pPol), ASSEMBLY.isMajor(w, pFeast), ASSEMBLY.isMajor(w, pBig)];
      T.lv = 0; out.village = [ASSEMBLY.isMajor(w, pPol), ASSEMBLY.isMajor(w, pTier), ASSEMBLY.isMajor(w, mk('tax'))]; T.lv = 1;
      out.needsItem = !!ps.toItem(w, pPol).needsCouncil;
      for (const p of [pFeast, pBig, pTier]) p.status = 'expired';
      // 議會否決:全鎮都反對
      for (const a of npcs()) pPol.votes[a.agentId] = 'against';
      ps._mayorRule(w, pPol, day, false);
      out.rej = { status: pPol.status, by: pPol.decidedBy, pass: pPol.council?.pass, n: pPol.council?.n, result: pPol.result, log: /議會否決|rejected by the council/.test(logs()) };
      // 議會通過、首長否決 → 三分之二推翻
      const pOv = mk('policy'); for (const a of npcs()) pOv.votes[a.agentId] = 'for';
      const vs = {}; w.council.members.forEach(id => vs[id] = 'for');
      pOv.council = { day, for: 5, against: 0, n: 5, votes: vs, why: {}, names: {}, pass: true, sup: true }; pOv.mayorName = mayor?.name || '';
      ps._decide(w, pOv, 'reject', 'mayor');
      out.ov = { status: pOv.status, by: pOv.decidedBy, veto: pOv.veto, log: /推翻否決|overrode the veto/.test(logs()) };
      // 3:2 → 否決成立
      const pSt = mk('policy'); const vs2 = {}; w.council.members.forEach((id, i) => vs2[id] = i < 3 ? 'for' : 'against');
      pSt.council = { day, for: 3, against: 2, n: 5, votes: vs2, why: {}, names: {}, pass: true, sup: false };
      ps._decide(w, pSt, 'reject', 'mayor');
      out.st = { status: pSt.status, over: pSt.veto?.over, result: pSt.result };
      // 春季改選
      const A = ASSEMBLY.S(w); A.formedDay = day - 30; A.lastYear = null;
      const E = ASSEMBLY.start(w);
      out.elec = E ? { seats: E.seats, n: E.cands.length, hasMayor: !!(mayor && E.cands.some(c => c.id === mayor.agentId)) } : null;
      if (E) { for (let i = 0; i < 3; i++) ASSEMBLY.campaign(w, E); const L = ASSEMBLY.tally(w, E);
        out.res = { members: w.council.members.length, seats: E.seats, winnersInCands: w.council.members.every(id => E.cands.some(c => c.id === id)), sorted: L.results.every((x, i, a) => !i || a[i - 1].votes >= x.votes), terms: w.council.members.every(id => (A.rec[id]?.terms || 0) >= 1), turnout: L.turnout, voters: L.voters, runners: A.runners.length, log: /改選開票|election results/.test(logs()) };
        // 改選卡
        app.state = w.getState(); app.activeTab = 'proposals'; app._ppTab = 'props'; if (mob && app._openKairoTab) app._openKairoTab('proposals'); app._updateTabHighlight?.('proposals'); app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
        const card = document.querySelector('.as-card'); out.asCard = card ? { text: card.textContent.slice(0, 200), rows: card.querySelectorAll('.el-cand').length, wins: card.querySelectorAll('.el-win').length } : null;
        // 出缺:落選者遞補
        if (A.runners.length) { const first = A.runners[0]; const gone = w.council.members[0]; w.council.members = w.council.members.slice(1); const k = ASSEMBLY.fillFromRunners.call(w.council, w); out.fill = { k, got: w.council.members.includes(first), gone: !w.council.members.includes(gone), log: /遞補空出來的席次|fills the vacant seat/.test(logs()) }; }
      }
      // 收錢被揭穿 → 辭職
      const bad = w.council.members[0]; ASSEMBLY.R(w, bad).exposed = 1;
      const s = DARK.secret(w, { kind: 'kickback', culprit: bad, victim: null, asm: 'bribe', k: '{c}收了{a}的 {n} 銀幣，在議會投票支持{id}', p: { c: w.agents[bad].name, a: 'x', n: 20, id: 'L1' } }); s.found = true;
      ASSEMBLY.scanSecrets(w); out.resign = { out: !w.council.members.includes(bad), exposed: ASSEMBLY.R(w, bad).exposed, log: /辭去了|resigned as/.test(logs()) };
      // 提案卡:議會表決與否決
      app.state = w.getState(); app.activeTab = 'proposals'; app._ppTab = 'props'; app.renderSidebar(); await new Promise(r => setTimeout(r, 300));
      const cc = [...document.querySelectorAll('.pp-council')]; out.ppCouncil = cc.length; out.ppList = cc[0] ? cc[0].querySelectorAll('.pp-cv').length : 0; out.ppVeto = document.querySelectorAll('.pp-veto').length;
      out.ppText = cc.map(c => c.textContent).join(' | ').slice(0, 300) + ' || ' + [...document.querySelectorAll('.pp-veto')].map(x => x.textContent).join(' | ');
      out.overflow = [...document.querySelectorAll('.pp-council,.pp-veto,.as-card')].filter(el => el.scrollWidth > el.clientWidth + 2).length;
      // 村民卡:議事紀錄
      const mem = w.council.members.find(id => w.agents[id]); app.state = w.getState(); app._showNpcCard(mem); await new Promise(r => setTimeout(r, 300));
      out.rec = ASSEMBLY.recordText(w, w.agents[mem]); out.recShown = (document.getElementById('npc-quick-card')?.textContent || '').includes(t('議事紀錄'));
      // 存讀檔
      const data = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(data);
      out.save = { rec: Object.keys(w2.assembly?.rec || {}).length === Object.keys(A.rec).length, last: !!w2.assembly?.last, elections: w2.assembly?.elections };
      out.leakZh = (typeof I18N !== 'undefined' && I18N.lang === 'en') ? [...document.querySelectorAll('.pp-council-h,.pp-veto,.as-card .el-head,.as-sub')].map(x => x.textContent).filter(s => /[表決改選現任投票率遞補否決議會]/.test(s)) : [];
      return out;
    }, mob);
    ok(r.major[0] && !r.major[1] && r.major[2], '城鎮：政令與花 100 銀幣以上的案子算大事，宴席不算', r.major);
    ok(!r.village[0] && r.village[1] && r.village[2], '村莊：只有申請升格與稅率要送長老會', r.village);
    ok(r.needsItem, '投票中的大事在提案卡上標「要送議會」', r.needsItem);
    ok(r.rej.status === 'rejected' && r.rej.by === 'council' && r.rej.pass === false && r.rej.n === 5 && /議會否決/.test(r.rej.result) && r.rej.log, '全鎮反對的大事被議會否決，不再送首長', r.rej);
    ok(r.ov.status !== 'rejected' && r.ov.by === 'override' && r.ov.veto?.over === true && r.ov.log, '首長否決、議會 5:0 → 三分之二推翻，提案通過', r.ov);
    ok(r.st.status === 'rejected' && r.st.over === false && /否決成立/.test(r.st.result), '議會 3:2 未達三分之二 → 首長否決成立', r.st);
    ok(r.elec && r.elec.n > r.elec.seats && !r.elec.hasMayor, '春季改選：候選人比席次多，首長不參選', r.elec);
    ok(r.res && r.res.members === r.res.seats && r.res.winnersInCands && r.res.sorted && r.res.terms && r.res.turnout > 0 && r.res.log, '開票：票數前幾名當選、席次剛好、記入任期', r.res);
    ok(r.asCard && r.asCard.rows >= 3 && r.asCard.wins >= 1, '提案頁出現改選結果卡（當選者標示）', r.asCard);
    if (r.fill) ok(r.fill.k === 1 && r.fill.got && r.fill.gone && r.fill.log, '有人出缺時由落選者票數最高的遞補', r.fill);
    ok(r.resign.out && r.resign.exposed === 2 && r.resign.log, '議員收錢被揭穿第二次就辭職', r.resign);
    ok(r.ppCouncil >= 2 && r.ppList === 5 && r.ppVeto >= 2, '提案卡顯示議會表決（每位議員贊成／反對）與首長否決結果', { c: r.ppCouncil, l: r.ppList, v: r.ppVeto, t: r.ppText });
    ok(!r.overflow, '議會區塊沒有超出卡片寬度', r.overflow);
    ok(r.rec && r.recShown, '村民卡（心事）有議事紀錄', { rec: r.rec, shown: r.recShown });
    ok(r.save.rec && r.save.last && r.save.elections === 1, '存讀檔後議事紀錄與改選結果都在', r.save);
    if (lang === 'en') ok(!r.leakZh.length, '英文介面沒有漏翻的中文', r.leakZh);
    ok(!errs.length, '沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
