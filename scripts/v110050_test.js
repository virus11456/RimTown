// v11.0.0 市場與第四權（第一段）之六：提案分頁裡的「市場」子分頁（市場與輿論，上帝視角）
//   1) 鎮上沒有私人開的店：分頁不出現
//   2) 有店家：分頁出現，數字是正在動手腳的店＋記者在查的＋還沒落幕的事
//   3) 六張卡各自顯示該有的內容；沒事的卡（民怨、陣營、出人命）不出現
//   4) 卡片可以收合；390px 手機不會橫向溢出；英文沒有漏翻
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/'; const SHOT = process.env.SHOT || '';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`); const zh = lang === 'zh';
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.removeItem('rimtown_ic'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp, w = app.world; app._setPaused?.(true); w.fullAgentMode = false; const out = {};
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); WALLET.S(w); const M = MARKET.S(w); const D = DEAL.S(w); DEALASK.S(w); PRESS.S(w); const PW = POWER.S(w); const P = w.proposals; try { CIVIC.S(w); } catch (e) {}
    const _r = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = _r; } };
    const like = (a, b, v) => { a.relationships.getOrCreate(b.agentId, b.name).affinity = v; }; const bal = (a, v) => { w.wallet.bal[a.agentId] = v; };
    const MY = w.election.currentMayor(w); const adults = npcs().filter(a => (a.age || 30) >= 20 && (a.age || 30) < 55 && a !== MY);
    const [O1, O2, O3, OFF, J, A1, A2, A3, K1, K2, CM1, CM2, CM3, CM4, GD] = adults; for (const a of [O1, O2, O3, OFF, J, A1, A2, A3, K1, K2, CM1, CM2, CM3, CM4, GD, MY]) { a.personality.traits = []; bal(a, 200); }
    const show = () => { app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'proposals'; app._ppTab = 'market'; app.renderSidebar(); return document.getElementById('sidebar-content'); };
    const tabOf = (root) => root.querySelector('.pp-tab[data-pp-tab="market"]');
    // 1) 沒有私人開的店
    for (const k of Object.keys(M.owners)) delete M.owners[k]; M.rival = {}; w.deallaw = null; w.office = null; w.tips = null; w.unrest = null; w.camps = null; w.riot = null; D.reports = []; D.tips = []; D.harm = []; D.deaths = []; D.facts.length = 0; D.f = {};
    let root = show(); out.none = { on: app._mkOn(), tab: !!tabOf(root), fallback: app._ppTab !== 'market' || !root.querySelector('#ic-mk-shops') };
    // 2) 有店家，還沒有任何事
    M.owners.kitchen = O1.agentId; M.owners.textile = O3.agentId; M.rival.kitchen = { fid: 'RV1', owner: O2.agentId, since: w._absDay() - 30, price: 1, pay: 1, emp: {}, rev: 0, cost: 0, hist: [], loss: 0 };
    root = show(); out.calm = { tab: !!tabOf(root), n: tabOf(root)?.querySelector('.pp-tab-n')?.textContent || '0', cards: [...root.querySelectorAll('.ic-card')].map(c => c.id).join(), shops: root.querySelectorAll('.mk-shop').length, fair: root.querySelectorAll('.mk-shop .ic-chip.ic-g').length, hint: root.querySelector('.pp-tabhint')?.textContent || '' };
    // 3) 把每一種事都擺出來
    TIERS.S(w).lv = 1; if (w.tierState) w.tierState.lv = 1; const d = w._absDay();
    DEAL.setUp(w, 'kitchen', 0.3); DEAL.setCut(w, 'textile', 2); DEAL.F(w, 'textile').gain = 66; const fc = DEAL.liveFact(w, 'textile', 'cut'); fc.harm = 2; D.st.sick = 2; DEAL.learn(w, fc, A1, 'victim'); D.harm.push({ id: A1.agentId, name: A1.name, key: 'textile', kind: 'clothes', d, sev: 1, fid: fc.id });
    DEALLAW.S(w).cap = d - 12; OFFICE.S(w); OFFICE.seat(w, 'market', OFF, MY); OFFICE.S(w).mayor = MY.agentId; OFFICE.S(w).st.checks = 3; OFFICE.S(w).st.found = 1; OFFICE.S(w).st.graft = 1;
    const P1 = { id: 'P1', st: 'town', name: ['鎮報', 'Town Paper'], cred: 60, owner: null, journo: J.agentId, stories: [], fame: 0 }; I18N.registerName('鎮報', 'Town Paper'); I18N.registerName('老周', 'Old Zhou'); w.press.papers = [P1]; w.press.reads = {}; for (const a of [A1, A2, A3]) w.press.reads[a.agentId] = 'P1';
    const T = TIPS.S(w); const fh = DEAL.liveFact(w, 'kitchen', 'hike'); const x1 = TIPS.add(w, { src: 'tip', by: A2.agentId, about: O1.agentId, fid: fh.id }); const C1 = TIPS.start(w, P1, J, x1, false); fix(0, () => TIPS.print(w, P1, J, C1, false));
    const x2 = TIPS.add(w, { src: 'anon', by: A1.agentId, about: O3.agentId, fid: fc.id }); TIPS.start(w, P1, J, x2, false); TIPS.add(w, { src: 'tip', by: A3.agentId, about: O3.agentId, fid: fc.id + 'x', type: 'secret' });
    for (const a of [A1, A2, A3]) UNREST.anger(w, a, OFF, 2, 'snub'); const U = UNREST.S(w); U.call = { d: d - 1, lead: A1.agentId, at: OFF.agentId, who: [A1, A2, A3].map(a => a.agentId), kind: 'hall' }; const E = UNREST.happen(w); const _dr = DECIDE.drain; DECIDE.drain = () => {}; fix(0.99, () => DECIDE.KINDS.hallFaced.options(w, MY, { eid: E.id }).find(o => o.id === 'ignore').run(w, MY));
    U.last = { hall: -99, march: -99 }; UNREST.call(w, A1, MY) || (U.call = { d, lead: A1.agentId, at: MY.agentId, who: [A1.agentId, A2.agentId], kind: 'hall' });
    w.council = w.council || {}; const c0 = { f: w.council._formed, m: w.council.members }; w.council._formed = true; w.council.members = [CM1, CM2, CM3, CM4].map(a => a.agentId); PW.inf[CM1.agentId] = { [O1.agentId]: 60 }; M.owners.timber = CM2.agentId; w.union = w.union || {}; w.union.on = true; w.union.members = w.union.members || {}; w.union.members[CM3.agentId] = 1; w.union.members[CM4.agentId] = 1;
    CAMPS.rebuild(w); CAMPS.setName(w, 'biz', CAMPS.NAMES.biz[0], w.agents[CAMPS.S(w).biz.lead]);
    const dd = { id: 'dead_1', name: '老周', key: 'textile', kind: 'clothes', d, fid: fc.id, cause: '劣質染料中毒', linked: true, kin: [K1.agentId, K2.agentId] }; D.deaths.push(dd); fc.dead = 1; RIOT.S(w).lastDay = null; RIOT.daily(w); const RC = RIOT.S(w).cases.textile; RC.who.push({ id: K1.agentId, act: 'gather' });
    root = show(); const card = (id) => root.querySelector('#ic-' + id); const txt = (id) => card(id)?.textContent || '';
    out.full = { n: +(tabOf(root)?.querySelector('.pp-tab-n')?.textContent || 0), hot: !!tabOf(root)?.querySelector('.pp-tab-n.hot'), cards: [...root.querySelectorAll('.ic-card')].map(c => c.id).join(), shops: root.querySelectorAll('#ic-mk-shops .mk-shop').length, redChips: root.querySelectorAll('#ic-mk-shops .mk-shop .ic-chip.ic-r').length, facts: root.querySelectorAll('#ic-mk-shops .mk-fact').length,
        rules: txt('mk-rules'), press: txt('mk-press'), stories: root.querySelectorAll('#ic-mk-press .mk-story').length, logs: root.querySelectorAll('#ic-mk-press .mk-log li').length, unrest: txt('mk-unrest'), alertU: !!card('mk-unrest')?.querySelector('.ic-alert'), camps: txt('mk-camps'), pills: root.querySelectorAll('#ic-mk-camps .ic-pill').length, riot: txt('mk-riot'), alertR: !!card('mk-riot')?.querySelector('.ic-alert') };
    out.full.all = root.querySelector('.proposals-panel').textContent; const pr = root.getBoundingClientRect(); out.full.overflow = [...root.querySelectorAll('.proposals-panel *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > pr.right + 1 || b.left < pr.left - 1); }).slice(0, 3).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().right - pr.right));
    const bar = root.querySelector('.pp-tabs'); const br = bar.getBoundingClientRect(); out.full.tabs = [...bar.querySelectorAll('.pp-tab')].length; out.full.tabsFit = [...bar.querySelectorAll('.pp-tab')].every(b => { const x = b.getBoundingClientRect(); return x.right <= br.right + 1 && x.left >= br.left - 1; }); out.full.dbg = { sw: bar.scrollWidth, cw: bar.clientWidth, br: [Math.round(br.left), Math.round(br.right)], tabs: [...bar.querySelectorAll('.pp-tab')].map(b => [Math.round(b.getBoundingClientRect().left), Math.round(b.getBoundingClientRect().right)]) }; out.full.minTab = Math.round(Math.min(...[...bar.querySelectorAll('.pp-tab')].map(b => b.getBoundingClientRect().width)));
    // 4) 收合
    const c1 = card('mk-rules'); const o0 = c1.classList.contains('open'); c1.querySelector('.ic-hd').click(); await new Promise(r => setTimeout(r, 50)); out.toggle = { changed: document.getElementById('ic-mk-rules').classList.contains('open') !== o0 }; app.renderSidebar(); out.toggle.kept = document.getElementById('ic-mk-rules').classList.contains('open') !== o0;
    // 點別的分頁再回來
    root.querySelector('.pp-tab[data-pp-tab="props"]').click(); out.switch = { away: !document.getElementById('ic-mk-shops') }; document.querySelector('.pp-tab[data-pp-tab="market"]').click(); out.switch.back = !!document.getElementById('ic-mk-shops');
    DECIDE.drain = _dr; w.council._formed = c0.f; w.council.members = c0.m;
    return out;
  });
  if (SHOT) { try { await page.evaluate(() => { for (const id of ['mk-rules', 'mk-press', 'mk-unrest', 'mk-camps', 'mk-riot']) { const el = document.getElementById('ic-' + id); if (el && !el.classList.contains('open')) el.querySelector('.ic-hd').click(); } }); await page.waitForTimeout(200); await page.screenshot({ path: `${SHOT}_${dev}_${lang}.png`, fullPage: false }); const el = await page.$('#sidebar-content'); if (el) { await page.evaluate(() => { const s = document.getElementById('sidebar-content'); s.scrollTop = 600; }); await page.waitForTimeout(150); await page.screenshot({ path: `${SHOT}_${dev}_${lang}_2.png` }); await page.evaluate(() => { const s = document.getElementById('sidebar-content'); s.scrollTop = 1500; }); await page.waitForTimeout(150); await page.screenshot({ path: `${SHOT}_${dev}_${lang}_3.png` }); } } catch (e) { console.log('  （截圖沒成功：' + String(e.message).split('\n')[0] + '）'); } }
  ok(!r.none.on && !r.none.tab && r.none.fallback, '鎮上沒有私人開的店：沒有「市場」分頁', r.none);
  ok(r.calm.tab && r.calm.n === '0' && r.calm.shops === 3 && r.calm.fair === 3 && /mk-shops/.test(r.calm.cards) && !/mk-unrest|mk-riot/.test(r.calm.cards), '有店家、沒有事：分頁出現，三家都是「照規矩賣」，沒事的卡不出現', r.calm);
  ok(r.full.n >= 4 && r.full.hot && r.full.cards === 'ic-mk-shops,ic-mk-rules,ic-mk-press,ic-mk-unrest,ic-mk-camps,ic-mk-riot', '出事之後：六張卡都在，分頁上的數字亮起來', [r.full.n, r.full.hot, r.full.cards]);
  ok(r.full.shops === 4 && r.full.redChips >= 2 && r.full.facts >= 2, '店家卡：每家一列、動手腳的有紅色標籤，底下列出近期的事與多少人知道', [r.full.shops, r.full.redChips, r.full.facts]);
  ok(zh ? /訂價格上限/.test(r.full.rules) && /市場管理員/.test(r.full.rules) && /稅務員/.test(r.full.rules) : /price cap/i.test(r.full.rules) && /Market Warden/.test(r.full.rules) && /Tax Officer/.test(r.full.rules), '規定與官員卡：三條規定立了沒、誰在當官、哪個位子空著', r.full.rules.slice(0, 200));
  ok(r.full.stories >= 2 && r.full.logs >= 2 && (zh ? /鎮報/.test(r.full.press) : /Town Paper/.test(r.full.press)), '線索與報導卡：記者正在查的、登出來的，每篇有來龍去脈', [r.full.stories, r.full.logs]);
  ok(r.full.alertU && (zh ? /鎮公所/.test(r.full.unrest) : /town hall/i.test(r.full.unrest)), '民怨與街頭卡：有人號召時有警示，列出抗議的經過', r.full.unrest.slice(0, 160));
  ok(r.full.pills >= 4 && (zh ? /商會派/.test(r.full.camps) : /Merchants/.test(r.full.camps)), '陣營卡：兩邊各有誰、叫什麼', r.full.camps.slice(0, 160));
  ok(r.full.alertR && (zh ? /老周/.test(r.full.riot) : /Old Zhou/.test(r.full.riot)), '出人命卡：誰死了、死因傳開了沒、多少人要去', r.full.riot.slice(0, 160));
  ok(r.full.overflow.length === 0 && r.full.tabs === 6 && r.full.tabsFit && r.full.minTab >= (dev === 'mobile' ? 32 : 20), `${dev === 'mobile' ? '390px 手機' : '桌機'}：六個分頁排得下、內容沒有橫向溢出`, [r.full.overflow, r.full.tabs, r.full.tabsFit, r.full.minTab, r.full.dbg]);
  ok(r.toggle.changed && r.toggle.kept && r.switch.away && r.switch.back, '卡片可以收合而且記得住；切到別的分頁再回來還在', [r.toggle, r.switch]);
  ok(zh ? !/\{[a-z]+\}/.test(r.full.all) : !/[一-鿿]/.test(r.full.all) && !/\{[a-z]+\}/.test(r.full.all), '整頁沒有漏翻、沒有沒填的空格', (zh ? r.full.all.match(/\{[a-z]+\}/g) : r.full.all.match(/[一-鿿]+|\{[a-z]+\}/g)) || '');
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
