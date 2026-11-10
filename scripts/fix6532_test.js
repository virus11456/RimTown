// v6.53.2 修正:新建城鎮不帶入舊鎮的寵物／祕密／名聲／恩怨(存讀檔也一樣);停在別的子分頁時定案的提案,第一次切回「提案」才播蓋章
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
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Test New Town' : undefined));
    await page.route('**/api/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', ok: true }) }); });
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_3d_q_by', 'user'); sessionStorage.setItem('rimtown_enter_now', '1'); }, { jwt, lang });
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?.world, null, { timeout: 60000 }); await page.waitForTimeout(2500);

    // P3:停在「鎮況」時定案,第一次切回「提案」要播蓋章
    const tabRes = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world, P = w.proposals;
      const ensure = (n) => { while (P.items.filter(x => x.status === 'open').length < n) { const cs = P._candidates(w, P._abs(w)); if (!cs.length) break; const a = Object.values(w.agents).find(x => !x.isPlayer); P._createWith(w, P._abs(w), cs[0], a); } };
      ensure(1); const p = P.items.find(x => x.status === 'open');
      const box = document.createElement('div'); document.body.appendChild(box);
      app.state = w.getState(); app._ppTab = 'town'; app.renderProposals(box);
      P._decide(w, p, 'reject', 'mayor'); app.state = w.getState();
      app.renderProposals(box); app.renderProposals(box); // 側欄在別的子分頁時照常重畫好幾次
      box.querySelector('[data-pp-tab="props"]').click();
      const el1 = box.querySelector(`.pp-card[data-pid="${p.id}"] .pp-stamp-no.pp-stamp-new`); const first = !!el1;
      app.renderProposals(box); const el2 = box.querySelector(`.pp-card[data-pid="${p.id}"] .pp-stamp-no`); const again = el2 !== el1 && !!el2?.classList.contains('pp-stamp-new'); // 沒變就不重畫,同一個元素不會重播
      box.querySelector('[data-pp-tab="truth"]').click(); box.querySelector('[data-pp-tab="props"]').click();
      const back = !!box.querySelector(`.pp-card[data-pid="${p.id}"] .pp-stamp-new`), stamped = !!box.querySelector(`.pp-card[data-pid="${p.id}"] .pp-stamp-no`);
      box.remove(); return { id: p.id, first, again, back, stamped };
    });
    ok(tabRes.first, '停在別的子分頁時定案，第一次切回「提案」會播蓋章', tabRes);
    ok(!tabRes.again && !tabRes.back && tabRes.stamped, '看過之後再重畫或切來切去不再重播，章還在', tabRes);

    // P2:舊鎮放進可辨認的寵物、祕密、名聲、恩怨、小團體、誤會
    const before = await page.evaluate(() => {
      const w = window.rimtownApp.world; PETS.ensure(w); DARK.daily && 0;
      const ids = Object.values(w.agents).filter(a => !a.isPlayer).map(a => a.agentId);
      w.pets.list.push({ id: 'petZZ', sp: 'cat', name: 'ZZOLD', owner: ids[0], home: null, color: 0xffffff, bond: 50 });
      DARK.reputation ? 0 : 0;
      const D = (w.dark = w.dark || { secrets: [], mis: [], n: 0, cool: {}, spoke: {}, exposedCount: {} });
      D.secrets = (D.secrets || []).concat([{ id: 'sZZ', kind: 'cover', by: ids[0], victim: ids[1], text: 'ZZOLD', day: 1 }]);
      D.mis = (D.mis || []).concat([{ kind: 'cold', a: ids[1], b: ids[2], day: 1 }]);
      D.rep = Object.assign(D.rep || {}, { [ids[0]]: { liar: 5 } }); D.feuds = Object.assign(D.feuds || {}, { 'ZZ|OLD': { n: 3, names: ['A', 'B'] } });
      D.cliques = (D.cliques || []).concat([{ name: 'ZZOLD', members: [ids[0], ids[1]], against: [] }]);
      const s = JSON.stringify(w.serialize()); return { has: s.includes('ZZOLD'), townId: window.rimtownApp.currentTownId };
    });
    ok(before.has, '舊鎮存檔裡有標記資料（測試前提）', before);
    await page.evaluate(() => window.rimtownApp.createNewTown());
    await page.waitForFunction((old) => window.rimtownApp.currentTownId && window.rimtownApp.currentTownId !== old, before.townId, { timeout: 30000 });
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world; const pets = app._petView ? app._petView() : PETS.view(w);
      const save = JSON.stringify(w.serialize());
      const D = w.dark || {}; const clean = (o) => !o || !Object.keys(o).length;
      // 存讀檔往返
      const w2 = new World(); w2.loadSave(JSON.parse(save)); const rt = JSON.stringify(w2.serialize());
      return { name: w.townName, petOld: pets.some(p => p.name === 'ZZOLD' || p.id === 'petZZ'), petsOk: (w.pets?.list || []).every(p => p.name !== 'ZZOLD'),
        secrets: (D.secrets || []).length, mis: (D.mis || []).length, rep: clean(D.rep), feuds: clean(D.feuds), cliques: (D.cliques || []).length,
        saveOld: save.includes('ZZOLD') || save.includes('ZZ|OLD'), rtOld: rt.includes('ZZOLD') || rt.includes('ZZ|OLD'), rtPets: (w2.pets?.list || []).length, rtDark: !!w2.dark && w2.dark.secrets.length,
        oldIntact: (app._getTownList?.() || []).length };
    });
    ok(after.name === '邊境鎮', '新城鎮建好了(起始鎮名一律邊境鎮)', after.name);
    ok(!after.petOld && after.petsOk, '新城鎮沒有舊鎮的寵物（地圖與資料都沒有）', after);
    ok(after.secrets === 0 && after.mis === 0 && after.rep && after.feuds && after.cliques === 0, '新城鎮沒有舊鎮的祕密、誤會、名聲、恩怨、小團體', after);
    ok(!after.saveOld && !after.rtOld, '新城鎮存檔與存讀檔往返後也沒有舊鎮資料', after);
    // 新鎮的提案編號重新開始,蓋章動畫也要重新算
    const stamp2 = await page.evaluate(() => {
      const app = window.rimtownApp, w = app.world, P = w.proposals;
      const ensure = (n) => { while (P.items.filter(x => x.status === 'open').length < n) { const cs = P._candidates(w, P._abs(w)); if (!cs.length) break; const a = Object.values(w.agents).find(x => !x.isPlayer); P._createWith(w, P._abs(w), cs[0], a); } };
      ensure(1); const p = P.items.find(x => x.status === 'open'); P._decide(w, p, 'reject', 'mayor'); app.state = w.getState();
      const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'props'; app.renderProposals(box);
      const r = { id: p.id, fresh: !!box.querySelector(`.pp-card[data-pid="${p.id}"] .pp-stamp-new`) }; box.remove(); return r;
    });
    ok(stamp2.fresh, '新城鎮定案的提案也會播蓋章（不受舊鎮同編號影響）', stamp2);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
