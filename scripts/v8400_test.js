// v8.4.0 神之書
// 卡牌四級（普通／稀有／傳說／禁忌）與神力花費、神之書解鎖（存檔＋帳號共用）、打牌失敗原因（沒解鎖／時機不對／神力不夠／一天三張）、
// 新卡的真實反饋（世紀和解、偽君子現形、銀行謠言、傳家寶、點石成金、真話雨、集體失憶、顛倒人心）、事件卡的銀幣都記帳、託夢花神力、
// 神力回復（興旺、虔誠）、介面（中英、桌機與 390px）
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
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'warning' && /\[(Godbook|EventCards)\]/.test(m.text())) errs.push(m.text()); });
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    // 帳號在別的鎮已經把「黃金時代」寫進書裡
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.setItem('rimtown_god_sandbox', '0'); localStorage.setItem('rimtown_godbook', JSON.stringify(['golden_age'])); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {};
      const w = app.world; w.observerMode = true; const E = w.eventCards; const C = CALAMITY.S(w); const out = {}; const B = GODBOOK.S(w);
      const reset = () => { E.cooldown = {}; E._todayCount = 0; C.power = 100; };
      const adults = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 16 && !String(a.agentId).startsWith('visit_') && a.currentLocation !== 'exploration');
      const aff = (a, b) => a.relationships?.relationships?.[b.agentId]?.affinity || 0;
      const flowed = () => MONEY.total(w) - (MONEY.S(w).pend || 0); const r1 = (n) => Math.round(n * 10) / 10;
      for (const k of Object.keys(B.pages)) delete B.pages[k]; try { WALLET.S(w); } catch (e) {} // 錢包先開好(開局的初始存款不算事件卡的)
      // 1) 卡牌四級、花費
      const RA = {}; for (const c of EVENT_CARDS) RA[c.rar] = (RA[c.rar] || 0) + 1; const rare = EVENT_CARDS.filter(c => c.rar !== 'common');
      out.book = { total: EVENT_CARDS.length, RA, costs: ['common', 'rare', 'legend', 'forbid'].map(k => GODBOOK.RAR[k].cost).join(','), commonOn: EVENT_CARDS.filter(c => c.rar === 'common').every(c => GODBOOK.unlocked(w, c.id)),
        rareOff: !GODBOOK.unlocked(w, 'reconcile') && !GODBOOK.unlocked(w, 'truth_rain'), carried: GODBOOK.unlocked(w, 'golden_age'), hints: rare.every(c => GODBOOK.UNLOCK[c.id] && GODBOOK.UNLOCK[c.id][0]) };
      const d0 = E.toDict(w); out.book.dict = { have: d0.book.have, total: d0.book.total, handLocked: d0.hand.some(h => h.id === 'truth_rain'), handCost: d0.hand.every(h => h.cost === GODBOOK.RAR[h.rar].cost) };
      // 2) 打牌失敗原因、扣神力、一天三張
      reset(); out.fail = { locked: E.play(w, 'truth_rain').why };
      B.pages.bank_rumor = 1; const bk = w.bank; w.bank = null; out.fail.ctx = E.play(w, 'bank_rumor').why; w.bank = bk;
      C.power = 5; out.fail.power = E.play(w, 'golden_age').why; out.fail.left = C.power;
      reset(); const a1 = E.play(w, 'treat'), a2 = E.play(w, 'blunder'), a3 = E.play(w, 'golden_age'), a4 = E.play(w, 'misheard');
      out.daily = { ok3: !!(a1.ok && a2.ok && a3.ok), fourth: a4.why, spent: r1(100 - C.power), golden: (w.godbook.golden || 0) > (w._absDay?.() || 0) };
      // 3) 小鎮發生過的事寫進神之書（存檔、帳號）
      const X = WAYS.S(w); X.st.cold = Math.max(1, X.st.cold || 0); const got = []; const og = w.onGodbook; w.onGodbook = (c) => { got.push(c.id); try { og?.(c); } catch (e) {} };
      const nu = GODBOOK.check(w).map(c => c.id); const again = GODBOOK.check(w).length; w.onGodbook = og;
      let ls = []; try { ls = JSON.parse(localStorage.getItem('rimtown_godbook') || '[]'); } catch (e) {}
      const w2 = new World(); w2.loadSave(JSON.parse(JSON.stringify(w.serialize())));
      out.unlock = { got: nu.includes('reconcile'), notice: got.includes('reconcile'), ls: ls.includes('reconcile'), page: !!B.pages.reconcile, once: again === 0, save: !!w2.godbook?.pages?.reconcile, open: GODBOOK.unlocked(w, 'reconcile') };
      // 4) 新卡的反饋
      const ppl = adults(); const [pa, pb, pc] = ppl;
      // 世紀和解:冷戰結束、感情回升
      X.cold = {}; for (let i = 0; i < 30 && !WAYS.coldWith(w, pa, pb); i++) WAYS.quarrel(w, pa, pb); const f0 = aff(pa, pb);
      reset(); const rc = E.play(w, 'reconcile'); out.reconcile = { cold: true, ok: !!rc.ok, ended: !WAYS.coldWith(w, pa, pb), warmer: aff(pa, pb) > f0, spent: r1(100 - C.power) };
      // 偽君子現形:被撞見、丟臉、全鎮多疑
      X.hyp = [{ a: pc.agentId, k: 'policy', t: 'T', d: w._absDay() }]; const fc0 = WAYS.faceOf(w, pc), tr0 = X.trust; B.pages.unmask = 1;
      reset(); const um = E.play(w, 'unmask'); out.unmask = { ok: !!um.ok, exp: !!X.hyp[0].exp, face: WAYS.faceOf(w, pc) < fc0, trust: X.trust <= tr0 };
      // 銀行謠言:擠兌
      const bank0 = JSON.parse(JSON.stringify(w.bank || null)); const BK = BANK.S(w); BK.open = true; BK.status = 'ok'; BK.banker = BK.banker || pa.agentId;
      reset(); const br = E.play(w, 'bank_rumor'); out.bank = { ok: !!br.ok, run: w.bank.status === 'run' }; w.bank = bank0;
      // 傳家寶、點石成金、慈善遺產:神給的錢都記帳
      B.pages.heirloom = 1; B.pages.golden_touch = 1; B.pages.bequest = 1;
      reset(); let T0 = flowed(), M0 = MONEY.total(w); const hl = E.play(w, 'heirloom'); out.heirloom = { ok: !!hl.ok, gain: r1(MONEY.total(w) - M0), drift: r1(flowed() - T0) };
      const greedy0 = ppl.filter(a => (a.personality?.traits || []).includes('greedy')).length;
      reset(); T0 = flowed(); M0 = MONEY.total(w); const gt = E.play(w, 'golden_touch'); out.touch = { ok: !!gt.ok, gain: r1(MONEY.total(w) - M0), drift: r1(flowed() - T0), greedy: ppl.filter(a => (a.personality?.traits || []).includes('greedy')).length - greedy0 };
      reset(); T0 = flowed(); const bq = E.play(w, 'bequest'); out.bequest = { ok: !!bq.ok, drift: r1(flowed() - T0) };
      // 真話雨:秘密全曝光、說一套做一套全被拆穿
      const s1 = DARK.secret(w, { kind: 'scheme', culprit: pa.agentId, victim: pb.agentId, k: '{a}偷拿了{b}的東西', p: { a: pa.name, b: pb.name } });
      X.hyp = [{ a: pb.agentId, k: 'policy', t: 'T2', d: w._absDay() }]; B.pages.truth_rain = 1;
      reset(); const trn = E.play(w, 'truth_rain'); out.truth = { ok: !!trn.ok, secret: !!s1.found, hyp: !!X.hyp[0].exp, spent: r1(100 - C.power) };
      // 集體失憶:感情減半、冷戰結束
      for (let i = 0; i < 30 && !WAYS.coldWith(w, pa, pc); i++) WAYS.quarrel(w, pa, pc); E._aff(pb, pc, 60); const fb = aff(pb, pc); B.pages.forget = 1;
      reset(); const fg = E.play(w, 'forget'); out.forget = { ok: !!fg.ok, half: Math.abs(aff(pb, pc) - Math.round(fb / 2)) <= 1, cold: !WAYS.coldWith(w, pa, pc) };
      // 顛倒人心:最好的一對變差、最差的一對變好
      const [ba, bb] = E._bestPair(w), [wa, wb] = E._worstPair(w); const best0 = aff(ba, bb), worst0 = aff(wa, wb); B.pages.mind_flip = 1;
      reset(); const mf = E.play(w, 'mind_flip'); out.flip = { ok: !!mf.ok, best: aff(ba, bb) < best0, worst: aff(wa, wb) > worst0 };
      // 5) 託夢花 3 神力
      const Dm = DREAM.S(w); Dm.lastDream = -99; C.power = 2; const dz = await DREAM.send(w, pa.agentId, '去河邊看看'); Dm.lastDream = -99; C.power = 10; const dy = await DREAM.send(w, pa.agentId, '去河邊看看');
      out.dream = { poor: dz.why, ok: !!dy.ok, left: C.power };
      // 6) 神力回復:每天 1.5、興旺再 +0.5、上限 100
      const setDay = (n) => { w.clock.day = n; }; const dd = w._absDay(); C.power = 20; C.pDay = null; w.prosperity.prosperity = 30; CALAMITY.daily(w); const g1 = r1(C.power - 20);
      out.regen = { g1, gain: C.gain };
      // 7) 介面
      reset(); C.power = 40; app._ghTab = 'hand'; app._ghShow(); await new Promise(r => setTimeout(r, 300));
      const tray = document.getElementById('gh-tray'); const tTxt = tray?.innerText || '';
      out.ui = { open: !!tray && !tray.hidden, pw: !!tray?.querySelector('.gh-pw-top'), costs: tray ? tray.querySelectorAll('.gh-cost').length : 0, rar: !!tray?.querySelector('[class*="gh-rar-"]'), bookTab: !!tray?.querySelector('[data-v="book"]') };
      app._ghTab = 'book'; app._ghRender(); await new Promise(r => setTimeout(r, 200));
      const bTxt = tray?.innerText || ''; const secs = tray ? tray.querySelectorAll('.gh-book-sec').length : 0;
      out.ui.book = { secs, on: tray ? tray.querySelectorAll('.gh-book-card.on').length : 0, off: tray ? tray.querySelectorAll('.gh-book-card.off').length : 0, hint: /🔒\s*\S/.test(bTxt) };
      const all = tTxt + '\n' + bTxt; out.ui.undef = /undefined|NaN|\{[a-z]+\}/.test(all); out.ui.cjk = (typeof I18N !== 'undefined' && I18N.getLang?.() === 'en') ? (all.match(/[一-鿿]+/g) || []).slice(0, 6) : [];
      out.ui.overflow = document.documentElement.scrollWidth > innerWidth + 1; const rb = tray?.getBoundingClientRect(); out.ui.inView = !!rb && rb.left >= -1 && rb.right <= innerWidth + 1;
      app._ghHide?.();
      return out;
    });
    const zh = lang === 'zh';
    ok(r.book.total >= 50 && r.book.RA.common >= 20 && r.book.RA.rare >= 15 && r.book.RA.legend >= 4 && r.book.RA.forbid >= 4 && r.book.costs === '3,6,15,30', '卡牌分四級：普通／稀有／傳說／禁忌，各花 3／6／15／30 神力', r.book);
    ok(r.book.commonOn && r.book.rareOff && r.book.carried && r.book.hints && r.book.dict.total === r.book.total && !r.book.dict.handLocked && r.book.dict.handCost, '普通卡一開始就有；稀有以上沒寫進書裡的不在手牌、看得到怎麼解鎖；別的鎮寫進書的帶過來', r.book);
    ok(r.fail.locked === 'locked' && r.fail.ctx === 'context' && r.fail.power === 'power' && r.fail.left === 5, '打不出去會說原因：還沒寫進書裡、時機不對、神力不夠（不扣神力）', r.fail);
    ok(r.daily.ok3 && r.daily.fourth === 'daily' && r.daily.spent === 21 && r.daily.golden, '一天最多三張；照稀有度扣神力（3＋3＋15）；黃金時代會持續半個月', r.daily);
    ok(Object.values(r.unlock).every(Boolean), '小鎮發生過的事會寫進神之書（通知、存檔、帳號共用、不重複通知）', r.unlock);
    ok(r.reconcile.ok && r.reconcile.ended && r.reconcile.warmer && r.reconcile.spent === 6, '世紀和解：冷戰中的兩人和好、感情回升', r.reconcile);
    ok(r.unmask.ok && r.unmask.exp && r.unmask.face && r.unmask.trust, '偽君子現形：被撞見、丟臉、全鎮更多疑', r.unmask);
    ok(r.bank.ok && r.bank.run, '銀行謠言：引發擠兌', r.bank);
    ok(r.heirloom.ok && r.heirloom.gain >= 40 && r.heirloom.gain <= 80 && r.heirloom.drift === 0 && r.touch.ok && r.touch.gain === 1000 && r.touch.drift === 0 && r.touch.greedy >= 1 && r.bequest.ok && r.bequest.drift === 0, '傳家寶、點石成金、慈善遺產：神給的錢都記進金流帳（銀幣對得上）；點石成金讓人變貪心', { h: r.heirloom, t: r.touch, b: r.bequest });
    ok(r.truth.ok && r.truth.secret && r.truth.hyp && r.truth.spent === 30, '真話雨（禁忌，30 神力）：秘密曝光、說一套做一套的人被拆穿', r.truth);
    ok(r.forget.ok && r.forget.half && r.forget.cold && r.flip.ok && r.flip.best && r.flip.worst, '集體失憶：感情減半、冷戰結束；顛倒人心：最好的一對變差、最差的一對變好', { f: r.forget, m: r.flip });
    ok(r.dream.poor === 'power' && r.dream.ok && r.dream.left === 7, '託夢也花神力（3 點），不夠就託不了', r.dream);
    ok(r.regen.g1 >= 1.5 && r.regen.g1 <= 2.5 && r.regen.gain === r.regen.g1, '神力每天回復 1.5 起跳（虔誠的人多回得快）', r.regen);
    ok(r.ui.open && r.ui.pw && r.ui.costs >= 10 && r.ui.rar && r.ui.bookTab, `手牌：上方神力、每張卡標稀有度與花費、有神之書分頁（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(r.ui.book.secs === 4 && r.ui.book.on >= 25 && r.ui.book.off >= 5 && r.ui.book.hint && !r.ui.undef && !r.ui.cjk.length && !r.ui.overflow && r.ui.inView, `神之書：四級分區、沒解鎖的看得到條件、不破版（${zh ? '中文' : '英文'}、${W}px）`, r.ui);
    ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
