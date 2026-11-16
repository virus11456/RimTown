// v10.7.0 公庫財政：公庫留得住錢
//   1) 固定支出＝公職薪水＋建築維護＋每天還的債；安全存量＝30 天的固定支出（至少 300）
//   2) 可以動用的錢：超過安全存量的全部＋「10 天門檻到安全存量之間」的四分之一；不到 10 天是 0
//   3) 「公庫超過 300 每天自動花掉 8%」取消
//   4) 稅率：不夠付 10 天而且不是正在回升 → 提加稅（說明寫出夠付幾天）；夠付 45 天以上而且窮人多 → 才提減稅；介於中間不提
//   5) 沒開 AI 時的投票：公庫吃緊，領公庫薪水的人贊成加稅、反對減稅
//   6) 公共工程、生活補助用「可以動用的錢」當門檻
//   7) 公庫的帳：每一筆進出依原因歸類，最近 30 天的每日平均；超過 30 天的丟掉
//   8) 小鎮概況的「公庫」卡；吃緊時進「今天要注意」；AI 的鎮況寫出夠付幾天
//   9) 存讀檔；中英
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
async function run(browser, dev, lang) {
  console.log(`${dev} ${lang}`);
  const ctx = await browser.newContext(dev === 'mobile' ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '', settings: null, success: true }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { timeout: 90000 }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; clearInterval(app._autoSaveInterval); app._showSeasonRecap = () => {}; app._gameAlert = () => {}; app._showCornerNotice = () => {};
    const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {}; const P = w.proposals; const sp = w.stockpile; const T = TREASURY;
    const runDay = () => { const d0 = w._absDay(); for (let i = 0; i < 300 && w._absDay() === d0; i++) { w.paused = false; w.tick(); } w.paused = true; };
    runDay(); // 讓錢包、產業、工資都就位
    const A = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead);
    const clearTax = () => { P.items = (P.items || []).filter(p => !(['tax', 'stipend'].includes(p.kind) && ['open', 'shelved', 'approved'].includes(p.status))); };
    const rnd0 = Math.random; const fix = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = rnd0; } };
    const setFx = (v) => { T.S(w).fx = v; }; const setS = (v) => { sp.resources.silver = v; };
    out.ver = RIMTOWN_APP_VERSION;
    // 1) 固定支出
    const st = T.staff(w); const W = w.wallet; const pay = Math.round(st.reduce((s, a) => s + Math.max(W.minWage || 0, WALLET.wageOf(a) * (1 - W.tax)), 0) * 100) / 100;
    const b0 = w.buildings.completed.slice(); const TP = BUILDING_TEMPLATES; w.buildings.completed = [{ id: 'x1', name: TP.granary.name, buildingKey: 'granary', level: 2, effects: {} }, { id: 'x2', name: TP.bank.name, buildingKey: 'bank', level: 1, effects: {} }];
    out.fixed = { staff: st.length, pub: st.every(a => WALLET.WAGE[a.job?.key] && !MARKET.privatePaid(w, a)), pay: T.payroll(w), payCalc: pay, up: T.upkeep(w), debt0: T.debt(w), now: T.fixedNow(w) };
    w.bank = w.bank || {}; const debt0 = w.bank.debt; w.bank.debt = { owed: 400, paid: 0 }; out.fixed.debt = T.debt(w); out.fixed.now2 = T.fixedNow(w); w.bank.debt = debt0; w.buildings.completed = b0;
    // 2) 安全存量、夠付幾天、可以動用的錢
    setFx(100);
    const at = (s) => { setS(s); return { days: T.days(w), low: T.low(w), high: T.high(w), spare: T.spare(w), budget: T.budget(w), res: T.reserve(w) }; };
    out.lv = { a: at(500), b: at(2000), c: at(4000), d: at(4500) }; setFx(3); out.lv.min = at(100).res; setFx(100);
    // 3) 自動花掉 8% 取消：公庫 5000，跑一整天，不該有「公共開支」
    setS(5000); const seen = []; const c0 = sp.consume; sp.consume = function (r, n, tick, why, src) { if (r === 'silver') seen.push(String(why)); return c0.call(this, r, n, tick, why, src); };
    runDay(); sp.consume = c0; out.sink = { any: seen.includes(t('公共開支')), upkeep: seen.includes(t('建築維護')) || w.buildings.completed.length === 0, pay: seen.includes(t('發薪水')) };
    // 4) 稅率提案
    const d = w._absDay(); const C = CIVIC.S(w); const tryTax = () => { clearTax(); C.lastTax = -99; return CIVIC.taxProposal(w, C, d) || null; };
    W.tax = 0.1; W.shortDay = -99; const poorAll = () => { for (const a of A) W.bal[a.agentId] = 2; }; const richAll = () => { for (const a of A) W.bal[a.agentId] = 80; };
    setFx(100); richAll();
    const falling = () => { const L = T.S(w).led = {}; for (let i = 0; i < 7; i++) L[d - i] = { '+goods': 50, '-pay': 80 }; }; const rising = () => { const L = T.S(w).led = {}; for (let i = 0; i < 7; i++) L[d - i] = { '+goods': 90, '-pay': 80 }; };
    setS(500); T.S(w).led = {}; let p = tryTax(); out.taxNoData = p ? p.dir : null; out.trendNoData = T.trend(w);  // 帳還不滿 5 天：看不出趨勢，先不加
    rising(); p = tryTax(); out.taxRising = p ? p.dir : null; out.trendUp = T.trend(w);                          // 公庫低但每天都在進帳：不加
    falling(); out.trendDown = T.trend(w); p = tryTax(); out.taxUp = { dir: p?.dir, n: p?.newTax, desc: p ? P._fill(p.dk, p.dp) : '' };
    poorAll(); setS(2000); p = tryTax(); out.taxMid = p ? p.dir : null;          // 夠付 20 天：窮人再多也不減稅（以前每人 8 銀幣就減）
    setS(4600); p = tryTax(); out.taxDown = p ? p.dir : null;                     // 夠付 46 天＋窮人多：才減稅
    richAll(); setS(4600); p = tryTax(); out.taxRich = p ? p.dir : null;          // 夠付 46 天但沒有窮人：不提
    W.shortDay = d - 2; setS(4600); p = tryTax(); out.taxShort = p ? p.dir : null; W.shortDay = -99; // 最近發不出薪水：加稅
    // 5) 投票
    const pub = A.find(a => MARKET.PUBLIC.includes(a.job?.key) && a.job.key !== 'mayor' && !MARKET.privatePaid(w, a)); const priv = A.find(a => !MARKET.PUBLIC.includes(a.job?.key) && !(a.personality?.traits || []).some(x => ['hardworking', 'stoic'].includes(x)));
    setS(500); W.bal[priv.agentId] = 100;
    out.vote = { pubUp: CIVIC.taxVote(w, { dir: 'up' }, pub), pubDown: CIVIC.taxVote(w, { dir: 'down' }, pub), privUpNo: fix(0.9, () => CIVIC.taxVote(w, { dir: 'up' }, priv)), privUpYes: fix(0.1, () => CIVIC.taxVote(w, { dir: 'up' }, priv)) };
    setS(4600); out.vote.calmUp = fix(0.5, () => CIVIC.taxVote(w, { dir: 'up' }, pub)); out.vote.calmDown = fix(0.1, () => CIVIC.taxVote(w, { dir: 'down' }, pub));
    // 6) 公共工程與生活補助
    const works = (s) => { setS(s); const b = sp.get('silver'); try { CYCLE.publicWorks(w, CYCLE.S(w), A.length); } catch (e) { return 'ERR ' + e.message; } return Math.round(b - sp.get('silver')); };
    out.works = { low: works(900), mid: works(2000), high: works(4000) };
    poorAll(); const stip = (s) => { setS(s); P._cd = {}; clearTax(); try { return (P._candidates(w, w._absDay()) || []).some(c => c.kind === 'stipend'); } catch (e) { return 'ERR ' + e.message; } };
    out.stip = { low: stip(900), mid: stip(1200), high: stip(4000), n: A.filter(a => (W.bal[a.agentId] || 0) < 8).length }; richAll();
    // 7) 公庫的帳
    T.S(w).led = {}; setS(1000); const dd = w._absDay();
    sp.add('silver', 40, w.tickCount, t('營業稅')); sp.add('silver', 30, w.tickCount, t('營利事業所得稅')); sp.add('silver', 10, w.tickCount, t('所得稅')); sp.add('silver', 25, w.tickCount, t('商人出口的貨款')); sp.add('silver', 5, w.tickCount, t('賣出') + 'plank');
    sp.add('silver', 7, w.tickCount, t('{a}買爵位').replace('{a}', A[0].name)); sp.add('wood', 99, w.tickCount, 'x');
    sp.consume('silver', 60, w.tickCount, t('發薪水')); sp.consume('silver', 8, w.tickCount, t('建築維護')); sp.consume('silver', 12, w.tickCount, t('生活補助')); sp.consume('silver', 99999, w.tickCount, t('發薪水')); // 最後一筆不夠扣，不該記
    const led = T.S(w).led[dd] || {}; out.led = { raw: led, sum: T.ledger(w) };
    T.S(w).led[dd - 40] = { '+goods': 999 }; T.S(w).lastDay = -1; T.daily(w); out.led.old = (dd - 40) in T.S(w).led; out.led.kept = dd in T.S(w).led;
    // 8) 卡片與 AI 鎮況
    const card = (s, short) => { setS(s); W.shortDay = short ? w._absDay() : -99; W.unpaid = short ? 3 : 0; app._icAlerts = []; const h = app._icTreasury(); const al = app._icAlerts.slice(); app._icAlerts = null; const el = document.createElement('div'); el.innerHTML = h; return { chip: el.querySelector('.ic-chip')?.textContent || '', tone: (el.querySelector('.ic-chip')?.className || '').replace(/.*ic-(\w)$/, '$1'), kpis: el.querySelectorAll('.ic-kpi').length, alert: el.querySelector('.ic-alert')?.textContent?.trim() || '', n: al.length, text: el.textContent.replace(/\s+/g, ' ').slice(0, 900), bar: el.querySelector('.ic-bar i')?.style.width || '' }; };
    setFx(100); out.card = { low: card(500), mid: card(2000), ok: card(4000), owe: card(2000, true) }; W.shortDay = -99; W.unpaid = 0;
    app.state = w.getState(); app._kairoCardOpen = true; app.activeTab = 'economy'; try { app.renderSidebar(); } catch (e) { out.renderErr = e.message; } await new Promise(r => setTimeout(r, 400));
    const el = document.getElementById('ic-treasury'); out.dom = { has: !!el, over: el ? el.scrollWidth > el.clientWidth + 2 : null };
    setS(2000); const ce = w.conversationEngine; try { out.brief = ce._townBrief(w); } catch (e) { out.brief = 'ERR ' + e.message; } out.brief2 = T.brief(w);
    // 9) 存讀檔
    const fx = T.S(w).fx; const data = JSON.parse(JSON.stringify(w.serialize())); w.treasury = null; w.loadSave(data); out.save = { fx: w.treasury?.fx === fx, led: Object.keys(w.treasury?.led || {}).length > 0 };
    return out;
  });
  const zh = lang === 'zh';
  ok(/^\d+\.\d+\.\d+$/.test(r.ver), '讀得到版本號', r.ver);
  ok(r.fixed.staff > 0 && r.fixed.pub && Math.abs(r.fixed.pay - r.fixed.payCalc) < 0.02, '公職薪水＝領公庫薪水的人扣稅後的工資總和', r.fixed);
  ok(r.fixed.up === 8 && r.fixed.debt0 === 0 && Math.abs(r.fixed.now - (r.fixed.pay + 8)) < 0.02, '建築維護：一般 2×等級、大型 4；固定支出＝薪水＋維護', r.fixed);
  ok(r.fixed.debt === 12 && Math.abs(r.fixed.now2 - (r.fixed.pay + 8 + 12)) < 0.02, '有紓困債時，每天要還的也算固定支出', r.fixed);
  ok(r.lv.a.res === 3000 && r.lv.min === 300, '安全存量＝30 天的固定支出，至少 300', { r: r.lv.a.res, m: r.lv.min });
  ok(r.lv.a.days === 5 && r.lv.a.low && r.lv.a.budget === 0, '夠付 5 天：吃緊，可以動用的錢是 0', r.lv.a);
  ok(r.lv.b.days === 20 && !r.lv.b.low && r.lv.b.spare === 0 && r.lv.b.budget === 250, '夠付 20 天：還在存，有一小筆可以動用（250）', r.lv.b);
  ok(r.lv.c.spare === 1000 && r.lv.c.budget === 1500 && !r.lv.c.high, '超過安全存量：多的全部可以動用', r.lv.c);
  ok(r.lv.d.high, '夠付 45 天算寬裕', r.lv.d);
  ok(r.sink.any === false && r.sink.pay, '公庫 5000 跑一整天：沒有自動花掉的「公共開支」，薪水照發', r.sink);
  ok(r.taxUp.dir === 'up' && Math.abs(r.taxUp.n - 0.15) < 1e-9 && (zh ? /只夠付 5 天/.test(r.taxUp.desc) : /5 days/.test(r.taxUp.desc)), '不夠付 10 天：提加稅，說明寫出只夠付幾天', r.taxUp);
  ok(r.taxNoData === null && r.trendNoData === null && r.taxRising === null && r.trendUp === 10 && r.trendDown === -30, '公庫低但正在回升（或帳還不滿 5 天）：不急著加稅', { a: r.taxNoData, b: r.taxRising, u: r.trendUp, d: r.trendDown });
  ok(r.taxMid === null, '夠付 20 天：窮人再多也不提減稅', r.taxMid);
  ok(r.taxDown === 'down', '夠付 45 天以上而且窮人多：才提減稅', r.taxDown);
  ok(r.taxRich === null, '公庫寬裕但沒有窮人：不提', r.taxRich);
  ok(r.taxShort === 'up', '最近發不出薪水：公庫看起來有錢也提加稅', r.taxShort);
  ok(r.vote.pubUp === 'for' && r.vote.pubDown === 'against', '公庫吃緊：領公庫薪水的人贊成加稅、反對減稅', r.vote);
  ok(r.vote.privUpNo === 'against' && r.vote.privUpYes === 'for', '公庫吃緊：其他人看各自的想法', r.vote);
  ok(r.vote.calmUp === 'against' && r.vote.calmDown === 'for', '公庫不吃緊：沒有理由加稅', r.vote);
  ok(r.works.low === 0 && r.works.mid > 0 && r.works.high > r.works.mid, '公共工程：不到 10 天不撥，有可以動用的錢才撥，越多撥越多', r.works);
  ok(r.stip.n >= 3 && r.stip.low === false && r.stip.high === true, '生活補助：公庫吃緊不發，有可以動用的錢才提', r.stip);
  ok(r.led.raw['+tax_sales'] === 40 && r.led.raw['+tax_corp'] === 30 && r.led.raw['+tax_income'] === 10 && r.led.raw['+goods'] === 30 && r.led.raw['+other'] === 7, '公庫的帳：收入依原因歸類（稅、賣貨、其他）', r.led.raw);
  ok(r.led.raw['-pay'] === 60 && r.led.raw['-upkeep'] === 8 && r.led.raw['-relief'] === 12, '公庫的帳：支出依原因歸類；扣不到的不記', r.led.raw);
  ok(r.led.sum.inSum === 117 && r.led.sum.outSum === 80 && r.led.sum.days === 1, '每日平均加總正確', r.led.sum);
  ok(r.led.old === false && r.led.kept === true, '超過 30 天的帳丟掉', r.led);
  ok(r.card.low.tone === 'y' && r.card.low.alert && r.card.low.n === 1 && r.card.low.kpis === 3, '卡片：吃緊時黃色標籤、有警示、進「今天要注意」', r.card.low);
  ok(r.card.mid.tone === 'n' && !r.card.mid.alert && r.card.mid.n === 0 && r.card.mid.bar === '67%', '卡片：還在存時不吵，進度條顯示離安全存量多遠', r.card.mid);
  ok(r.card.ok.tone === 'g' && r.card.ok.bar === '100%', '卡片：存量充足是綠色', r.card.ok);
  ok(r.card.owe.tone === 'r' && r.card.owe.alert, '卡片：發不出全薪是紅色', r.card.owe);
  ok(zh ? /公庫/.test(r.card.mid.text) && /公職薪水/.test(r.card.mid.text) && /每天結餘/.test(r.card.mid.text) : /Treasury/.test(r.card.mid.text) && /Public wages/.test(r.card.mid.text) && /Daily balance/.test(r.card.mid.text), '卡片內容：固定支出、收入支出、每天結餘', r.card.mid.text.slice(0, 300));
  ok(!zh || !/[A-Za-z]{6,}/.test(r.card.mid.text.replace(/plank|silver/g, '')), '中文卡片裡沒有漏翻的英文', r.card.mid.text.match(/[A-Za-z]{6,}/g));
  ok(zh || !/[一-鿿]/.test(r.card.mid.text), '英文卡片裡沒有漏翻的中文', (r.card.mid.text.match(/[一-鿿]+/g) || []).slice(0, 6));
  ok(r.dom.has && r.dom.over === false && !r.renderErr, '小鎮概況畫得出「公庫」卡，這個寬度不會橫向溢出', { d: r.dom, e: r.renderErr });
  ok(zh ? /夠付 20 天/.test(r.brief) && /夠付 20 天/.test(r.brief2) : /20 days/.test(r.brief) && /20 days/.test(r.brief2), 'AI 的鎮況寫出公庫夠付幾天', { a: r.brief.slice(0, 160), b: r.brief2 });
  ok(r.save.fx && r.save.led, '存讀檔後紀錄還在', r.save);
  ok(errs.length === 0, '沒有頁面錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(browser, 'mobile', 'zh'); await run(browser, 'desktop', 'en');
  await browser.close();
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
