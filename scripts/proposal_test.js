#!/usr/bin/env node
// v6.26.0 村民主動提案回歸(選跑;需要 playwright 與本機 http server):
//   cd chrome-extension && python3 -m http.server 8126 &   ;  node scripts/proposal_test.js [http://127.0.0.1:8126]
// 檢查:生成（有提案人、L 編號遞增、種類合理）→ 全鎮投票 → 批准即執行（蓋建築扣資源）→ 否決／擱置 → 三天沒處理依票數自動定案
//   → 公庫不足的批准案等七天作罷 → 擱置十天收回 → 存檔往返保留 → 英文介面標題為英文
//   → v6.30.0 投票理由、人際／對外六種提案與效果、十天後成效、季統計、提案戰績。
const BASE = process.argv[2] || 'http://127.0.0.1:8126';
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('playwright 未安裝:npm i playwright@1 後再跑'); process.exit(0); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let fails = 0, passes = 0; const check = (ok, msg) => { if (ok) { passes++; console.log('  ✓ ' + msg); } else { fails++; console.log('  ✗ ' + msg); } };
  for (const lang of ['zh', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', (route) => { const u = route.request().url(); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) }); if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false }); if (u.includes('/api/saves')) return json({ saves: [] }); if (u.includes('/api/settings')) return json({ settings: {} }); return json({}); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_renderer', '2d'); localStorage.setItem('rimtown_full_agent', '0'); /* v6.41.2 這支測規則版；完整智能體另有測試 */ sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' }); await sleep(3000);
    const r = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world; w.paused = true; const ps = w.proposals; const out = { errs: [] };
      const day0 = ps._abs(w); let day = day0;
      const step = () => { day++; ps._lastDay = null; w._absDay = () => day; ps.daily(w); };
      w._absDay = () => day;
      w.stockpile.add('silver', 500, 0, 'test'); w.stockpile.add('wood', 300, 0, 'test'); w.stockpile.add('stone', 300, 0, 'test');
      // 生成
      for (let i = 0; i < 8 && ps.open().length < 4; i++) { const c = ps._candidates(w, day); if (!c.length) break; ps._create(w, day, c[i % c.length]); }
      const open = ps.open(); out.made = open.length; out.ids = open.map(p => p.id); out.kinds = open.map(p => p.kind); out.proposers = open.map(p => !!w.agents[p.proposerId] && !w.agents[p.proposerId].isPlayer);
      out.titles = open.map(p => ps.title(p));
      ps._vote(w); ps._vote(w); ps._vote(w);
      out.votes = open.map(p => Object.keys(p.votes).length);
      // 批准一件建設(優先挑 build)
      const b = open.find(p => p.kind === 'build') || open[0]; const silverBefore = w.stockpile.get('silver'); const projBefore = (w.buildings.projects || []).length;
      const r1 = ps.decide(w, b.id, 'approve'); out.approveOk = r1.ok; out.approvedStatus = b.status; out.result = b.result;
      out.projectStarted = b.kind !== 'build' || (w.buildings.projects || []).length === projBefore + 1;
      // 否決、擱置
      const others = ps.open(); const rej = others[0], sh = others[1];
      if (rej) { ps.decide(w, rej.id, 'reject'); out.rejected = rej.status === 'rejected'; }
      if (sh) { ps.decide(w, sh.id, 'shelve'); out.shelved = sh.status === 'shelved'; }
      // 自動定案:剩下的 open 三天後依票數
      const rest = ps.open(); for (const p of rest) { p.votes = {}; for (const a of Object.values(w.agents)) if (!a.isPlayer) p.votes[a.agentId] = 'for'; }
      step(); step(); step();
      out.autoDecided = rest.length === 0 || rest.every(p => ['done', 'approved', 'rejected', 'failed', 'shelved'].includes(p.status) && (p.decidedBy === 'auto' || p.decidedBy === 'mayor')); // v6.37.0 鎮長裁決
      // 公庫不足:造一件買不起的,批准後等七天作罷
      const poor = ps._create(w, day, { kind: 'build', key: 'build:town_walls_test', jobs: ['guard'], make: (a) => ({ kind: 'build', key: 'build:town_walls_test', refKey: 'town_walls', tk: '在鎮上蓋{name}', tp: { name: 'X' }, dk: '{desc}', dp: { desc: '' }, cost: { silver: 99999 }, category: 'defense', jobBias: [] }) });
      ps.decide(w, poor.id, 'approve'); for (let i = 0; i < 9; i++) step();
      out.poorFailed = poor.status === 'failed';
      // 擱置十天收回
      if (sh) { for (let i = 0; i < 11; i++) step(); out.shelfExpired = ['approved', 'done', 'rejected', 'failed', 'expired'].includes(sh.status) && (sh.decidedBy === 'mayor' || sh.status === 'expired'); } // v6.37.0 擱置三天後鎮長重新拍板
      // 存檔往返
      const ser = JSON.parse(JSON.stringify(ps.serialize())); const P2 = new ProposalSystem(); P2.loadFrom(ser);
      out.roundTrip = P2.counter === ps.counter && P2.items.length === ps.items.length && P2.toDict(w).history.length === ps.toDict(w).history.length;
      // ---------- v6.30.0 ----------
      // 投票理由:每一票都有理由鍵,toItem 給前兩名
      const voted = ps.items.find(p => Object.keys(p.votes).length > 0 && p.why);
      out.whyAll = !!voted && Object.keys(voted.votes).every(aid => typeof voted.why[aid] === 'string' && voted.why[aid].length > 0);
      const vi = voted ? ps.toItem(w, voted) : null; out.whyTop = !!vi && (vi.forWhy.length + vi.againstWhy.length) > 0 && vi.forWhy.every(x => x.why && x.n > 0);
      // 人際／對外六種:把鎮況調成會觸發的樣子,逐一生成、批准、看效果
      const npcs = ps._npcs(w); const [A, B] = npcs; const ra = A.relationships.getOrCreate(B.agentId, B.name), rb = B.relationships.getOrCreate(A.agentId, A.name); ra.affinity = -60; rb.affinity = -55;
      const JS = (typeof JOB_SKILL_MAP !== 'undefined') ? JOB_SKILL_MAP : {}; const master = npcs.find(a => JS[a.job?.key]?.primary?.[0]) || npcs[2]; const prim = JS[master.job?.key].primary[0]; master.skills.skills[prim].xp = 999999; const appr = npcs.find(a => a !== master && a.job?.key === master.job?.key) || npcs.find(a => a !== master && a !== A && a !== B); if (appr && appr.job?.key !== master.job?.key) appr.age = 20; appr.skills.skills[prim].xp = 0;
      w.stockpile.add('food', 300, 0, 'test'); w.stockpile.add('silver', 200, 0, 'test'); const tpOld = w.events.TARGET_POPULATION; w.events.TARGET_POPULATION = 99; ps.cooldown = {}; ps.proposerCooldown = {}; for (const q of ps.pending()) ps.decide(w, q.id, 'reject'); if (w.council) w.council.activeDecrees = (w.council.activeDecrees || []).filter(d => d.id !== 'prop_envoy'); // 清掉前面隨機階段留下的同類待決案與結盟政令,六種才都提得出來
      const cands = ps._candidates(w, day); out.newKinds = ['mediate', 'honor', 'mentor', 'trade', 'envoy', 'recruit'].filter(k => cands.some(c => c.kind === k));
      const fx = {};
      for (const k of out.newKinds) {
        const c = cands.find(c => c.kind === k); const p = ps._create(w, day, c); if (!p) { fx[k] = 'no-proposer'; continue; }
        const silver0 = w.stockpile.get('silver'); const aff0 = ra.affinity; const mood0 = (w.agents[p.refKey]?.moodModifier || 0); const apP = k === 'mentor' ? w.agents[p.pair[1]] : null; const lv0 = apP ? apP.skills.skills[p.skill].level : 0; const pop0 = Object.keys(w.agents).length; const dec0 = (w.council?.activeDecrees || []).length;
        ps.decide(w, p.id, 'approve');
        let ok = p.status === 'done';
        if (k === 'mediate') ok = ok && ra.affinity > aff0;
        if (k === 'honor') ok = ok && (w.agents[p.refKey]?.moodModifier || 0) > mood0;
        if (k === 'mentor') ok = ok && apP && apP.skills.skills[p.skill].level > lv0;
        if (k === 'trade') ok = ok && w.stockpile.get('silver') > silver0;
        if (k === 'envoy') ok = ok && (w.council?.activeDecrees || []).length === dec0 + 1;
        if (k === 'recruit') ok = ok && Object.keys(w.agents).length === pop0 + 1;
        fx[k] = ok ? 'ok' : `${p.status}:${p.result}`;
      }
      w.events.TARGET_POPULATION = tpOld; out.newFx = fx;
      // 成效追蹤:做完的案子有快照,十天後有 outcome
      const doneP = ps.items.find(p => p.status === 'done' && p.snap); out.snapOk = !!doneP;
      for (let i = 0; i < 11; i++) step();
      out.outcomeOk = !!doneP && !!doneP.outcome && typeof ps.outcomeText(doneP.outcome) === 'string' && ps.toItem(w, doneP).outcomeText.length > 0;
      // 季統計與戰績
      const st = ps.periodStats(w, day0, day + 1); out.period = st; out.periodOk = st.made >= ps.items.length - 1 && st.done >= 1 && !!st.top;
      const rec = ps.record(doneP?.proposerId); out.recordOk = !!rec && rec.made >= 1 && rec.done >= 1;
      const ser2 = JSON.parse(JSON.stringify(ps.serialize())); const P3 = new ProposalSystem(); P3.loadFrom(ser2); out.trackRT = JSON.stringify(P3.track) === JSON.stringify(ps.track) && Object.keys(P3.track).length > 0;
      out.dict = ps.toDict(w); out.stats = ps.stats;
      out.titleSample = out.titles[0] || '';
      return out;
    });
    console.log(`[${lang}]`, JSON.stringify({ made: r.made, ids: r.ids, kinds: r.kinds, stats: r.stats, title: r.titleSample }));
    check(errs.length === 0, `無 page error ${JSON.stringify(errs.slice(0, 2))}`);
    check(r.made >= 2, `有生成提案 (${r.made})`);
    check(r.ids.every((id, i) => /^L\d{3}$/.test(id)) && new Set(r.ids).size === r.ids.length, `L 編號格式與不重複 ${r.ids.join(',')}`);
    check(r.proposers.every(Boolean), '提案人都是村民');
    check(r.votes.every(n => n > 0), `全鎮有投票 (${r.votes.join(',')})`);
    check(r.approveOk && (r.approvedStatus === 'done' || r.approvedStatus === 'approved'), `批准後執行 (${r.approvedStatus}: ${r.result})`);
    check(r.projectStarted, '建設案批准後工地出現');
    check(r.rejected !== false, '可否決'); check(r.shelved !== false, '可擱置');
    check(r.autoDecided, '三天沒處理依票數自動定案');
    check(r.poorFailed, '買不起的批准案等七天作罷');
    check(r.shelfExpired !== false, '擱置幾天後鎮長重新拍板');
    check(r.roundTrip, '存檔往返保留');
    check(r.dict.history.length > 0 && r.dict.stats.made === r.stats.made, 'toDict 歷史與統計一致');
    // v6.30.0
    check(r.whyAll && r.whyTop, '每一票都有理由，卡片給前兩名');
    check(r.newKinds.length === 6, `人際／對外六種都會被提出 (${r.newKinds.join(',')})`);
    check(Object.values(r.newFx || {}).every(v => v === 'ok'), `六種批准後都有效果 ${JSON.stringify(r.newFx)}`);
    check(r.snapOk && r.outcomeOk, '做完的案子十天後有成效回報');
    check(r.periodOk, `季統計 ${JSON.stringify(r.period)}`);
    check(r.recordOk && r.trackRT, '提案戰績累計且存檔往返');
    if (lang === 'en') check(/^[\x00-\x7F]*$/.test(r.titleSample.replace(/[^\x00-\x7F]/g, '')) && !/[一-鿿]/.test(r.titleSample), `英文介面提案標題為英文 (${r.titleSample})`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
})();
