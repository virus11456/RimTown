// 連貫測試：登記表裡的每一種資源、職位、科技、建築、工廠配方、作物、產業等級、店種，都真的做得出來、接得上。
// 每一項都用遊戲自己的函式實際做一次（不是只看有沒有登記）：
//   1) 登記表彼此對得上：科技的前置與解鎖、材料與產物都是存在的資源、職位有工作地點與產出
//   2) 每個效果（科技或建築給的加成）程式裡真的有人去讀
//   3) 每種建築蓋得起來，蓋完效果生效
//   4) 每間工廠蓋得起來，每個配方做得出東西、進得了倉
//   5) 每種作物種得下去、長得大、收得成
//   6) 每個產業每一級都有產出
//   7) 每個職位鎮上都有人做，該有產出的都有產出
//   8) 每種店都開得起來
//   9) 每種資源至少有一個來源、至少有一個去處
// 用法：BASE=http://localhost:8126/ node scripts/coherence_test.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/'; const DIR = path.join(__dirname, '..', 'chrome-extension');
let pass = 0, fail = 0; const ok = (c, m, d) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (d !== undefined ? ' → ' + JSON.stringify(d).slice(0, 900) : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ').replace(/http:\/\/localhost:\d+\//g, '')));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt });
  await page.goto(BASE + 'town.html', { timeout: 120000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 });

  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._gameAlert = () => {}; app._showCornerNotice = () => {}; app._showSeasonRecap = () => {};
    const out = {}; const w = app.world; const STOCK = Object.keys(DEFAULT_STOCKPILE);
    const fresh = (size, seed) => { w.reset(); w.observerMode = true; w.fullAgentMode = false; ORIGIN.seed(w, size, { seed }); };
    const rich = (n) => { for (const k of STOCK) w.stockpile.resources[k] = n; };
    const allTech = () => { for (const p of Object.values(w.research.projects)) { p.status = 'complete'; p.progress = p.cost; } w.research.refreshLocks?.(); w.buildings.recomputeEffects(w); };
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);

    // ---------- 1) 登記表彼此對得上 ----------
    { const T = RESEARCH_TREE, B = BUILDING_TEMPLATES, F = FACTORIES, bad = { pre: [], unlock: [], era: [], path: [], cost: [], recipe: [], indRes: [], crop: [], jobRes: [], jobWp: [], jobNoProd: [] };
      const PK = TECH.PATH_KEYS();
      for (const [k, d] of Object.entries(T)) { for (const p of d.prerequisites || []) if (!T[p]) bad.pre.push(k + '→' + p); for (const u of d.unlocks || []) { const fk = String(u).startsWith('factory:') ? u.slice(8) : null; if (fk ? !F[fk] : !B[u]) bad.unlock.push(k + '→' + u); } if (!RESEARCH_ERAS[d.era]) bad.era.push(k); for (const p of (d.path ? String(d.path).split(',') : [])) if (!PK.includes(p)) bad.path.push(k + ':' + p); if (!(d.cost > 0)) bad.cost.push(k); }
      // 沒有循環：每一項都能從沒有前置的項目一路走到
      const reach = new Set(); let grew = true; while (grew) { grew = false; for (const [k, d] of Object.entries(T)) if (!reach.has(k) && (d.prerequisites || []).every(p => reach.has(p))) { reach.add(k); grew = true; } }
      bad.unreach = Object.keys(T).filter(k => !reach.has(k));
      for (const [k, d] of Object.entries(B)) for (const c of Object.keys(d.costs || {})) if (!STOCK.includes(c)) bad.cost.push('建築 ' + k + ':' + c);
      for (const [k, d] of Object.entries(F)) { for (const c of Object.keys(d.cost || {})) if (!STOCK.includes(c)) bad.cost.push('工廠 ' + k + ':' + c); for (const rc of d.recipes || []) for (const c of [...Object.keys(rc.input || {}), ...Object.keys(rc.output || {})]) if (!STOCK.includes(c)) bad.recipe.push(k + '/' + rc.id + ':' + c); }
      for (const [k, d] of Object.entries(INDUSTRIES)) for (const L of d.levels || []) for (const c of [...Object.keys(L.cost || {}), ...Object.keys(L.output || {})]) if (!STOCK.includes(c)) bad.indRes.push(k + ' Lv' + L.lv + ':' + c);
      for (const [j, d] of Object.entries(JOB_PRODUCTION)) for (const c of [...Object.keys(d.inputs || {}), ...Object.keys(d.outputs || {})]) if (!STOCK.includes(c)) bad.jobRes.push(j + ':' + c);
      const locIds = new Set([...CORE_LOCATIONS, ...WORK_LOCATIONS, ...SOCIAL_LOCATIONS].map(x => x[0]));
      for (const [j, d] of Object.entries(JOB_DEFINITIONS)) { if (!locIds.has(d.workplace)) bad.jobWp.push(j + ':' + d.workplace); if (!JOB_PRODUCTION[j]) bad.jobNoProd.push(j); }
      // 研究完什麼都不會變的科技：沒有效果、不解鎖建築或工廠（哪裡用到留給外面掃程式碼判斷）
      { const unl = new Set(Object.values(RESEARCH_UNLOCKED_BY).flat()); for (const f of Object.values(F)) if (f.requires) unl.add(f.requires); for (const b of Object.values(B)) for (const q of [].concat(b.requires || [], b.research || [])) unl.add(q);
        out.techPlain = Object.entries(T).filter(([k, d]) => !Object.keys(d.effects || {}).length && !(d.unlocks || []).length && !unl.has(k)).map(([k, d]) => ({ k, name: d.name, era: d.era, next: Object.values(T).filter(x => (x.prerequisites || []).includes(k)).length })); }
      out.reg = { n: { tech: Object.keys(T).length, bld: Object.keys(B).length, fac: Object.keys(F).length, crops: Object.keys(CROPS).length, jobs: Object.keys(JOB_DEFINITIONS).length, res: STOCK.length, ind: Object.keys(INDUSTRIES).length, biz: Object.keys(BIZ.TYPES).length }, bad,
        fxKeys: [...new Set([...Object.values(T).flatMap(d => Object.keys(d.effects || {})), ...Object.values(B).flatMap(d => Object.keys(d.effects || {}))])] }; }

    // ---------- 3) 每種建築蓋得起來，蓋完效果生效 ----------
    { fresh(2, 11); allTech(); const res = {}; const BM = w.buildings; BM.completed = []; BM.projects = [];
      for (const key of Object.keys(BUILDING_TEMPLATES)) { rich(9000); const p = BM.startProject(key, w); if (!p) { res[key] = '動不了工'; continue; }
        let n = 0; while (BM.projects.some(x => x.buildingKey === key) && n++ < 80) BM.dailyConstruction(w);
        const done = BM.completed.find(x => x.buildingKey === key); if (!done) { res[key] = '蓋不完'; continue; }
        BM.recomputeEffects(w); const miss = Object.keys(BUILDING_TEMPLATES[key].effects || {}).filter(e => BM.activeEffects[e] === undefined); res[key] = miss.length ? '效果沒生效:' + miss.join(',') : 'ok'; }
      out.build = res; out.buildBad = Object.entries(res).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ':' + v); }

    // ---------- 4) 每間工廠蓋得起來，每個配方做得出東西 ----------
    { fresh(2, 12); allTech(); const P = w.processing; const pick0 = FLOW.pickRecipe; let force = {}; FLOW.pickRecipe = (W, def, f) => force[f.key] || null; const res = {};
      try { for (const [key, def] of Object.entries(FACTORIES)) { rich(9000); const b = P.buildFactory(key, w); if (!b?.ok) { res[key] = '蓋不了:' + (b?.error || ''); continue; }
          let n = 0; while (P.builtFactories[key].status !== 'active' && n++ < 40) P.dailyUpdate(w); if (P.builtFactories[key].status !== 'active') { res[key] = '蓋不完'; continue; }
          for (const rc of def.recipes) { rich(9000); force = { [key]: rc.id }; const f = P.builtFactories[key]; f.warehouse = {}; const outK = Object.keys(rc.output)[0]; const s0 = w.stockpile.get(outK);
            let m = 0; while (m++ < rc.time + 6 && !((f.warehouse[outK] || 0) > 0) && !(w.stockpile.get(outK) > s0)) P.dailyUpdate(w);
            const made = (f.warehouse[outK] || 0) > 0 || w.stockpile.get(outK) > s0; let stored = true; if ((f.warehouse[outK] || 0) >= 1) { const a0 = w.stockpile.get(outK); P.collectProduct(key, outK, Math.floor(f.warehouse[outK]), w); stored = w.stockpile.get(outK) > a0; }
            res[key + '/' + rc.id] = !made ? '做不出來（工人 ' + (f.workers || []).length + '）' : !stored ? '進不了倉' : 'ok'; } } } finally { FLOW.pickRecipe = pick0; }
      out.fac = res; out.facBad = Object.entries(res).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ':' + v); }

    // ---------- 5) 每種作物種得下去、長得大、收得成 ----------
    { fresh(2, 13); allTech(); rich(9000); const farm = w.farm; w.industry.industries.farming = { key: 'farming', level: 5, workers: [], dailyOutput: {} }; farm.dailyUpdate(w); const res = {}; const SEASONS = ['春季', '夏季', '秋季', '冬季'];
      for (const [key, c] of Object.entries(CROPS)) { rich(9000); const plot = farm.plots[0]; if (!plot) { res[key] = '沒有田'; continue; } Object.assign(plot, { state: 'empty', crop: null }); w.clock.season = c.seasons[0]; w.clock.day = 1;
        farm.tillPlot(plot.id); const pl = farm.plantCrop(plot.id, key, w); if (!pl?.ok) { res[key] = '種不下去:' + (pl?.error || ''); continue; }
        let n = 0; while (plot.state === 'growing' && n++ < c.growDays + 6) { farm.waterPlot(plot.id); farm.dailyUpdate(w); }
        if (plot.state !== 'ready') { res[key] = '長不大（' + plot.state + '，' + n + ' 天，一季 15 天、要長 ' + c.growDays + ' 天）'; continue; }
        const before = Object.assign({}, w.stockpile.resources); const h = farm.harvestPlot(plot.id, w); const gained = Object.keys(w.stockpile.resources).filter(k => (w.stockpile.resources[k] || 0) > (before[k] || 0) + 0.01);
        res[key] = !h?.ok ? '收不成:' + (h?.error || '') : !gained.length ? '收了沒進倉' : 'ok'; out['cropTo_' + key] = gained.join(','); }
      out.crop = res; out.cropBad = Object.entries(res).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ':' + v); }

    // ---------- 6) 每個產業每一級都有產出 ----------
    { fresh(2, 14); allTech(); const dm0 = FLOW.demandMult; FLOW.demandMult = () => 1; const res = {};
      try { for (const [key, def] of Object.entries(INDUSTRIES)) for (const L of def.levels) { w.industry.industries = { [key]: { key, level: L.lv, workers: [], dailyOutput: {} } }; for (const k of STOCK) w.stockpile.resources[k] = 100; w.industry.dailyUpdate(w);
          const miss = Object.keys(L.output || {}).filter(o => !(w.stockpile.get(o) > 100)); res[key + ' Lv' + L.lv] = miss.length ? '沒產出:' + miss.join(',') : 'ok'; } } finally { FLOW.demandMult = dm0; }
      // 升級走得通：材料夠時從第一級一路升到最高
      const up = {}; for (const key of Object.keys(INDUSTRIES)) { w.industry.industries = {}; w.industry.chooseIndustry(key, w); let lv = 1; for (let i = 0; i < 6; i++) { rich(9000); const u = w.industry.upgradeIndustry(key, w); if (u?.ok) lv = w.industry.industries[key].level; } up[key] = lv; }
      out.ind = res; out.indBad = Object.entries(res).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ':' + v); out.indUp = up; }

    // ---------- 6b) 產業落後時，升級會排在村民點子的前面（v11.0.1：以前固定權重 1，開了智能體的鎮幾乎沒人提，田、木板、磚、鋼、黃金全卡在一級） ----------
    { const P = w.proposals; const cand = () => { P.cooldown = {}; const cs = P._candidates(w, w._absDay()); const srt = cs.slice().sort((x, y) => y.weight - x.weight); const a = npcs()[0];
        return cs.filter(c => c.kind === 'industry_up').map(c => { const b = c.make(a); return { key: c.key, weight: c.weight, rank: srt.indexOf(c), desc: P._fill(b.dk, b.dp), raw: /\{\w+\}/.test(P._fill(b.dk, b.dp)) }; }); };
      const setInd = (lv) => { w.industry.industries = {}; for (const key of Object.keys(INDUSTRIES)) w.industry.industries[key] = { key, level: lv, workers: [], dailyOutput: {} }; };
      // 城市、第五時代、四個產業都還在一級、材料夠
      fresh(2, 16); allTech(); rich(3000); setInd(1); const city = cand();
      // 同一個城市，產業已經跟上（四級）：不再搶前面
      setInd(4); const kept = cand();
      // 滿級：沒有這個點子
      setInd(5); const maxed = cand();
      // 剛起步的村莊：照舊
      fresh(0, 17); rich(3000); setInd(1); const vil = cand();
      out.indProp = { city, kept, maxed, vil, era: [w.research.currentEra?.()] }; }

    // ---------- 8) 每種店都開得起來 ----------
    { fresh(2, 15); const res = {}; const A = npcs().filter(a => (a.age ?? 30) >= 20 && a.job?.key !== 'mayor'); const used = new Set(); const S = BIZ.S(w); const day = w._absDay();
      const tr = (a) => a.personality?.traits || (a.personality.traits = []);
      for (const k of Object.keys(BIZ.TYPES)) { // 會想創業的人：勤勞（或有創意，有創意的人開的一定是畫坊）
        const cands = A.filter(x => !used.has(x) && !BIZ.shopOf(w, x) && (k === 'studio' ? true : !tr(x).includes('creative') && BIZ.typeFor(x) === k)).slice(0, 4); if (!cands.length) { res[k] = '鎮上沒有人會開這種店'; continue; }
        let last = ''; for (const a of cands) { used.add(a); if (k === 'studio') { if (!tr(a).includes('creative')) tr(a).push('creative'); } else if (!tr(a).includes('hardworking')) tr(a).push('hardworking');
          if (BIZ.typeFor(a) !== k) { last = '這個人開的會是 ' + BIZ.typeFor(a); continue; }
          if (WALLET.get(w, a) < 300) WALLET.add(w, a, 300);
          let shop = null; try { const R = BIZ.startTry(w, a); shop = R?.shop || null; if (!shop) last = '開不起來:' + (R?.why || ''); } catch (e) { last = '錯誤:' + e.message; }
          if (shop) { last = (shop.type || BIZ.typeOf?.(shop)) === k ? 'ok' : '開成別種:' + shop.type; break; } }
        res[k] = last; }
      out.biz = res; out.bizBad = Object.entries(res).filter(([, v]) => v !== 'ok').map(([k, v]) => k + ':' + v); out.bizView = (BIZ.view(w)?.shops || []).length; }

    // ---------- 2) 7) 9) 實際跑幾天：效果有人讀、每個職位有人做而且有產出、每種資源有來源也有去處 ----------
    { fresh(2, 16); allTech(); const sp = w.stockpile; for (const k of STOCK) if (k !== 'silver' && k !== 'food') sp.resources[k] = Math.max(sp.resources[k] || 0, 60); sp.resources.silver = Math.max(sp.resources.silver, 3000);
      const flows = {}; const Fl = (k) => flows[k] || (flows[k] = { in: 0, out: 0, inBy: {}, outBy: {} }); const add0 = sp.add.bind(sp), con0 = sp.consume.bind(sp);
      sp.add = function (k, n, t, reason, src) { const f = Fl(k); f.in += +n || 0; const why = String(reason || src || '?').slice(0, 20); f.inBy[why] = (f.inBy[why] || 0) + (+n || 0); return add0(k, n, t, reason, src); };
      sp.consume = function (k, n, t, reason, src) { const o = con0(k, n, t, reason, src); if (o) { const f = Fl(k); f.out += +n || 0; const why = String(reason || src || '?').slice(0, 20); f.outBy[why] = (f.outBy[why] || 0) + (+n || 0); } return o; };
      const fxRead = {}; const BM = w.buildings; const ge0 = BM.getEffect.bind(BM); BM.getEffect = function (k, d) { fxRead[k] = 1; return ge0(k, d); };
      const jobs = {};
      for (let i = 0; i < 12; i++) { const d0 = w._absDay(); for (let k = 0; k < 400 && w._absDay() === d0; k++) { w.paused = false; w.tick(); } w.paused = true; for (const a of npcs()) { const k = a.job?.key || '(無)'; jobs[k] = (jobs[k] || 0) + 1; } await new Promise(r => setTimeout(r, 5)); }
      sp.add = add0; sp.consume = con0; BM.getEffect = ge0;
      out.fxRead = Object.keys(fxRead); out.jobs = jobs; out.flows = Object.fromEntries(Object.entries(flows).map(([k, f]) => [k, { in: Math.round(f.in * 10) / 10, out: Math.round(f.out * 10) / 10 }]));
      out.jobOut = Object.fromEntries(Object.entries(JOB_PRODUCTION).map(([j, d]) => [j, Object.keys(d.outputs || {}).map(o => o + ':' + Math.round(flows[o]?.in || 0)).join(',')]));
      // 結構上的來源與去處（登記表裡寫明的）
      const src = {}, sink = {}; const S1 = (m, k, v) => (m[k] = m[k] || []).push(v);
      for (const [j, d] of Object.entries(JOB_PRODUCTION)) { for (const o of Object.keys(d.outputs || {})) S1(src, o, '職業 ' + j); for (const i of Object.keys(d.inputs || {})) S1(sink, i, '職業 ' + j); }
      for (const [k, d] of Object.entries(INDUSTRIES)) for (const L of d.levels) { for (const o of Object.keys(L.output || {})) S1(src, o, '產業 ' + k + ' Lv' + L.lv); for (const c of Object.keys(L.cost || {})) S1(sink, c, '產業升級 ' + k); }
      for (const [k, d] of Object.entries(FACTORIES)) { for (const c of Object.keys(d.cost || {})) S1(sink, c, '蓋工廠 ' + k); for (const rc of d.recipes) { for (const o of Object.keys(rc.output)) S1(src, o, '工廠 ' + k); for (const i of Object.keys(rc.input)) S1(sink, i, '工廠 ' + k); } }
      for (const [k, d] of Object.entries(BUILDING_TEMPLATES)) for (const c of Object.keys(d.costs || {})) S1(sink, c, '蓋 ' + k);
      for (const k of Object.keys(CROPS)) S1(src, k, '農田');
      for (const g of Object.values(NATURE_GATHERING)) for (const o of Object.keys(g)) S1(src, o, '野外採集');
      for (const [base, list] of Object.entries(FLOW.SUB || {})) for (const [sub] of list) S1(sink, sub, '代替' + base + '使用');
      out.srcSink = Object.fromEntries(STOCK.map(k => [k, { src: (src[k] || []).length, sink: (sink[k] || []).length, in: Math.round(flows[k]?.in || 0), out: Math.round(flows[k]?.out || 0), inBy: Object.keys(flows[k]?.inBy || {}).slice(0, 3).join('、'), outBy: Object.keys(flows[k]?.outBy || {}).slice(0, 3).join('、'), firstSrc: (src[k] || [])[0] || '', firstSink: (sink[k] || [])[0] || '' }]));
      out.noSrc = STOCK.filter(k => !(src[k] || []).length && !(flows[k]?.in > 0)); out.noSink = STOCK.filter(k => !(sink[k] || []).length && !(flows[k]?.out > 0)); }

    // ---------- 資源的名字：三個取名字的地方都認得全部資源 ----------
    { out.names = Object.fromEntries(STOCK.map(k => [k, (typeof RESOURCE_NAMES_ZH !== 'undefined' && RESOURCE_NAMES_ZH[k]) || '']));
      out.noName = STOCK.filter(k => !out.names[k] || app._resLabel(k) === k || app._resName(k) === k); }
    return out;
  });

  // ---------- 判定 ----------
  console.log('— 登記表');
  const srcAll = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !/^i18n-en|^three/.test(f)).map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
  const n = r.reg.n; console.log(`  （${n.res} 種資源、${n.jobs} 種職位、${n.tech} 項科技、${n.bld} 種建築、${n.fac} 間工廠、${n.crops} 種作物、${n.ind} 個產業、${n.biz} 種店）`);
  const b = r.reg.bad;
  ok(!b.pre.length && !b.unreach.length && !b.era.length && !b.path.length, '科技：前置都存在、沒有循環、時代與路線都是認得的', { pre: b.pre, unreach: b.unreach, era: b.era, path: b.path });
  ok(!b.unlock.length, '科技解鎖的建築與工廠都真的存在', b.unlock);
  { const used = (k) => (srcAll.match(new RegExp(`['"\`]${k}['"\`]`, 'g')) || []).length; const inert = r.techPlain.filter(x => !used(x.k));
    console.log(`    （${r.techPlain.length} 項科技沒有登記效果也不解鎖建築，其中 ${r.techPlain.length - inert.length} 項由別的系統讀取）`);
    ok(inert.length === 0, '每項科技研究完都有東西會變（效果、解鎖，或有系統讀它）', inert.map(x => `${x.k}（${x.name}，時代 ${x.era}，後續科技 ${x.next} 項）`)); }
  ok(!b.cost.length && !b.recipe.length && !b.indRes.length && !b.jobRes.length, '建築、工廠、配方、產業、職位用到的材料與產物都是倉庫裡有的資源', { cost: b.cost, recipe: b.recipe, ind: b.indRes, job: b.jobRes });
  ok(!b.jobWp.length && !b.jobNoProd.length, '每個職位都有工作地點、都登記了產出', { wp: b.jobWp, noProd: b.jobNoProd });

  console.log('— 效果');
  // 效果的讀法：程式裡要有 getEffect('鍵')；跑的那幾天有讀到也算
  const fxDead = r.reg.fxKeys.filter(k => !new RegExp(`getEffect\\??\\.?\\(\\s*['"]${k}['"]`).test(srcAll) && !r.fxRead.includes(k));
  ok(fxDead.length === 0, `科技與建築給的 ${r.reg.fxKeys.length} 種效果，程式裡每一種都有人讀`, fxDead);

  console.log('— 建築');
  ok(r.buildBad.length === 0, `${n.bld} 種建築都動得了工、蓋得完、效果生效`, r.buildBad);
  console.log('— 工廠');
  ok(r.facBad.length === 0, `${n.fac} 間工廠都蓋得起來，${Object.keys(r.fac).filter(k => k.includes('/')).length} 個配方都做得出東西、進得了倉`, r.facBad);
  console.log('— 作物');
  ok(r.cropBad.length === 0, `${n.crops} 種作物都種得下去、長得大、收得成`, r.cropBad);
  console.log('— 產業');
  ok(r.indBad.length === 0, `${n.ind} 個產業的每一級都有產出`, r.indBad);
  ok(Object.values(r.indUp).every(v => v === 5), '材料夠的時候，每個產業都能從第一級升到第五級', r.indUp);
  { const q = r.indProp;
    ok(q.city.length === n.ind && q.city.every(c => c.weight >= 4 && c.rank < 6), '城市的產業還停在一級時，四個升級都排進村民點子的前六名（智能體看得到）', q.city.map(c => [c.key, c.weight, c.rank]));
    ok(q.city.every(c => !c.raw && c.desc.length > 20) && q.city.some(c => /Lv1|不夠用|沒有原料|缺/.test(c.desc)), '升級的點子寫得出理由，沒有漏填的欄位', q.city.map(c => c.desc));
    ok(q.kept.length === n.ind && q.kept.every(c => c.weight <= 2.5), '產業跟上了就不再搶前面', q.kept.map(c => [c.key, c.weight]));
    ok(q.maxed.length === 0, '升到頂就不再提', q.maxed);
    ok(q.vil.length === n.ind && q.vil.every(c => c.weight <= 2), '剛起步的村莊照舊，不會一開局就急著升級', q.vil.map(c => [c.key, c.weight])); }
  console.log('— 職位');
  const noOne = Object.keys(r.jobOut).filter(j => !r.jobs[j]);
  ok(noOne.length === 0, `${n.jobs} 種職位鎮上都有人做`, noOne);
  const noOut = Object.entries(r.jobOut).filter(([j, s]) => s && s.split(',').every(x => +x.split(':')[1] <= 0)).map(([j, s]) => j + '(' + s + ')');
  ok(noOut.length === 0, '登記了產出的職位，跑 12 天都真的有東西進倉', noOut);
  console.log('— 店');
  ok(r.bizBad.length === 0, `${n.biz} 種店都開得起來`, r.bizBad);
  console.log('— 資源');
  // 登記表和這 12 天都沒看到的，再看程式裡有沒有直接進倉／出倉的地方（例如靠海才曬得出鹽、鎮上有錢人才添購精裝家具）
  const srcCode = (k) => new RegExp(`\\.add\\(\\s*['"]${k}['"]`).test(srcAll), sinkCode = (k) => new RegExp(`(\\.consume\\(|enjoy\\(\\s*w,|eat\\(\\s*w,)\\s*['"]${k}['"]`).test(srcAll);
  const noSrc = r.noSrc.filter(k => !srcCode(k)), noSink = r.noSink.filter(k => !sinkCode(k));
  ok(noSrc.length === 0, `${n.res} 種資源都至少有一個來源`, noSrc);
  ok(noSink.length === 0, `${n.res} 種資源都至少有一個去處`, noSink);
  const dict = fs.readFileSync(path.join(DIR, 'i18n-en.js'), 'utf8'); const noEn = Object.entries(r.names).filter(([, zh]) => zh && !dict.includes(`'${zh}':`)).map(([k, zh]) => k + ':' + zh);
  ok(r.noName.length === 0 && noEn.length === 0, '每種資源在各處都有名字（中文、英文）', { noName: r.noName, noEn });
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(r, null, 1));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); process.exit(fail ? 1 : 0);
})();
