// v8.6.0 另外兩條路線的世界級災厄：🍼 全球不孕（基因生物）、🧊 冰河期／🌀 以太裂隙（蒸汽煉金）
// 會不會發生與是哪一種（路線、煤煙、以太）、各自的準備提案與投票、降臨的後果（不孕不死人但生不出孩子、
// 冰河期壓垮糧食田地和老人、裂隙把人吸走把房子扭走）、準備有沒有用、出生被擋與第一個嬰兒、存讀檔、
// 走正式提案流程、工坊發動、成就、銀幣守恆、介面（中英、桌機與 390px）
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
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_worldcal', '[]'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const out = {}; const R0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = R0; } };
      let d = w._absDay(); w._absDay = () => d; let wcDrift = 0;
      const step = (n = 1) => { for (let i = 0; i < n; i++) { d++; const T0 = MONEY.total(w), p0 = MONEY.S(w).pend || 0; WORLDCAL.daily(w); wcDrift += (MONEY.total(w) - T0) - ((MONEY.S(w).pend || 0) - p0); try { w.proposals.daily(w); } catch (e) {} } };
      const adults = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && !String(a.agentId).startsWith('visit_'));
      const P = () => w.research.projects; const setDone = (ks, on = true) => { const Q = P(); for (const k of ks) if (Q[k]) { Q[k].status = on ? 'complete' : 'locked'; if (on) Q[k].progress = Q[k].cost; } };
      const BIO6 = ['life_extension', 'synthetic_life', 'gene_editing', 'myth_genome', 'gene_stabilizer'];
      const ST6 = ['clockwork_automaton', 'aether_engine', 'floating_city', 'philosopher_stone', 'homunculus'];
      const E6 = ['rocketry', 'nuclear_weapons', 'satellite', 'space_station', 'quantum_computer', 'ai_agent'];
      try { WALLET.S(w); } catch (e) {}
      const addB = () => { for (const k of ['sky_isle', 'airship_dock', 'alchemy_lab', 'refinery', 'tavern']) w.buildings.completed.push({ buildingKey: k, key: k, name: BUILDING_TEMPLATES[k]?.name || k }); };
      const food = (n) => { const f = w.stockpile.get('food') || 0; if (f < n) w.stockpile.add('food', n - f, w.tickCount, 'test'); };
      w.tech = w.tech || {}; TECH.S(w); const p0 = w.tech.path; const pw0 = CALAMITY.S(w).power;
      const snap = JSON.stringify(w.serialize());
      const restore = (path) => { w.loadSave(JSON.parse(snap)); w.observerMode = true; w._absDay = () => d; w.tech = w.tech || {}; TECH.S(w); w.tech.path = path; setDone(path === 'bio' ? BIO6 : ST6); addB(); w.worldcal = null; WORLDCAL.S(w); };
      // 1) 會不會發生、是哪一種
      w.tech.path = 'bio'; setDone(['life_extension', 'synthetic_life']); const bioFew = WORLDCAL.eligible(w); setDone(['gene_editing']); const bioYes = WORLDCAL.eligible(w);
      const bioKinds = Object.keys(WORLDCAL.weights(w)); const bioPick = WORLDCAL.pickKind(w);
      w.tech.path = 'steam'; setDone(ST6, false); setDone(['clockwork_automaton', 'philosopher_stone', 'homunculus']); w.tech.steam = w.tech.steam || {}; w.tech.steam.smog = 80;
      const stYes = WORLDCAL.eligible(w); const wSmog = WORLDCAL.weights(w); w.tech.steam.smog = 0; setDone(['aether_engine', 'floating_city']); const wAeth = WORLDCAL.weights(w);
      w.tech.path = 'electro'; setDone(E6); const elKinds = Object.keys(WORLDCAL.weights(w));
      out.elig = { bioFew, bioYes, bioKinds, bioPick, stYes, smog: wSmog.iceage > wSmog.rift, aeth: wAeth.rift > wAeth.iceage, steamKinds: Object.keys(wSmog).sort(), elKinds: elKinds.sort() };
      setDone(E6, false);
      // 2) 全球不孕:提案、投票、沒做到 → 不再有孩子
      restore('bio');
      const pair = adults().filter(a => (a.age ?? 30) >= 20 && (a.age ?? 30) <= 40).slice(0, 4);
      for (let i = 0; i + 1 < pair.length; i += 2) { const [a, b] = [pair[i], pair[i + 1]]; a.relationships.getOrCreate(b.agentId, b.name).status = 'married'; b.relationships.getOrCreate(a.agentId, a.name).status = 'married'; a.personality.values = [...(a.personality.values || []), '家庭']; }
      const c = WORLDCAL.begin(w, 'infertile', 'nature');
      while (c.ph === 'omen') step(); const fixProp = (w.proposals.items || []).some(p => p.kind === 'wc_fix');
      while (c.ph === 'debate') step(); const bankP = (w.proposals.items || []).find(p => p.kind === 'wc_bank');
      const fam = pair[0]; const devoutA = adults().find(a => a !== fam); const _dv = FAITH.pietyOf; const _rel = FAITH.relOf;
      const vFam = fix(0.5, () => WORLDCAL.vote(w, { kind: 'wc_bank' }, fam));
      FAITH.relOf = () => ({ id: 'x' }); FAITH.pietyOf = () => 90; w.faith = w.faith || {}; const vDev = fix(0.5, () => WORLDCAL.vote(w, { kind: 'wc_bank' }, devoutA)); FAITH.relOf = _rel; FAITH.pietyOf = _dv;
      out.inf = { fixProp, bank: !!bankP, cost: !!bankP?.cost || !!bankP?.materials || JSON.stringify(bankP || {}).includes('paper'), vFam: vFam.v, vDev: vDev.v, whyDev: vDev.why };
      c.ph = 'panic'; c.pd = d; c.prog = 5; c.fix = null; c.prep = null; const pop0 = adults().length; const regs0 = (CALAMITY.S(w).regs || []).length;
      while (c.ph === 'panic') step();
      const Z = w.worldcal.sterile; out.inf.hit = { out: c.out, dead: c.dead, f: Z?.f, long: Z ? Z.until - d >= 300 : false, left: pop0 - adults().length, regress: (CALAMITY.S(w).regs || []).length > regs0, shock: (w.crisis?.cur || []).some(x => x.kind === 'wc_infertile') };
      // 出生被擋(先清掉基因延壽名單:做過療程的人生育力也會下降,這裡只看不孕)
      if (w.longev) w.longev.gene = {};
      const kids0 = Object.keys(w.agents).length; const [pa, pb] = adults().slice(0, 2); for (let i = 0; i < 10; i++) w.lifecycle._birthChild(w, pa, pb, false);
      out.inf.blocked = { born: Object.keys(w.agents).length - kids0, n: w.worldcal.sterile?.blocked || 0 };
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize()))); out.inf.save = w2.worldcal?.sterile?.f === 0;
      while (w.worldcal.cur) step();
      // 期限過了:第一個嬰兒
      if (w.longev) w.longev.gene = {}; /* 跑完災厄的那段時間裡,基因延壽療程可能又讓爸媽做過(會擋生育),先清掉 */
      d = w.worldcal.sterile.until + 1; const k1 = Object.keys(w.agents).length; w.worldcal.sterile.blocked = 3; w.worldcal.sterile.until = d + 5; w.worldcal.sterile.f = 1; w.lifecycle._birthChild(w, pa, pb, false);
      out.inf.first = { born: Object.keys(w.agents).length - k1, log: (w.messageLog || []).slice(-10).some(m => /🍼/.test(String(m.content || ''))) };
      d += 10; w.lifecycle._birthChild(w, pa, pb, false); out.inf.expired = !w.worldcal.sterile;
      // 精卵庫:重創也還有三成
      restore('bio'); const cB = WORLDCAL.begin(w, 'infertile', 'nature'); WORLDCAL.enact(w, { kind: 'wc_bank' }); cB.ph = 'panic'; cB.pd = d; cB.prog = 10; while (cB.ph === 'panic') step(); out.inf.bankF = w.worldcal.sterile?.f;
      while (w.worldcal.cur) step();
      restore('bio'); const cE = WORLDCAL.begin(w, 'infertile', 'nature'); cE.ph = 'panic'; cE.pd = d; cE.prog = 60; while (cE.ph === 'panic') step(); out.inf.easedF = w.worldcal.sterile?.f; out.inf.easedOut = cE.out; while (w.worldcal.cur) step();
      // 3) 冰河期:糧食、田地、老人;囤糧囤柴有用
      const ice = (stock) => { restore('steam'); food(400); const plots = (w.farm?.plots || []); for (const pl of plots) pl.state = 'growing'; const old = adults().slice(0, 3); for (const a of old) a.age = 75;
        const ci = WORLDCAL.begin(w, 'iceage', 'nature'); if (stock) WORLDCAL.enact(w, { kind: 'wc_stock' }); ci.ph = 'panic'; ci.pd = d; ci.prog = 10; const f0 = w.stockpile.get('food'); const p0 = adults().length; const oldIds = old.map(a => a.agentId);
        while (ci.ph === 'panic') step(); const f1 = w.stockpile.get('food');
        const res = { out: ci.out, lost: Math.round((1 - f1 / f0) * 100), dead: ci.dead, oldDead: oldIds.filter(id => !w.agents[id] || w.agents[id].isDead).length, left: ci.left, withered: plots.filter(p => p.state === 'withered').length, plots: plots.length, winter: ci.winter, drop: p0 - adults().length };
        while (w.worldcal.cur) step(); return res; };
      out.ice = fix(0.5, () => ice(false)); out.iceStock = fix(0.5, () => ice(true));
      // 4) 以太裂隙:人被吸走(不是死)、房子被扭走;先搬走少很多
      const rift = (evac) => { restore('steam'); const cr = WORLDCAL.begin(w, 'rift', 'nature'); if (evac) WORLDCAL.enact(w, { kind: 'wc_evac' }); cr.ph = 'panic'; cr.pd = d; cr.prog = 10; const p0 = adults().length; const b0 = w.buildings.completed.length;
        while (cr.ph === 'panic') step(); const res = { out: cr.out, dead: cr.dead, van: (cr.vanish || []).length, drop: p0 - adults().length, wrecked: b0 - w.buildings.completed.length, sky: !w.buildings.completed.some(b => b.buildingKey === 'sky_isle') };
        const V = WORLDCAL.view(w); res.viewVan = V.cur?.van; while (w.worldcal.cur) step(); return res; };
      out.rift = fix(0.5, () => rift(false)); out.riftEvac = fix(0.5, () => rift(true));
      // 5) 走正式提案流程(通過 → 執行)
      restore('steam'); const cp = WORLDCAL.begin(w, 'iceage', 'nature'); cp.ph = 'rumor'; cp.pd = d;
      const prop = TECH.propose(w, 'wc_stock', 'worldcal', adults()[0], '囤糧囤柴', '{who}提議全鎮一起囤糧、囤木柴，蓋一間不透風的冬季倉庫：最冷的那幾個月，至少不會餓死凍死。要先拿出一批木頭和石頭。', {}, 'welfare', {}, {});
      let execOk = false; try { if (prop) { prop.status = 'approved'; w.proposals._execute(w, prop, d); execOk = !!cp.prep; } } catch (e) { execOk = 'err:' + e.message; }
      out.flow = { prop: !!prop, kind: !!PROPOSAL_KINDS.wc_stock && !!PROPOSAL_KINDS.wc_bank && !!PROPOSAL_KINDS.wc_evac, execOk, cause: !!AFTERMATH.CAUSE.wc_iceage && !!AFTERMATH.CAUSE.wc_rift && !!AFTERMATH.CAUSE.wc_infertile };
      while (w.worldcal.cur) step();
      // 6) 工坊:撐過才能、壓縮版
      restore('steam'); WORLDCAL.S(w).cool = 0; const C = CALAMITY.S(w); C.power = 100; localStorage.setItem('rimtown_worldcal', '[]'); const locked = WORLDCAL.canLab(w, 'rift').why;
      localStorage.setItem('rimtown_worldcal', JSON.stringify(['rift', 'iceage', 'infertile'])); const rl = WORLDCAL.release(w, 'rift'); const c5 = w.worldcal.cur; out.lab = { locked, ok: rl.ok, ft: c5 ? Object.values(c5.len).reduce((s, v) => s + v, 0) : 0, src: c5?.src };
      // 成就
      w.worldcal.hist.push({ kind: 'infertile', out: 'hit', src: 'nature' }, { kind: 'iceage', out: 'eased', src: 'nature' }, { kind: 'rift', out: 'averted', src: 'nature' });
      const U = app._unlockedAchievements; const AK = ['wc_infertile', 'wc_iceage', 'wc_rift']; for (const k of AK) U.delete(k); app._achNewOnce = true; app._achFirstCheckDone = true; app._showAchievementToast = () => {}; app._checkAchievements(); out.ach = AK.filter(k => !U.has(k));
      // 7) 介面:進行中 + 不孕還沒過去
      w.worldcal.sterile = { until: d + 100, f: 0.3, blocked: 2 };
      while (c5.ph !== 'panic') step(); app._ghTab = 'lab'; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const tray = document.getElementById('gh-tray'); const lt = tray?.innerText || ''; const box = tray?.querySelector('.wc-box');
      out.ui = { box: !!box && box.classList.contains('wc-rift'), steril: !!tray?.querySelector('.wc-sterile') };
      app._ghFilter = 'all'; app._ghHide?.(); const mobile = innerWidth <= 768; if (mobile && app._openKairoTab) app._openKairoTab('econ-tech'); else { app.activeTab = 'econ-tech'; app.renderSidebar(); } await new Promise(r => setTimeout(r, 400));
      const era = document.querySelector('.wc-era'); const et = era?.innerText || ''; out.ui.tech = !!era?.querySelector('.wc-box') && !!era?.querySelector('.wc-sterile');
      while (w.worldcal.cur) step(); w.worldcal.cool = 0; C.power = 100; app._ghTab = 'hand'; app._ghFilter = 'wc'; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const kinds = tray?.querySelectorAll('.gh-wcc') || []; const kt = tray?.innerText || '';
      out.ui.kinds = kinds.length; out.ui.paths = tray?.querySelectorAll('.gh-wcc .gh-band').length || 0; out.ui.btn = tray?.querySelectorAll('.gh-wcc:not(.off)').length || 0;
      const all = lt + '\n' + et + '\n' + kt; out.ui.undef = /undefined|NaN|\{[a-z]+\}/.test(all); out.ui.cjk = (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (all.match(/[一-鿿]+/g) || []).slice(0, 6) : [];
      out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1; app._ghHide?.();
      out.drift = Math.round(wcDrift * 100) / 100;
      w.tech.path = p0; CALAMITY.S(w).power = pw0; localStorage.setItem('rimtown_worldcal', '[]');
      return out;
    });
    const zh = lang === 'zh'; const E = r.elig;
    ok(!E.bioFew && E.bioYes && E.bioKinds.sort().join() === 'infertile,zombie' && ['infertile', 'zombie'].includes(E.bioPick) && E.stYes && E.steamKinds.join() === 'iceage,rift' && E.smog && E.aeth && E.elKinds.join() === 'ai,aliens,nukewar', '每條路線第六時代研究到六成才會發生；基因生物→全球不孕；蒸汽煉金煤煙多→冰河期、以太引擎浮空城→裂隙；電子機械不變', E);
    const I = r.inf;
    ok(I.fixProp && I.bank && I.cost && I.vFam === 'for' && I.vDev === 'against' && I.whyDev === 'bio_god', '全球不孕：有人提「全力研究」與「精卵庫」（要用紙）；想要孩子的人贊成、虔誠的人覺得是在扮演神', I);
    ok(I.hit.out === 'hit' && I.hit.dead === 0 && I.hit.f === 0 && I.hit.long && I.hit.left >= 1 && I.hit.regress && I.hit.shock, '沒做到 → 重創：沒有人死，但一整年生不出孩子、想要孩子的夫妻搬走、基因學問失傳、災後反應', I.hit);
    ok(I.blocked.born === 0 && I.blocked.n >= 10 && I.save, '不孕期間孩子生不出來（被擋下的次數有記）；存讀檔還在', { b: I.blocked, s: I.save });
    ok(I.first.born === 1 && I.first.log && I.expired, '過了以後第一個嬰兒出生，全鎮來看；期限到自動解除', { f: I.first, e: I.expired });
    ok(I.bankF === 0.3 && I.easedF === 0.5 && I.easedOut === 'eased', '有精卵庫，重創也還有三成生得出來；做一半 → 減輕（一半）', { b: I.bankF, e: I.easedF });
    const A = r.ice, B = r.iceStock;
    ok(A.out === 'hit' && A.lost >= 45 && A.dead >= 1 && A.oldDead >= 1 && A.withered >= Math.min(1, A.plots) && A.winter === 2 && A.left >= 1, '冰河期重創：糧食少一半、田凍死、老人先走、有人往南逃、之後還有長冬', A);
    ok(B.lost < A.lost && B.dead <= A.dead && B.left <= A.left, '囤糧囤柴有用：糧食少損失、死的人和逃的人更少', { A, B });
    const X = r.rift, Y = r.riftEvac;
    ok(X.out === 'hit' && X.dead === 0 && X.van >= 1 && X.drop >= X.van && X.wrecked >= 2 && X.sky && X.viewVan === X.van, '以太裂隙重創：人被吸走（不是死）、浮空城區先被扭走、介面寫出被吸走幾人', X);
    ok(Y.van < X.van, '先遷離裂隙周邊：被吸走的人少很多', { X: X.van, Y: Y.van });
    ok(r.flow.prop && r.flow.kind && r.flow.execOk === true && r.flow.cause, '新提案走正式流程：登記、通過後執行；災後反應知道原因', r.flow);
    ok(r.lab.locked === 'locked' && r.lab.ok && r.lab.src === 'lab' && r.lab.ft >= 14 && r.lab.ft <= 20, '工坊：撐過才能發動裂隙，壓縮成 14～20 天', r.lab);
    ok(!r.ach.length, '成就：撐過全球不孕、冰河期、以太裂隙', r.ach);
    ok(r.drift === 0, '銀幣守恆（世界級災厄自己沒有憑空產生或消滅銀幣）', r.drift);
    ok(r.ui.box && r.ui.steril && r.ui.tech, `介面：工坊與科技分頁顯示裂隙進度和「不孕還沒過去」（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(r.ui.kinds === 7 && r.ui.paths === 7 && r.ui.btn >= 3 && !r.ui.undef && !r.ui.cjk.length && !r.ui.overflow, `介面：手牌區塊列出七種、標出路線、撐過的能發動；不破版（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
