// v6.73.0 歷史與傳承:史書(規則／AI、換季自動寫)、名人登記與傳說(過世後成為傳說、立像)、家族家訓與名聲、世仇與聯姻化解、AI 知道家族與傳說、畫面(中英家族名)、存讀檔
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
      const logHas = (re) => (w.messageLog || []).slice(-40).some(m => re.test(m.content || ''));
      const stubAI = (resp) => { const s = { fa: w.fullAgentMode, ok: CE.fullAgentOk, aj: CE._askJson }; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async () => resp; return () => { w.fullAgentMode = s.fa; CE.fullAgentOk = s.ok; CE._askJson = s.aj; }; };
      const out = {}; const L = LEGACY.S(w); const all = npcs();
      out.nameEn = (typeof I18N !== 'undefined') ? I18N.localizeNames(all[0].name, true) : ''; // 人名翻譯不能壞
      // 史書(規則)
      w.logMessageT('event', '⚔️ 政變成功！{a}推翻舊王，自立為王，建立{d}。', { a: all[0].name, d: '金冠王朝' });
      const c1 = await LEGACY.chapter(w, L, 1, '春季'); out.chapter = !!c1 && c1.n >= 1 && logHas(/鎮史|town history/);
      let restore = stubAI({ title: '王冠落地', text: '這一季，舊王倒台，新王登基，鎮上人心惶惶。' }); const c2 = await LEGACY.chapter(w, L, 1, '夏季'); restore(); out.aiChapter = Memory.render(c2.title.k, c2.title.p) === '王冠落地';
      // 換季自動寫
      const n0 = L.chapters.length; const _ad = w._absDay; let D = 31; w._absDay = () => D; L.lastSeason = 1; L.lastDay = null; await LEGACY.daily(w); out.autoChapter = L.chapters.length === n0 + 1;
      // 名人與傳說
      const hero = w.election.currentMayor(w) || all[1]; LEGACY.register(w, L); out.role = !w.election.currentMayor(w) || !!L.roles[hero.name]; /* 還沒有首長的鎮就不檢查 */
      if (!L.roles[hero.name]) L.roles[hero.name] = { role: '前首長', fam: LEGACY.surname(hero) };
      w.stockpile.add('silver', 500, w.tickCount, 't'); w.lifecycle.graveyard = w.lifecycle.graveyard || []; L.lastGrave = w.lifecycle.graveyard.length; w.lifecycle.graveyard.push({ name: hero.name, age: 70 });
      D++; L.lastDay = null; await LEGACY.daily(w); out.legend = L.legends.some(l => l.name === hero.name) && logHas(/傳說|legend/) && (w.proposals.landmarks || []).some(x => x.icon === '🗽');
      // 家族:讓兩家各三人
      const fA = all.slice(2, 5), fB = all.slice(5, 8); const sa = LEGACY.surname(fA[0]); let sb = LEGACY.surname(fB[0]); if (sb === sa) sb = sa === '林' ? '王' : '林';
      for (const a of fA) a.name = sa + a.name.slice(1); for (const b of fB) b.name = sb + b.name.slice(1);
      LEGACY.families(w, L); out.motto = !!L.families[sa]?.motto && !!L.families[sb]?.motto && logHas(/家訓|family motto/);
      out.brief = JSON.stringify(CE._agentBrief(w, fA[0], null));
      // 世仇
      for (const a of fA) for (const b of fB) { a.relationships.getOrCreate(b.agentId, b.name).affinity = -50; const rr = a.relationships.relationships[b.agentId]; rr.status = null; }
      LEGACY.families(w, L); out.feud = L.feuds.some(f => !f.ended) && logHas(/世仇|sworn enemies/);
      out.feudBrief = JSON.stringify(CE._agentBrief(w, fA[0], null));
      // 聯姻化解
      fA[0].relationships.getOrCreate(fB[0].agentId, fB[0].name).status = 'married'; LEGACY.families(w, L); out.ended = L.feuds.every(f => f.ended) && logHas(/化解|ended a long-standing/);
      out.town = CE._townBrief(w);
      w._absDay = _ad;
      app.state = w.getState(); const box = document.createElement('div'); document.body.appendChild(box); app._ppTab = 'town'; app.renderProposals(box); out.ui = box.querySelector('.pp-legacy')?.innerText || ''; box.remove();
      out.famLabel = LEGACY.view(w).families.map(f => f.name).join(' / ');
      out.nameEn2 = (typeof I18N !== 'undefined') ? I18N.localizeNames(all[0].name, true) : '';
      const d = JSON.parse(JSON.stringify(w.serialize())); const w2 = new World(); w2.loadSave(d); out.rt = w2.legacy?.chapters?.length === L.chapters.length && w2.legacy.legends.length === L.legends.length; w2.reset(); out.reset = !w2.legacy;
      return out;
    });
    ok(r.chapter && r.aiChapter, '史官把一季的大事寫成鎮史（規則或 AI）', r);
    ok(r.autoChapter, '換季時自動寫下新的一章', r);
    ok(r.role && r.legend, '名人過世成為傳說，公庫寬裕就立像', r);
    ok(r.motto, '三人以上的家族立下家訓', r);
    ok(/家訓|family motto/.test(r.brief), 'AI 知道自己的家族與家訓', r.brief.slice(-200));
    ok(r.feud && /世仇|feud/.test(r.feudBrief), '兩家互相看不順眼久了成為世仇，AI 知道', r.feudBrief.slice(-160));
    ok(r.ended, '兩家聯姻化解世仇', r);
    ok(/傳說|legends/i.test(r.town), 'AI 知道鎮上的傳說人物', r.town.slice(-120));
    ok(/📚/.test(r.ui), '鎮況頁有鎮史', r.ui.slice(0, 200));
    ok(lang === 'zh' ? /家/.test(r.famLabel) : (!/[一-鿿]家/.test(r.famLabel) && /family/.test(r.famLabel)), '家族名依語言顯示', r.famLabel);
    ok(lang === 'zh' || (r.nameEn === r.nameEn2 && !/[一-鿿]/.test(r.nameEn2)), '英文人名翻譯沒被弄壞', { a: r.nameEn, b: r.nameEn2 });
    ok(r.rt && r.reset, '鎮史存讀檔保留、新城鎮重來', r);
    ok(!errs.length, lang + ' 沒有頁面錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
