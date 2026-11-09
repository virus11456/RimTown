// v9.3.0 終局災厄「黑日」：七種世界級災厄都撐過才會被發現（之前手牌裡是一張蓋著的 ❔ 牌）；
// 撐過第七種的那一刻天文台發現、角落提示；三條戰線（電網／生命／以太）各自進度，研究員分組，小鎮自己的路線熟一點；
// 「先救哪一線」提案（相關職業贊成、別線的人反對）、地下方舟；降臨時每一線各自算化解／減輕／重創、後果不同；
// 存讀檔、銀幣守恆、成就、介面（三條進度條、中英、桌機與 390px）
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[WorldCal\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const notes = []; app._showCornerNotice = (o) => notes.push(o); try { app._visitorMailboxTick?.(); } catch (e) {} // 掛上 onWorldCal 等鉤子(平常遊戲迴圈會掛)
      const w = app.world; w.observerMode = true; const out = {};
      let d = w._absDay(); w._absDay = () => d; let wcDrift = 0;
      const step = (n = 1) => { for (let i = 0; i < n; i++) { d++; const T0 = MONEY.total(w), p0 = MONEY.S(w).pend || 0; WORLDCAL.daily(w); wcDrift += (MONEY.total(w) - T0) - ((MONEY.S(w).pend || 0) - p0); try { w.proposals.daily(w); } catch (e) {} } };
      const people = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && !String(a.agentId).startsWith('visit_'));
      const P = () => w.research.projects; const setDone = (ks) => { const Q = P(); for (const k of ks) if (Q[k]) { Q[k].status = 'complete'; Q[k].progress = Q[k].cost; } };
      const LS = (a) => localStorage.setItem('rimtown_worldcal', JSON.stringify(a));
      const SIX = ['nukewar', 'aliens', 'ai', 'infertile', 'iceage', 'rift'];
      try { WALLET.S(w); } catch (e) {}
      w.tech = w.tech || {}; TECH.S(w); const p0 = w.tech.path; const pw0 = CALAMITY.S(w).power;
      let k = 0; while (people().length < 30 && k++ < 40) { const n0 = Object.keys(w.agents).length; try { w.events?._spawnImmigrant?.(w); } catch (e) {} if (Object.keys(w.agents).length === n0) break; }
      const snap = JSON.stringify(w.serialize());
      const restore = (path) => { w.loadSave(JSON.parse(snap)); w.observerMode = true; w._absDay = () => d; w.tech = w.tech || {}; TECH.S(w); w.tech.path = path || 'electro'; w.worldcal = null; WORLDCAL.S(w); };
      // 1) 七種沒撐過:蓋著的牌,不會自然發生、不能打
      restore('bio'); LS(SIX); setDone(['life_extension', 'synthetic_life', 'gene_editing']);
      const v0 = WORLDCAL.view(w).kinds.find(x => x.key === 'blacksun');
      out.hidden = { hidden: v0.hidden, name: v0.name, seven: v0.seven, notIn: !Object.keys(WORLDCAL.weights(w)).includes('blacksun'), can: WORLDCAL.canLab(w, 'blacksun').ok };
      // 2) 撐過第七種(喪屍)的那一刻被發現
      CALAMITY.S(w).power = 100; const rz = { ok: !!WORLDCAL.begin(w, 'zombie', 'lab') }; let g = 0; while (w.worldcal.cur && g++ < 200) step();
      const v1 = WORLDCAL.view(w).kinds.find(x => x.key === 'blacksun');
      out.found = { released: rz.ok, all7: WORLDCAL.allSeven(), on: v1.on, hidden: !!v1.hidden, name: v1.name, note: notes.some(n => n.icon === '🌑'), log: (w.eventLog || w.log || []).length >= 0, inBio: Object.keys(WORLDCAL.weights(w)).includes('blacksun') };
      // 3) 黑日:三條戰線,小鎮自己的路線熟一點;先救哪一線
      restore('electro'); w.worldcal.cool = 0; CALAMITY.S(w).power = 100;
      const c = WORLDCAL.begin(w, 'blacksun', 'nature'); out.begin = { fronts: !!c.fronts && Object.keys(c.fronts).join() };
      const R0 = Math.random; Math.random = () => 0.5;
      try { c.ph = 'debate'; for (let i = 0; i < 6; i++) WORLDCAL._t.progDaily(w, c); } finally { Math.random = R0; }
      out.split = { e: c.fronts.electro, b: c.fronts.bio, s: c.fronts.steam, avg: c.prog };
      c.ph = 'omen'; c.pd = d; let gg = 0; while (w.worldcal.cur && w.worldcal.cur.ph !== 'rumor' && gg++ < 100) step();
      const ark = (w.proposals?.items || []).find(p => p.kind === 'wc_ark'); const foc = (w.proposals?.items || []).find(p => p.kind === 'wc_focus');
      out.props = { ark: !!ark, focus: !!foc, front: foc?.front, weakest: Object.keys(c.fronts).sort((a, b) => c.fronts[a] - c.fronts[b])[0] };
      if (foc) { const mk = (job) => ({ agentId: 'x_' + job, name: 'x', age: 35, job: { key: job }, personality: { traits: [], values: [] } }); const J = { electro: 'engineer', bio: 'farmer', steam: 'alchemist' }; const other = Object.keys(J).find(f => f !== foc.front);
        Math.random = () => 0.5; try { out.props.vMine = WORLDCAL.vote(w, foc, mk(J[foc.front])).v; out.props.vOther = WORLDCAL.vote(w, foc, mk(J[other])).v; } finally { Math.random = R0; }
        const before = { ...c.fronts }; WORLDCAL.enact(w, foc); out.props.set = c.focus === foc.front; c.ph = 'debate'; Math.random = () => 0.5; try { WORLDCAL._t.progDaily(w, c); } finally { Math.random = R0; }
        const gain = Object.fromEntries(Object.keys(c.fronts).map(f => [f, c.fronts[f] - before[f]])); out.props.focusFaster = Object.keys(gain).every(f => f === foc.front || gain[foc.front] > gain[f] * 2); }
      // 存讀檔
      const sv = JSON.parse(JSON.stringify(w.serialize())); w.loadSave(sv); w.observerMode = true; w._absDay = () => d; out.save = { fronts: !!w.worldcal?.cur?.fronts, focus: w.worldcal?.cur?.focus === c.focus };
      // 4) 降臨:每一線各自算
      const arriveWith = (fr, prep) => { restore('electro'); for (const k3 of ['power_plant', 'factory', 'refinery', 'workshop']) w.buildings.completed.push({ buildingKey: k3, key: k3, name: BUILDING_TEMPLATES[k3]?.name || k3 }); const cc = WORLDCAL.begin(w, 'blacksun', 'nature'); cc.fronts = fr; cc.prog = (fr.electro + fr.bio + fr.steam) / 3; cc.prep = prep ? d : null; const pop0 = people().length; const f0 = w.stockpile.get('food') || 0; const b0 = w.buildings.completed.length; WORLDCAL._t.arrive(w, cc); return { out: cc.out, fo: cc.frontOut, dead: cc.dead, left: cc.left, winter: cc.winter || 0, food: (w.stockpile.get('food') || 0) < f0, wreck: w.buildings.completed.length < b0, sterile: !!w.worldcal.sterile, lost: (cc.lostOnly || []).length, popDrop: pop0 - people().length }; };
      w.stockpile.add?.('food', 300, w.tickCount, 'test');
      out.mix = arriveWith({ electro: 100, bio: 60, steam: 10 });
      out.all = arriveWith({ electro: 100, bio: 100, steam: 100 });
      out.none = arriveWith({ electro: 0, bio: 0, steam: 0 });
      // 5) 結束:寫進歷史、成就(七種/黑日/天亮)
      restore('electro'); LS([...SIX, 'zombie']); const c5 = WORLDCAL.begin(w, 'blacksun', 'lab'); let g5 = 0; while (w.worldcal.cur && g5++ < 300) { if (w.worldcal.cur.fronts) for (const f of Object.keys(c5.fronts)) c5.fronts[f] = 100; c5.prog = 100; step(); }
      const U = app._unlockedAchievements; for (const k2 of ['wc_blacksun', 'wc_dawn', 'wc_all']) U.delete(k2); app._achNewOnce = true; app._achFirstCheckDone = true; app._showAchievementToast = () => {}; app._checkAchievements();
      out.end = { hist: w.worldcal.hist[0]?.kind, out: w.worldcal.hist[0]?.out, ach: ['wc_blacksun', 'wc_dawn', 'wc_all'].filter(k2 => U.has(k2)) };
      out.drift = Math.round(wcDrift * 100) / 100;
      // 6) 介面
      restore('electro'); LS(SIX); w.worldcal.cool = 0; CALAMITY.S(w).power = 100;
      app._ghTab = 'hand'; app._ghFilter = 'wc'; app._ghSel = 'wc:blacksun'; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const tray = document.getElementById('gh-tray'); const card = tray.querySelector('.gh-wcc[data-v="wc:blacksun"]');
      out.ui = { cards: tray.querySelectorAll('.gh-wcc').length, hidCard: !!card && /？？？/.test(card.textContent) && !/黑日|Black Sun/.test(card.textContent), hidDet: !!tray.querySelector('.gh-wcd.wc-hidden') && !!tray.querySelector('.gh-wcd [disabled]'), seven: tray.querySelectorAll('.gh-wc-seven span').length };
      const t1 = tray.innerText;
      LS([...SIX, 'zombie']); app._ghRender(); const card2 = tray.querySelector('.gh-wcc[data-v="wc:blacksun"]'); out.ui.shown = !!card2 && /黑日|Black Sun/.test(card2.textContent) && !card2.classList.contains('off');
      tray.querySelector('.gh-wcd [data-gh="wc-play"]')?.click(); await new Promise(r => setTimeout(r, 300));
      out.ui.played = w.worldcal?.cur?.kind;
      if (w.worldcal?.cur) { let g6 = 0; while (w.worldcal.cur.ph !== 'debate' && g6++ < 50) step(); app._ghTab = 'hand'; app._ghFilter = 'wc'; app._ghShow(); await new Promise(r => setTimeout(r, 300)); out.ui.bars = tray.querySelectorAll('.gh-wc .wc-front').length; }
      const t2 = tray.innerText; out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1; app._ghFilter = 'all'; app._ghHide?.();
      const all = t1 + '\n' + t2; out.ui.undef = /undefined|NaN|\{[a-z]+\}/.test(all); out.ui.cjk = (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (all.match(/[一-鿿]+/g) || []).filter(x => x !== '？？？').slice(0, 8) : [];
      w.tech.path = p0; CALAMITY.S(w).power = pw0; LS([]);
      return out;
    });
    const zh = lang === 'zh';
    ok(r.hidden.hidden && r.hidden.name === '？？？' && r.hidden.seven === 6 && r.hidden.notIn && !r.hidden.can, '七種還沒撐完：黑日是一張蓋著的牌（看得到撐過 6/7），不會自然發生、也不能打', r.hidden);
    ok(r.found.released && r.found.all7 && r.found.on && !r.found.hidden && r.found.note && r.found.inBio, '撐過第七種（喪屍）的那一刻：黑日被發現、角落提示、之後任何路線走到頂都可能遇上', r.found);
    ok(r.begin.fronts === 'electro,bio,steam', '黑日有三條戰線：電網、生命、以太', r.begin);
    ok(r.split.e > r.split.b && r.split.e > r.split.s && r.split.b > 0, '研究員分三組；小鎮自己的路線（電子機械）那一線進度快一點', r.split);
    ok(r.props.ark && r.props.focus && r.props.front === r.props.weakest, '口耳相傳：有人提「地下方舟」，也有人提「先救最危險的那一線」', r.props);
    ok(r.props.vMine === 'for' && r.props.vOther === 'against' && r.props.set && r.props.focusFaster, '那一行的人贊成、別線的人反對；通過後那一線快很多', r.props);
    ok(r.save.fronts && r.save.focus, '存讀檔：三條戰線與優先順序都還在', r.save);
    const M = r.mix;
    ok(M.out === 'eased' && M.fo.electro === 'averted' && M.fo.bio === 'eased' && M.fo.steam === 'hit' && M.winter === 2 && M.food && M.lost >= 1, '降臨：電網救起來、生命救一半、以太沒救 → 整體減輕；以太那線長冬與離鄉、生命那線少糧、只有沒救起來的那幾線會失傳', M);
    ok(r.all.out === 'averted' && r.all.dead === 0 && r.all.popDrop === 0 && !r.all.wreck && r.all.lost === 0, '三線都救起來 → 化解：沒人死、沒失傳', r.all);
    ok(r.none.out === 'hit' && r.none.dead >= 1 && r.none.sterile && r.none.wreck && r.none.lost >= 3, '三線都沒救 → 重創：有人死、半年難懷孕、建築毀、三條路線都有學問失傳', r.none);
    ok(r.end.hist === 'blacksun' && r.end.out === 'averted' && ['wc_blacksun', 'wc_dawn', 'wc_all'].every(k => r.end.ach.includes(k)), '結束：寫進歷史；成就「黑日之後」「天亮了」「七次世界末日」', r.end);
    ok(r.drift === 0, '銀幣守恆', r.drift);
    ok(r.ui.cards === 8 && r.ui.hidCard && r.ui.hidDet && r.ui.seven === 7, '手牌：第八張是蓋著的 ❔ 牌（看不到名字），詳情列出七種撐過了哪些、不能打', r.ui);
    ok(r.ui.shown && r.ui.played === 'blacksun' && r.ui.bars === 3, '七種撐完：牌翻開、可以發動；進行中手牌區塊有三條戰線進度', r.ui);
    ok(!r.ui.undef && !r.ui.cjk.length && !r.ui.overflow, `不破版、沒有沒翻譯的字（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
