// v8.3.0 成就大改版
// 分類（城鎮、提案與政治、人情世故、愛情與人生、經濟、信仰與文化、科技路線、神的工具、特殊）、舊時代紀念（只顯示已解鎖、不算總數、觀察者不再頒）、
// 計數只算目前清單、完美主義者照實際總數、成就數量成就會觸發、城鎮四級、人口只算活著的村民、商隊上門、
// 日誌事件觸發（議會推翻否決、加冕、冷戰和好、婚禮鬧場、罷工、核災、說謊爆炸、萬靈藥…）、狀態觸發（提案、事件卡、託夢、災厄工坊、第六時代）、
// 第一輪補發不洗版、介面（中英、桌機與 390px）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const lang of ['zh', 'en']) for (const [W, H, mob] of [[1280, 860, false], [390, 844, true]]) {
    console.log(`${lang} ${W}px`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block', isMobile: mob, hasTouch: mob });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[Achievements\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    // 舊存檔:玩家時代拿過「初戀」「當選鎮長」
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.setItem('rimtown_achievements', JSON.stringify(['first_dating', 'elected_mayor', 'first_chat'])); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const U = app._unlockedAchievements; const A = ACHIEVEMENTS;
      const toasts = []; const _toast = app._showAchievementToast; app._showAchievementToast = function (def) { toasts.push(def.name); };
      const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
      // 1) 清單:分類、舊時代、完美主義者
      const cats = new Set(Object.values(A).map(a => a.category)); const legacy = Object.entries(A).filter(([, a]) => a.category === 'legacy').map(([k]) => k);
      out.list = { cats: [...cats].sort().join(','), total: Object.keys(A).length, legacy: legacy.length, hasNew: !!A.lab_first && !!A.ways_forum && !!A.crowned && !!A.path_steam, perfect: A.achievement_99.desc, tier: A.town_lv7.name, dup: Object.keys(A).filter(k => k === 'elected_mayor').length };
      // 2) 舊時代的成就觀察者不再頒;已解鎖的保留
      const before = U.size; app._unlockAchievement('first_marriage'); out.legacy = { noNew: !U.has('first_marriage'), kept: U.has('first_dating') && U.has('elected_mayor') };
      // 3) 第一輪補發不洗版
      // 跟剛載入頁面一樣:第一輪(舊的判定跑完會把旗標打開)新成就也要靜默;之後的才彈通知
      for (const k of ['survive_7', 'pop_15', 'first_trade', 'prop_first']) U.delete(k); app._achNewOnce = false; app._achFirstCheckDone = false; const t0 = toasts.length;
      const p0 = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead).length; const th = w.trade.tradeHistory; w.trade.tradeHistory = [{}];
      app._checkAchievements(); const first = toasts.length - t0; U.delete('first_trade'); const t2 = toasts.length; app._checkAchievements(); w.trade.tradeHistory = th;
      out.silent = { toasts: first, later: toasts.length - t2, popOk: p0 >= 15 ? U.has('pop_15') : true };
      // 4) 日誌事件觸發
      const ev = [['veto_override', '⚔️ 鎮長{m}否決了{id}，但{council}以 {f}:{a} 超過三分之二推翻否決，提案照樣通過！'], ['crowned', '👑 {a}加冕為王。'], ['ways_thaw', '🫖 冷戰了 {n} 天，{a}和{b}在井邊碰到，終於開口打了招呼。'], ['wedding_crash', '😤 {foe}在{a}和{b}的婚禮上鬧場，被賓客勸了出去。'], ['strike', '✊ {s}的 {n} 個工人罷工了，要求{o}加薪。'], ['nuke', '☢️ 核災！核電廠爆炸，{dead}罹難，{s}人得了輻射病，{l}人連夜搬離小鎮。'], ['lab_boom', '💥 {a}又說了謊——砰！當場爆炸了。{n}'], ['lab_panacea', '🧴 喝了「{x}」的{a}還是病倒了。大家這才知道，{s}賣的只是{y}。']];
      for (const [k] of ev) U.delete(k); const t1 = toasts.length;
      for (const [, key] of ev) w.logMessageT('event', key, { m: 'x', id: 'L1', council: 'x', f: 3, a: 'x', b: 'y', n: 2, foe: 'z', s: 'x', o: 'y', dead: 'x', l: 1, x: 'x', y: 'y' });
      w.logMessageT('event', '🦇 {a}半夜吸了{v}的血，被人撞見了！', { a: 'x', v: 'y' }); // 吸血鬼不是說一套做一套
      out.ev = { all: ev.every(([k]) => U.has(k)), toast: toasts.length - t1 === ev.length, hyp: !U.has('ways_hyp') || U.has('ways_hyp') && false };
      out.ev.hyp = !U.has('ways_hyp');
      // 5) 狀態觸發
      for (const k of ['card_first', 'dream_first', 'lab_first', 'lab_cure', 'path_steam', 'prop_petty', 'town_lv3', 'first_trade', 'elder_90']) U.delete(k);
      w.eventCards = w.eventCards || {}; const pl0 = w.eventCards.played; w.eventCards.played = [{}];
      w.dream = w.dream || { dreams: [] }; const dr0 = w.dream.dreams; w.dream.dreams = [{}];
      const C = CALAMITY.S(w); C.st.released = Math.max(1, C.st.released || 0); C.hist.unshift({ name: 'x', how: 'cure', died: 0, survived: true });
      const P = w.research.projects; const sk = Object.values(P).find(p => p.era === 6 && TECH.onPath(p.key, 'steam')); const st0 = sk?.status; if (sk) sk.status = 'complete';
      w.proposals.items.push({ id: 'LT1', kind: 'feast', status: 'open', votes: {} });
      const tl0 = w.tierState.lv; w.tierState.lv = 1; const th0 = w.trade.tradeHistory; w.trade.tradeHistory = [{}];
      const old = npcs()[0]; const ag0 = old.age; old.age = 92;
      app._checkAchievements();
      out.state = { card: U.has('card_first'), dream: U.has('dream_first'), lab: U.has('lab_first'), cure: U.has('lab_cure'), steam: !sk || U.has('path_steam'), petty: U.has('prop_petty'), tier: U.has('town_lv3'), trade: U.has('first_trade'), elder: U.has('elder_90') };
      w.eventCards.played = pl0; w.dream.dreams = dr0; C.hist.shift(); if (sk) sk.status = st0; w.proposals.items = w.proposals.items.filter(p => p.id !== 'LT1'); w.tierState.lv = tl0; w.trade.tradeHistory = th0; old.age = ag0;
      // 6) 成就數量:只算目前清單,25/50 會觸發
      const counted = Object.entries(A).filter(([k, a]) => a.category !== 'legacy' && a.category !== 'player'); const keep = new Set(U);
      for (const [k] of counted.slice(0, 55)) U.add(k); U.delete('achievement_25'); U.delete('achievement_50'); app._checkAchievements(); out.meta = { a25: U.has('achievement_25'), a50: U.has('achievement_50'), a99: U.has('achievement_99') };
      for (const [k] of counted) if (k !== 'achievement_99') U.add(k); U.delete('achievement_99'); app._checkAchievements(); out.meta.all = U.has('achievement_99');
      U.clear(); for (const k of keep) U.add(k);
      // 7) 介面
      const mobile = innerWidth <= 768; if (mobile && app._openKairoTab) app._openKairoTab('achievements'); else { app.activeTab = 'achievements'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 400));
      const pane = (mobile ? document.getElementById('kairo-card-body') : document.getElementById('sidebar-content')) || document.body; const panel = pane.querySelector('.achievements-panel') || document.querySelector('.achievements-panel');
      const cnt = panel?.querySelector('.ach-count')?.textContent || ''; const [have, tot] = cnt.split('/').map(Number);
      const realTot = counted.length; let realHave = 0; for (const [k] of counted) if (U.has(k)) realHave++;
      const leg = panel?.querySelector('.ach-legacy'); const txt = panel?.innerText || '';
      out.ui = { panel: !!panel, cnt, countOk: have === realHave && tot === realTot, cats: panel ? panel.querySelectorAll('.ach-category h4').length : 0, legacy: !!leg && !leg.open && leg.querySelectorAll('.ach-card').length >= 2, lockedGoal: !!panel?.querySelector('.ach-card.locked .ach-desc')?.textContent.trim() && !/尚未解鎖|\?\?\?/.test(panel?.querySelector('.ach-card.locked')?.innerText || ''), undef: /undefined|NaN|\{[a-z]+\}/.test(txt), cjk: (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (txt.match(/[一-鿿]+/g) || []).slice(0, 4) : [], overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      app._showAchievementToast = _toast;
      return out;
    });
    const zh = lang === 'zh';
    ok(r.list.cats === 'culture,economy,god,legacy,life,politics,special,tech,town,ways' && r.list.hasNew && r.list.total >= 140 && r.list.legacy >= 20 && r.list.dup === 1, '成就分九類＋舊時代紀念，新系統補上新成就', r.list);
    ok(!/99/.test(r.list.perfect) && (zh ? /王都/.test(r.list.tier) : /Capital/i.test(r.list.tier)), '完美主義者不再寫死 99 個；城鎮等級對上四級（王都）', r.list);
    ok(r.legacy.noNew && r.legacy.kept, '舊時代的成就觀察者不再頒，已解鎖的保留', r.legacy);
    ok(r.silent.toasts === 0 && r.silent.later === 1 && r.silent.popOk, '升級後第一輪補發的成就靜默入袋，不洗版；人口只算活著的村民', r.silent);
    ok(r.ev.all && r.ev.toast && r.ev.hyp, '日誌事件觸發成就（議會推翻否決、加冕、冷戰和好、婚禮鬧場、罷工、核災、說謊爆炸、萬靈藥）；不相干的事件不會誤觸', r.ev);
    ok(Object.values(r.state).every(Boolean), '狀態觸發成就（事件卡、託夢、災厄工坊、疫苗、第六時代、雞毛蒜皮提案、升城鎮、商隊上門、人瑞）', r.state);
    ok(r.meta.a25 && r.meta.a50 && !r.meta.a99 && r.meta.all, '成就數量的成就會觸發；拿完全部才給完美主義者', r.meta);
    ok(r.ui.panel && r.ui.countOk && r.ui.cats >= 9 && r.ui.legacy && r.ui.lockedGoal && !r.ui.undef && !r.ui.cjk.length && !r.ui.overflow, `介面：計數正確、分類、舊時代紀念收合、沒拿到的看得到目標（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
