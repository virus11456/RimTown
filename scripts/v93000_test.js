// v9.30.0 店跟產業分清楚＋開店的兩個問題
//  A. 店種改成不跟七個產業重疊的七種(藥鋪、小酒館、畫坊、說書茶館、首飾鋪、繡坊、古玩鋪)，定價沿用被取代的那一種
//  B. 舊存檔的麵包店／鐵匠鋪／裁縫店／雜貨攤換成新店種：預設店名跟著換、AI 取的店名不動、讀到不認得的店種畫面也不會壞
//  C. 問題一：得跟銀行借、銀行卻借不到(已有欠款、擠兌、沒錢可放、銀行家不肯借)時，不再出「要不要開店」這個選擇；
//             沒開成的原因照實寫；完整智能體模式下大筆貸款等銀行家回話，他點頭店才開(以前錢照借、店沒開)
//  D. 問題二：職業對不上的人，問幾次都是同一種店，開出來的也是那一種(以前每問一次擲一次骰)
//  E. 產業分頁：產業卡與店卡各有一句說明，中英、電腦與手機
// 標了【舊程式失敗】的項目：把 chrome-extension/sim-biz.js 換回 9.29.2 的版本跑，這幾項會失敗；換回新版通過。
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + ' → ' + JSON.stringify(x)); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';
const CJK = /[一-鿿]/;
async function run(browser, lang, vp) {
  console.log(`— ${lang} ${vp.width}px`); const mobile = vp.width <= 768;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
  await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_full_agent', '0'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
  await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; w.observerMode = true; w.fullAgentMode = false; const out = {};
    const npcs = () => Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead); for (let k = 0; k < 96 * 2; k++) { w.paused = false; w.tick(); }
    const sleep = (ms) => new Promise(r2 => setTimeout(r2, ms)); const d = () => w._absDay();
    const BZ = BIZ.S(w); const BK = BANK.S(w); const CE = w.conversationEngine;
    const banker = npcs().find(a => (a.age ?? 30) >= 20 && a.job?.key !== 'mayor');
    const bankOk = () => { BK.open = true; BK.status = 'ok'; BK.banker = banker.agentId; BK.reserve = 3000; BK.dep = {}; BK.loans = {}; BK.refused = {}; };
    const clear = () => { BZ.shops = []; BZ.closed = []; bankOk(); };
    const pool = npcs().filter(a => a !== banker && a.job && a.job.key !== 'mayor' && (a.age ?? 30) >= 20); let pi = 0; const next = () => pool[pi++ % pool.length];
    // 想開店、錢不夠、找不到合夥人的人(沒有人跟他交情好到肯出錢)
    const prep = (a, cashN, jobKey, traits) => { a.personality.traits = traits || ['hardworking']; if (jobKey) a.job.key = jobKey; w.wallet.bal[a.agentId] = cashN; for (const o of npcs()) if (o !== a) o.relationships.getOrCreate(a.agentId, a.name).affinity = 0; delete w.dark?.rep?.[a.agentId]; return a; };
    const zhOf = (s) => BIZ.TYPES[s?.type]?.zh || null;

    // ---------- A. 店種 ----------
    out.keys = Object.keys(BIZ.TYPES).sort(); out.zh = Object.values(BIZ.TYPES).map(T => T.zh); out.price = Object.fromEntries(Object.entries(BIZ.TYPES).map(([k, T]) => [k, T.price]));
    out.sectors = ['farm', 'kitchen', 'textile', 'timber', 'mine', 'forge', 'trade'].map(k => { try { return MARKET.name(k); } catch (e) { return ''; } });
    out.jobs = {}; clear();
    for (const [job, traits] of [['cook', ['hardworking']], ['blacksmith', ['hardworking']], ['tailor', ['hardworking']], ['trader', ['hardworking']], ['doctor', ['hardworking']], ['farmer', ['creative']]]) {
      BZ.shops = []; const a = prep(next(), 200, job, traits); const s = await BIZ.open(w, BZ, a, d()); out.jobs[job + (traits[0] === 'creative' ? '+creative' : '')] = s ? { type: s.type, zh: s.name[0], en: s.name[1], price: s.price, first: a.name.slice(0, 1) } : null; }

    // ---------- B. 舊存檔 ----------
    { clear(); const o = pool.slice(0, 5).map(a => a.agentId); const base = { partner: null, till: 0, week: 0, opened: 1, lossDays: 0, closed: false };
      const data = JSON.parse(JSON.stringify(w.serialize()));
      data.biz = { n: 5, lastDay: null, shops: [
        { ...base, id: 'B1', type: 'bakery', owner: o[0], name: ['王記麵包店', "Wang's Bakery"], price: 3, profit: 12 },
        { ...base, id: 'B2', type: 'smithy', owner: o[1], name: ['爐火不滅', '爐火不滅'], price: 7, profit: 5 },      // AI 取的店名
        { ...base, id: 'B3', type: 'tailor', owner: o[2], name: ['李記裁縫店', "Li's Tailor"], price: 5, profit: 0 },
        { ...base, id: 'B4', type: 'stall', owner: o[3], name: ['陳記雜貨攤', "Chen's Stall"], price: 3, profit: -4 },
        { ...base, id: 'B5', type: 'studio', owner: o[4], name: ['凌記畫坊', "Ling's Studio"], price: 6, profit: 30 } ],
        closed: [{ name: ['趙記麵包店', "Zhao's Bakery"], type: 'bakery', profit: -3, day: 1 }] };
      const w2 = new World(); const loaded = w2.loadSave(JSON.parse(JSON.stringify(data))); let view = null, viewErr = '';
      try { view = BIZ.view(w2); } catch (e) { viewErr = String(e); }
      const logs = (x) => (x.messageLog || []).map(m => String(m.content || '')).filter(c => /換了招牌|changed their signs/.test(c));
      out.mig = { loaded: !!loaded, types: w2.biz.shops.map(s => s.type), zh: w2.biz.shops.map(s => s.name[0]), en: w2.biz.shops.map(s => s.name[1]), prices: w2.biz.shops.map(s => s.price), profit: w2.biz.shops.map(s => s.profit),
        closed: w2.biz.closed.map(c => c.type + '|' + c.name[0]), viewErr, labels: (view?.shops || []).map(s => s.type), log: logs(w2).length };
      const w3 = new World(); w3.loadSave(JSON.parse(JSON.stringify(w2.serialize()))); out.mig.again = { zh: w3.biz.shops.map(s => s.name[0]), types: w3.biz.shops.map(s => s.type), log: logs(w3).length - logs(w2).length };
      // 別的系統塞進來不認得的店種：畫面照樣畫得出來
      clear(); BZ.shops.push({ ...base, id: 'BX', type: 'stall', owner: o[0], name: ['測試攤', 'Test stall'], price: 3, profit: 0 }, { ...base, id: 'BY', type: 'no_such_type', owner: o[1], name: ['怪店', 'Odd shop'], price: 3, profit: 0 });
      try { const V = BIZ.view(w); out.unknown = { ok: true, n: V.shops.length, chip: BIZ.chip(w, w.agents[o[1]]) }; } catch (e) { out.unknown = { ok: false, err: String(e) }; }
      // 店換了招牌，「新事物」登記的名字跟著換
      try { clear(); const s = { ...base, id: 'BT1', type: 'inn', owner: o[0], name: ['舊招牌', 'Old sign'], price: 3, profit: 0 }; BZ.shops.push(s); const X = THINGS.S(w); THINGS.register(w, { kind: 'shop', key: s.id, name: ['舊招牌', 'Old sign'], icon: '🏪', owner: s.owner, tags: {}, ttl: 45 });
        s.name = ['新招牌', 'New sign']; X.lastDay = -1; THINGS.daily(w); out.thing = X.list['shop:BT1']?.name; delete X.list['shop:BT1']; } catch (e) { out.thing = String(e); } }

    // ---------- C. 問題一：借不到就不出這個選擇 ----------
    // 每個情境回報：有沒有出選擇(offered)、選了開不開得成(opened)。「出了卻開不成」就是 bug。
    const tryStart = (a) => { const offered = !!BIZ.startInfo(w, a); const n0 = BZ.shops.length; const s = BIZ.start(w, a); return { offered, opened: !!s && BZ.shops.length === n0 + 1 }; };
    out.c = {};
    { clear(); const a = prep(next(), 20, 'farmer'); BK.loans[a.agentId] = { owed: 22, principal: 20, rate: 0.1, day: d(), due: d() + 20 }; out.c.hasLoan = tryStart(a); }
    { clear(); const a = prep(next(), 35, 'farmer'); BK.status = 'run'; out.c.bankRun = tryStart(a); }
    { clear(); const a = prep(next(), 35, 'farmer'); BK.reserve = 10; out.c.noReserve = tryStart(a); }
    { clear(); const a = prep(next(), 35, 'farmer'); BK.open = false; out.c.noBank = tryStart(a); }
    { clear(); const a = prep(next(), 35, 'farmer'); banker.relationships.getOrCreate(a.agentId, a.name).affinity = -40; out.c.dislike = tryStart(a); banker.relationships.getOrCreate(a.agentId, a.name).affinity = 0; }
    { clear(); const a = prep(next(), 35, 'farmer'); w.dark = w.dark || {}; w.dark.rep = w.dark.rep || {}; w.dark.rep[a.agentId] = { exposed: 2 }; out.c.badRep = tryStart(a); delete w.dark.rep[a.agentId]; }
    { clear(); const a = prep(next(), 35, 'farmer'); const info = BIZ.startInfo(w, a); const t0 = tryStart(a); const L = BK.loans[a.agentId]; out.c.healthy = { ...t0, loan: !!info?.loan, kind: L?.kind || null, due: L ? L.due - d() : null }; }
    // 沒開成的原因照實寫
    out.why = {};
    if (BIZ.startTry) {
      const cap = Math.max(2, Math.floor(npcs().length / 6));
      { clear(); const a = prep(next(), 200, 'farmer'); while (BZ.shops.length < cap) BZ.shops.push({ id: 'F' + BZ.shops.length, owner: 'x' + BZ.shops.length, name: ['測', 'T'], type: 'curio' }); out.why.full = BIZ.startTry(w, a).why; }
      { clear(); const a = prep(next(), 20, 'farmer'); BK.loans[a.agentId] = { owed: 22, principal: 20, rate: 0.1, day: d(), due: d() + 20 }; out.why.noloan = BIZ.startTry(w, a).why; }
      { clear(); const a = prep(next(), 200, 'farmer'); BIZ.startTry(w, a); out.why.gone = BIZ.startTry(w, a).why; } // 已經有店了
    }
    // 題目出了以後情況變了(店位被別人佔滿)：結果寫的是真正的原因
    try { clear(); const K = DECIDE.KINDS; const a = prep(next(), 200, 'farmer'); const c = K.startup.when(w, a); const o = c ? K.startup.options(w, a, c).find(x => x.id === 'open') : null;
      const cap = Math.max(2, Math.floor(npcs().length / 6)); while (BZ.shops.length < cap) BZ.shops.push({ id: 'F' + BZ.shops.length, owner: 'x' + BZ.shops.length, name: ['測', 'T'], type: 'curio' });
      const res = o ? o.run(w, a) : null; out.resText = { asked: !!o, k: res?.k || null, shown: res?.k ? t(res.k) : null }; } catch (e) { out.resText = { err: String(e) }; }
    // 完整智能體模式：大筆貸款等銀行家(AI)回話
    const stub = (resp) => { const s0 = { fa: w.fullAgentMode, ok: CE.fullAgentOk, aj: CE._askJson }; w.fullAgentMode = true; CE.fullAgentOk = () => true; CE._askJson = async (p) => (/銀行家|banker/i.test(String(p)) ? resp : {}); return () => { w.fullAgentMode = s0.fa; CE.fullAgentOk = s0.ok; CE._askJson = s0.aj; }; };
    const mems = (a) => { try { return JSON.stringify(a.memory); } catch (e) { return ''; } };
    { clear(); const a = prep(next(), 20, 'farmer'); const restore = stub({ lend: true, why: 'ok' }); const info = BIZ.startInfo(w, a); const now = BIZ.startTry ? BIZ.startTry(w, a) : { shop: BIZ.start(w, a) };
      for (let i = 0; i < 40 && !BIZ.shopOf(w, a) && !BK.loans[a.agentId]; i++) await sleep(25); await sleep(150); restore(); const L = BK.loans[a.agentId];
      out.askYes = { offered: !!info, loanAsk: info?.loanAsk, rightAway: !!now.shop, why: now.why || null, shop: !!BIZ.shopOf(w, a), loan: !!L, kind: L?.kind || null, due: L ? L.due - d() : null }; }
    { clear(); const a = prep(next(), 20, 'farmer'); const restore = stub({ lend: false, why: 'no' }); const now = BIZ.startTry ? BIZ.startTry(w, a) : { shop: BIZ.start(w, a) }; await sleep(400); restore();
      out.askNo = { why: now.why || null, shop: !!BIZ.shopOf(w, a), loan: !!BK.loans[a.agentId], told: /銀行不肯借我開店|would not lend me the money to open/.test(mems(a)) }; }

    // ---------- D. 問題二：同一個人問幾次都是同一種店 ----------
    { const rows = []; for (let i = 0; i < 12; i++) { clear(); const a = prep(next(), 200, 'farmer'); const seen = new Set(); for (let k = 0; k < 60; k++) seen.add(BIZ.startInfo(w, a)?.type || '?');
        const told = BIZ.startInfo(w, a)?.type; const s = BIZ.start(w, a); rows.push({ kinds: seen.size, told, got: zhOf(s) }); }
      out.stable = { wobble: rows.filter(x => x.kinds !== 1).length, mismatch: rows.filter(x => x.told !== x.got).length, distinct: new Set(rows.map(x => x.got)).size, sample: rows.slice(0, 3) }; }

    // ---------- E. 畫面 ----------
    { clear(); const a = prep(next(), 200, 'cook'); await BIZ.open(w, BZ, a, d());
      if (innerWidth <= 768 && app._openKairoTab) app._openKairoTab('industry'); else { app.activeTab = 'industry'; app.renderSidebar(); } await sleep(350);
      const infos = [...document.querySelectorAll('.ic-info')].map(e => e.textContent);
      out.ui = { ind: infos.find(x => /產業是大家每天都要買|Businesses are the everyday trades/.test(x)) || '', shop: infos.find(x => /店是村民自己開的小生意|Shops are small ventures/.test(x)) || '',
        row: [...document.querySelectorAll('.pp-biz .pg-firm')].map(e => e.textContent).join(' | '), overflow: document.documentElement.scrollWidth - innerWidth }; }
    return out;
  });
  const en = lang === 'en';
  // A
  ok(JSON.stringify(r.keys) === JSON.stringify(['apothecary', 'curio', 'embroidery', 'inn', 'jeweler', 'studio', 'teahouse']), '店種是新的七種，沒有麵包店／鐵匠鋪／裁縫店／雜貨攤', r.keys);
  ok(!r.zh.some(z => ['麵包店', '鐵匠鋪', '裁縫店', '雜貨攤'].includes(z)) && r.sectors.every(s => s && !r.zh.includes(s)), '店名跟七個產業的名字不重複', { zh: r.zh, sectors: r.sectors });
  ok(r.price.teahouse === 3 && r.price.jeweler === 6 && r.price.embroidery === 5 && r.price.curio === 3 && r.price.apothecary === 5 && r.price.inn === 3 && r.price.studio === 6, '定價沿用被取代的店種（3／6／5／3），其他三種不變', r.price);
  ok(r.jobs.cook?.type === 'teahouse' && r.jobs.blacksmith?.type === 'jeweler' && r.jobs.tailor?.type === 'embroidery' && r.jobs.trader?.type === 'curio' && r.jobs.doctor?.type === 'apothecary' && r.jobs['farmer+creative']?.type === 'studio', '廚師開說書茶館、鐵匠開首飾鋪、裁縫開繡坊、商人開古玩鋪、醫生開藥鋪、有創意的開畫坊', r.jobs);
  ok(r.jobs.cook && r.jobs.cook.zh === r.jobs.cook.first + '記說書茶館' && /'s Teahouse$/.test(r.jobs.cook.en) && !CJK.test(r.jobs.cook.en), '新店的預設店名用新店種（中英）', r.jobs.cook);
  // B
  ok(r.mig.loaded && JSON.stringify(r.mig.types) === JSON.stringify(['teahouse', 'jeweler', 'embroidery', 'curio', 'studio']), '舊存檔：麵包店→說書茶館、鐵匠鋪→首飾鋪、裁縫店→繡坊、雜貨攤→古玩鋪，畫坊不動', r.mig);
  ok(r.mig.zh[0] === '王記說書茶館' && r.mig.en[0] === "Wang's Teahouse" && r.mig.zh[2] === '李記繡坊' && r.mig.zh[3] === '陳記古玩鋪' && r.mig.en[3] === "Chen's Curio shop" && r.mig.zh[4] === '凌記畫坊', '舊存檔：照老闆名字取的店名跟著換（中英）', r.mig);
  ok(r.mig.zh[1] === '爐火不滅' && r.mig.en[1] === '爐火不滅', '舊存檔：AI 取的店名不動', r.mig);
  ok(JSON.stringify(r.mig.prices) === JSON.stringify([3, 7, 5, 3, 6]) && JSON.stringify(r.mig.profit) === JSON.stringify([12, 5, 0, -4, 30]), '舊存檔：定價與累計盈虧原封不動', r.mig);
  ok(r.mig.closed[0] === 'teahouse|趙記說書茶館' && !r.mig.viewErr && r.mig.labels.length === 5 && r.mig.labels.every(x => x && (!en || !CJK.test(x))), '舊存檔：倒閉名單也換、店卡畫得出來', r.mig);
  ok(r.mig.log === 1 && r.mig.again.log === 0 && r.mig.again.zh[0] === '王記說書茶館', '舊存檔：日誌寫一次「老店換了招牌」，再存再讀不會重複換', r.mig);
  ok(r.unknown.ok && r.unknown.n === 2 && r.unknown.chip, '讀到不認得的店種，畫面照樣畫得出來', r.unknown);
  ok(Array.isArray(r.thing) && r.thing[0] === '新招牌' && r.thing[1] === 'New sign', '店換了招牌，「新事物」登記的名字跟著換', r.thing);
  // C
  const dead = Object.entries(r.c).filter(([, v]) => v.offered && !v.opened).map(([k]) => k);
  ok(dead.length === 0, '【舊程式失敗】不會出一個選了也開不成的「借錢開店」：已有欠款、擠兌、銀行沒錢可放、銀行沒開、銀行家不肯借', { 出了卻開不成: dead, 全部: r.c });
  ok(!r.c.hasLoan.offered && !r.c.bankRun.offered && !r.c.noReserve.offered && !r.c.noBank.offered && !r.c.dislike.offered && !r.c.badRep.offered, '【舊程式失敗】借不到的六種情況都不出這個選擇', r.c);
  ok(r.c.healthy.offered && r.c.healthy.opened && r.c.healthy.loan && r.c.healthy.kind === 'biz' && r.c.healthy.due >= 45, '銀行借得到時照常：出選擇、借到、店開張、記成 45 天的創業貸款', r.c.healthy);
  ok(r.why.full === 'full' && r.why.noloan === 'noloan' && r.why.gone === 'gone', '沒開成的原因分得出來：店位滿了／銀行借不到／情況變了', r.why);
  ok(r.resText.asked && r.resText.k === '鎮上的店已經夠多了，沒開成' && (!en || !CJK.test(r.resText.shown)), '【舊程式失敗】題目出了以後店位被佔滿：結果寫「店已經夠多」，不再一律寫本錢沒湊齊', r.resText);
  ok(r.askYes.offered && !r.askYes.rightAway && r.askYes.shop && r.askYes.loan && r.askYes.kind === 'biz' && r.askYes.due >= 45, '【舊程式失敗】大筆貸款等銀行家回話：他點頭，店就開，貸款記成創業貸款（以前錢照借、店沒開）', r.askYes);
  ok(r.askYes.loanAsk === true && r.askYes.why === 'wait', '等銀行家回話時，題目有說銀行家不一定答應、當下的結果寫「等銀行家回話」', r.askYes);
  ok(!r.askNo.shop && !r.askNo.loan && r.askNo.told, '銀行家不答應：沒借到、店沒開，本人記得被拒絕', r.askNo);
  // D
  ok(r.stable.wobble === 0, '【舊程式失敗】職業對不上的人，連問 60 次都是同一種店（12 人）', r.stable);
  ok(r.stable.mismatch === 0, '【舊程式失敗】跟他說要開哪一種，開出來就是那一種（12 人）', r.stable);
  ok(r.stable.distinct >= 2, '不同的人挑到的店種不會全部一樣', r.stable);
  // E
  ok(r.ui.ind && r.ui.shop && (!en || (!CJK.test(r.ui.ind) && !CJK.test(r.ui.shop))), '產業分頁：產業卡與店卡各有一句說明', r.ui);
  ok(en ? /Teahouse/.test(r.ui.row) && !CJK.test(r.ui.row) : /說書茶館/.test(r.ui.row), '店卡顯示新店種', r.ui.row);
  ok(r.ui.overflow <= 1, '畫面沒有橫向捲動', r.ui.overflow);
  ok(!errs.length, '沒有錯誤', errs.slice(0, 3));
  await ctx.close();
}
(async () => {
  // 首頁示範文字：發薪水、捐獻金、買報社的是產業老闆(食堂、鐵鋪)，不是店
  const land = fs.readFileSync(path.join(__dirname, '..', 'chrome-extension', 'landing-page.js'), 'utf8');
  ok(!/麵包店老闆|鐵匠鋪老闆|bakery owner|smithy owner/.test(land) && /食堂老闆/.test(land) && /鐵鋪老闆/.test(land), '首頁示範文字：壓工資、捐獻金、買報社的是產業老闆', null);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { await run(browser, 'zh', { width: 1280, height: 800 }); await run(browser, 'en', { width: 1280, height: 800 }); await run(browser, 'zh', { width: 390, height: 800 }); await run(browser, 'en', { width: 390, height: 800 }); }
  finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
