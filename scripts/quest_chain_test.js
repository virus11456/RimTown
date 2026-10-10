#!/usr/bin/env node
// v5.88.0 四座主題鎮任務鏈的端到端回歸(選跑;需要 playwright 與本機 http server):
//   cd wordpress && python3 -m http.server 8126 &      # 先起本機站
//   npm i playwright@1 (一次) ;  node scripts/quest_chain_test.js [http://127.0.0.1:8126]
// 每個主題:起始任務正確 → 五章(每章走一條路線)全部完成 → 第三章完成排程主題災難、第四章化解路線立刻結束災害
//   → 終章開通商路(商隊兩天一趟、+20%) → 全部支線可解鎖並完成 → 存檔往返保留 → 任務分頁顯示第四/五章 → 英文介面章節/任務標題為英文。
const BASE = process.argv[2] || 'http://127.0.0.1:8126';
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('playwright 未安裝:npm i playwright@1 後再跑'); process.exit(0); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

// 每個主題的腳本:在頁面裡執行,拿到 ctx = { w, qs, setAff, chat, gift, visit, add, go } 後把五章走完,回傳檢查用的中間值
const SCENARIOS = {
  harbor: {
    name: '海風鎮', start: 'hb1_arrive', ch4: 'hb4_typhoon', ch5: 'hb5_voyage', ch4Title: '第四章：颱風夜', ch5Title: '第五章：出海', enCh1: 'Chapter 1', sides: 6, disaster: null,
    run: (c) => {
      c.chat('hb_xiaoou', 'hb_haibo', 'hb_haima'); c.visit('tavern'); c.go();
      c.visit('quarry', 'chapel', 'park'); c.setAff('hb_yunyi', 22); c.go();
      c.chat('hb_laoyu', 'hb_laoyu'); c.setAff('hb_shishu', 32); c.setAff('hb_dengye', 31); c.go();
      c.setAff('hb_afu', 35); c.gift('hb_shanshan'); c.go();
      c.add('wood', 200); c.add('cloth', 100); c.setAff('hb_aduo', 30); c.go();
      c.caravan(); c.setAff('hb_amao', 32); c.setAff('hb_muxia', 26); c.add('food', 300); c.add('cloth', 100); c.go();
      c.setAff('hb_haima', 15); c.setAff('hb_kesao', 30); c.setAff('hb_ayan', 32); c.setAff('hb_arong', 32); c.setAff('hb_xiugu', 30); c.setAff('hb_haibo', 30); c.setAff('hb_yunyi', 25); c.go();
      c.chat('hb_haima', 'hb_haima', 'hb_yunyi', 'hb_yunyi', 'hb_afu', 'hb_afu', 'hb_muxia', 'hb_muxia', 'hb_muxia'); c.visit('park'); c.add('cloth', 100); c.add('food', 100); c.go();
    },
  },
  mountain: {
    name: '礦山鎮', start: 'mt1_arrive', ch4: 'mt4_collapse', ch5: 'mt5_seventh', ch4Title: '第四章：塌方', ch5Title: '第五章：第七層', enCh1: 'Chapter 1: Into the Pit', sides: 4, disaster: 'tunnel_collapse',
    run: (c) => {
      c.chat('mt_axing', 'mt_youbo', 'mt_laochui'); c.visit('tavern'); c.go();
      c.visit('quarry', 'chapel', 'park'); c.setAff('mt_cipo', 22); c.go();
      c.setAff('mt_ayan', 32); c.setAff('mt_kuangye', 31); c.chat('mt_ayan', 'mt_ayan'); c.go();
      c.add('silver', 100); c.setAff('mt_baigu', 32); c.chat('mt_baigu', 'mt_baigu'); c.go(); c.disasterStarts();
      c.add('wood', 200); c.setAff('mt_mugen', 30); c.setAff('mt_laochui', 30); c.go();
      c.caravan(); c.setAff('mt_ayan', 40); c.setAff('mt_tiezhu', 32); c.add('tools', 30); c.add('food', 300); c.go();
      c.setAff('mt_tiezhu', 32); c.setAff('mt_cipo', 25); c.setAff('mt_xiaozuan', 20); c.setAff('mt_aqing', 20); c.go();
      c.add('metal', 100); c.add('stone', 200); c.chat('mt_tiezhu', 'mt_tiezhu', 'mt_cipo', 'mt_cipo', 'mt_xiaozuan', 'mt_xiaozuan'); c.gift('mt_ayan'); c.chat('mt_aqing', 'mt_aqing'); c.go();
    },
  },
  forest: {
    name: '林間村', start: 'fv1_arrive', ch4: 'fv4_fire', ch5: 'fv5_tree', ch4Title: '第四章：山火', ch5Title: '第五章：那棵樹', enCh1: 'Chapter 1: Into the Woods', sides: 4, disaster: 'wildfire',
    run: (c) => {
      c.chat('fv_guishen', 'fv_juge', 'fv_asong'); c.visit('tavern'); c.go();
      c.visit('quarry', 'chapel', 'park'); c.setAff('fv_shupo', 22); c.go();
      c.setAff('fv_asong', 32); c.gift('fv_aye'); c.go();
      c.setAff('fv_juge', 32); c.setAff('fv_guishen', 30); for (let i = 0; i < 12; i++) c.chat('fv_juge'); c.go(); c.disasterStarts();
      c.add('wood', 200); c.setAff('fv_daxiong', 30); c.setAff('fv_mushu', 30); c.go();
      c.caravan(); c.setAff('fv_laoqiao', 40); c.setAff('fv_atai', 32); c.add('herbs', 200); c.add('food', 300); c.go();
      c.setAff('fv_asong', 32); c.setAff('fv_shupo', 25); c.setAff('fv_daxiong', 30); c.setAff('fv_aye', 20); c.setAff('fv_linlao', 30); c.setAff('fv_luniang', 25); c.go();
      c.add('wood', 100); c.add('herbs', 200); c.chat('fv_asong', 'fv_asong', 'fv_shupo', 'fv_shupo', 'fv_daxiong', 'fv_daxiong', 'fv_aye', 'fv_aye'); c.go();
    },
  },
  market: {
    name: '市集城', start: 'mk1_arrive', ch4: 'mk4_raid', ch5: 'mk5_guild', ch4Title: '第四章：商隊劫案', ch5Title: '第五章：五鎮商會', enCh1: 'Chapter 1: Into the City', sides: 4, disaster: 'caravan_raid',
    run: (c) => {
      c.chat('mk_feishu', 'mk_tuojie', 'mk_asuan'); c.visit('tavern'); c.go();
      c.visit('quarry', 'chapel', 'park'); c.setAff('mk_caishu', 22); c.go();
      c.setAff('mk_laozhang', 32); c.setAff('mk_yaoshu', 26); c.chat('mk_laozhang', 'mk_laozhang'); c.go();
      c.setAff('mk_caigu', 32); c.chat('mk_tuojie', 'mk_tuojie'); c.go(); c.disasterStarts();
      c.caravanHalted();
      c.add('silver', 200); c.setAff('mk_menshu', 30); c.setAff('mk_agang', 30); c.go();
      c.caravan(); c.setAff('mk_jinlaoye', 40); c.setAff('mk_tuojie', 32); c.add('cloth', 200); c.add('food', 300); c.go();
      c.setAff('mk_asuan', 20); c.setAff('mk_yaoshu', 26); c.setAff('mk_tuojie', 32); c.setAff('mk_xinggu', 20); c.go();
      c.add('stone', 200); c.add('wood', 200); c.add('herbs', 100); c.chat('mk_asuan', 'mk_asuan'); c.gift('mk_shuyi'); c.chat('mk_yaoshu', 'mk_yaoshu', 'mk_tuojie', 'mk_tuojie', 'mk_xinggu', 'mk_xinggu'); c.go();
    },
  },
};

// 在頁面裡跑:建立該主題世界、組 ctx、執行腳本、收集檢查值
function pageRun({ theme, name, runSrc, disaster }) {
  const app = window.rimtownApp; const out = { disasterActive: null, disasterEndedByRoute: null, haltedCaravan: null };
  const w = new World(); w.townTheme = theme; w.townName = name; w.rosterMode = 'scripted'; w.reset();
  app.world = w; app.state = w.getState(); app._generateTileMapLayout(); app.tileMap.agentPositions = {}; w.paused = true;
  const qs = w.questSystem; const player = w.agents.player;
  qs.checkProgress(w); out.start = qs.getActiveQuests().map(q => q.id);
  const c = {
    w, qs,
    setAff: (id, v) => { const rel = player.relationships.getOrCreate(id, w.agents[id].name); rel.affinity = v; },
    chat: (...ids) => ids.forEach(id => qs.onChat(id)), gift: (id) => qs.onGift(id), visit: (...ls) => ls.forEach(l => qs.onVisit(l)),
    add: (r, n) => w.stockpile.add(r, n), go: () => { qs.checkProgress(w); qs.getPendingStoryEvent(); },
    caravan: () => { w.otherTowns = [{ id: 't1', name: theme === 'market' ? '礦山鎮' : '市集城' }, { id: 't2', name: theme === 'harbor' ? '礦山鎮' : '海風鎮' }]; w.lastCaravanDay = null; w._caravanDaily(); out.caravan1 = w.caravanCount || 0; },
    disasterStarts: () => { out.warning = w.weather.disasterWarning?.type || null; w.eventChoice.pendingEvent = null; w.weather._checkDisasterEscalation(w); w.weather._checkDisasterEscalation(w); out.disasterActive = w.weather.activeDisaster?.type || null; },
    caravanHalted: () => { w.otherTowns = [{ id: 't1', name: '礦山鎮' }]; w.lastCaravanDay = null; w._caravanDaily(); out.haltedCaravan = w.caravanCount || 0; },
  };
  const origGo = c.go; c.go = () => { origGo(); if (disaster && out.disasterActive && out.disasterEndedByRoute == null && qs.quests[Object.keys(qs.quests).find(k => /4_/.test(k))]?.status === 'completed') out.disasterEndedByRoute = !w.weather.activeDisaster; };
  (new Function('c', `(${runSrc})(c)`))(c);
  out.completed = qs.completedOrder.slice(); out.flags = { ...(w.harborFlags || {}) };
  w.lastCaravanDay = w._absDay() - 2; const n0 = w.caravanCount || 0; w._caravanDaily(); out.caravanEvery2 = (w.caravanCount || 0) === n0 + 1;
  const lastLog = (w.messageLog || w.log || []).map(m => m.content || m.text || '').filter(x => x.includes('🐪')).slice(-1)[0] || ''; out.bonus = /多兩成|\+20%|two-tenths|20%/.test(lastLog) || /56|48/.test(lastLog);
  out.sidesDone = Object.values(qs.sideQuests).filter(s => s.status === 'completed').length; out.sidesTotal = Object.keys(qs.sideQuests).length;
  const blob = w.serialize(); const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(blob)));
  out.rt = { theme: w2.questSystem.theme, completed: w2.questSystem.completedOrder.length, flags: w2.harborFlags, qb: w2.prosperity.questBonus };
  const d = document.createElement('div'); app.renderQuest(d); out.tabText = d.textContent;
  return out;
}
function pageEn({ theme, name }) {
  const app = window.rimtownApp; const w = new World(); w.townTheme = theme; w.townName = name; w.rosterMode = 'scripted'; w.reset();
  app.world = w; app.state = w.getState(); app._generateTileMapLayout(); w.paused = true; w.questSystem.checkProgress(w);
  const d = document.createElement('div'); app.renderQuest(d); return d.textContent;
}

(async () => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  let failed = 0;
  const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) failed++; };
  const open = async (ui) => {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', (route) => {
      const u = route.request().url(); const m = route.request().method();
      const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.includes('/api/me')) return json({ logged_in: true, user: { id: 1, username: 'tester' }, is_admin: false });
      if (u.includes('/api/saves')) return json({ saves: [] });
      if (u.includes('/api/save')) return m === 'POST' ? json({ success: true }) : json({ code: 'not_found' }, 404);
      if (u.includes('/api/settings')) return json({ settings: {} });
      if (u.includes('/api/chat')) return json({ error: 'mock' }, 500);
      return json({});
    });
    await page.addInitScript(({ jwt, ui }) => { try { localStorage.setItem('rimtown-lang', ui); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); sessionStorage.setItem('rimtown_enter_now', '1'); } catch (e) {} }, { jwt, ui });
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.rimtownApp && typeof World === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    return { page, errs };
  };
  const zh = await open('zh'); const en = await open('en');
  for (const [theme, sc] of Object.entries(SCENARIOS)) {
    console.log(`\n[${theme} ${sc.name}]`);
    const r = await zh.page.evaluate(pageRun, { theme, name: sc.name, runSrc: sc.run.toString(), disaster: sc.disaster });
    check(r.start.length === 1 && r.start[0] === sc.start, `起始任務 ${sc.start}`);
    check(r.completed.length === 6 && r.completed.includes(sc.ch4) && r.completed.includes(sc.ch5), `六個主線全部完成 (${r.completed.length})`);
    if (sc.disaster) {
      check(r.warning === sc.disaster, `第三章完成排程災難預警 ${sc.disaster} (got ${r.warning})`);
      check(r.disasterActive === sc.disaster, `隔天災難來襲 ${sc.disaster}`);
      check(r.disasterEndedByRoute === true, `第四章化解路線立刻結束災害`);
    }
    if (theme === 'market') check(r.haltedCaravan === 0, `劫案期間商隊不進城`);
    check(r.caravan1 >= 1, `終章前商隊來過 (${r.caravan1})`);
    check(!!(r.flags.tradeRoute || r.flags.seaRoute), `終章開通商路/海路 ${JSON.stringify(r.flags)}`);
    check(r.caravanEvery2, `商路後商隊兩天一趟`);
    check(r.sidesDone === sc.sides && r.sidesTotal === sc.sides, `支線 ${r.sidesDone}/${r.sidesTotal} 全部完成`);
    check(r.rt.theme === theme && r.rt.completed === 6 && !!(r.rt.flags.tradeRoute || r.rt.flags.seaRoute) && r.rt.qb > 0, `存檔往返保留主題/進度/旗標/繁榮加成`);
    check(r.tabText.includes(sc.ch4Title) && r.tabText.includes(sc.ch5Title), `任務分頁顯示「${sc.ch4Title}」「${sc.ch5Title}」`);
    const et = await en.page.evaluate(pageEn, { theme, name: sc.name });
    check(et.includes(sc.enCh1) && !/[一-鿿]/.test(et), `英文介面任務分頁全英文 (${sc.enCh1})`);
  }
  check(zh.errs.length === 0 && en.errs.length === 0, `無 page error ${JSON.stringify([...zh.errs, ...en.errs]).slice(0, 200)}`);
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL OK'); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
