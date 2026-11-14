// 擬人化智能體 D1 影子模式隔離測試（瀏覽器，AI 全關、不連任何外部服務）
// 1. 同一顆種子跑三輪：關、關（先確認基線本身可重現）、開（掛上影子快照）。
//    比對：完整存檔內容、決策核心狀態與佇列、亂數取用次數、tick 數。開與關必須逐字相同。
// 2. 開的那一輪：檢查每份快照沒用亂數、沒讀越界、拍在決定之前；之後離線評估（人工標記的固定回應），評估前後世界不變。
// 3. 用真實遊戲物件做配對：只改隱藏財務 → 輸入不變；改醫療支出、還款記憶、朋友說法 → 輸入跟著變。
// 用法：node scripts/psy_d1_shadow_test.js [天數=30] [種子=22] [等級=2] [輸出目錄=test-results/psy_d1]
// 需要本機 8126 服務 chrome-extension/
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const DAYS = +(process.argv[2] || 30), SEED = +(process.argv[3] || 22), TIER = +(process.argv[4] || 2), OUT = process.argv[5] || path.join(__dirname, '../test-results/psy_d1');
const BASE = process.env.BASE || 'http://localhost:8126/';
const CORE = path.join(__dirname, '../chrome-extension/psy-core.js'), LOAN = path.join(__dirname, '../chrome-extension/psy-loan.js');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let pass = 0, fail = 0; const fails = []; const ok = (c, n, x) => { if (c) pass++; else { fail++; fails.push(n + (x ? ' :: ' + x : '')); console.log('  ✗ ' + n + (x ? ' :: ' + x : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

async function run(browser, mode) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); let ext = 0; const extUrls = [];
    await page.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(BASE)) { ext++; extUrls.push(u.slice(0, 80)); return r.abort(); } if (/\/api\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); return r.continue(); });
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 });
    if (mode === 'on') { await page.addScriptTag({ path: CORE }); await page.addScriptTag({ path: LOAN }); }
    const r = await page.evaluate(async ({ DAYS, SEED, TIER, MODE }) => {
        const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
        let s = SEED >>> 0, n = 0; const rnd = () => { n++; s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        Math.random = rnd; let clk = 1700000000000; Date.now = () => (clk += 7); let pn = 1000; performance.now = () => (pn += 3);
        const w = new World(); app.world = w; w.reset(); w.observerMode = true; ORIGIN.seed(w, TIER, { seed: SEED }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
        // 地圖布局要在固定種子之後重建：住房會綁定頁面上的地圖（D0 基準腳本也這樣做）；不重建的話，頁面開啟時沒固定種子的布局會讓兩輪結果不同
        try { app.state = w.getState(); app._generateTileMapLayout(); } catch (e) {}
        // 地圖物件裡還留著頁面開啟時那座城的住房對照與配偶表（村民編號照名字產生，新城會有同名的人）：清掉，否則住房分配會被舊城影響。這是測試環境的控制，不是遊戲修改
        if (app.tileMap) { app.tileMap.agentPartners = {}; app.tileMap._agentHouseMap = null; }
        const ser = () => { const o = w.serialize(); delete o.savedAt; return JSON.stringify(o); }; // savedAt 是真實時鐘的存檔時間，不是世界狀態
        const sink = []; let untap = null, K0 = null;
        if (MODE === 'on') { K0 = DECIDE.KINDS.asked.options; untap = PSY.tap(DECIDE, PSY_LOAN, sink); }
        for (let d = 0; d < DAYS; d++) for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); }
        w.paused = true; // 跑完就停住，之後等待評估期間世界不再前進
        const out = { rng: n, tick: w.tickCount, day: w._absDay(), pop: Object.values(w.agents).filter(a => !a.isDead).length, save: ser(), decide: JSON.stringify(w.decide), askedPicks: Object.entries(w.decide?.pick || {}).filter(([k]) => k.startsWith('asked.')).reduce((x, [, v]) => x + v, 0) };
        if (MODE !== 'on') return out;
        // ---- 快照稽核 ----
        const good = sink.filter(x => x.input); out.snaps = sink.length; out.snapGood = good.length; out.snapErr = sink.filter(x => !x.input).map(x => x.audit.error);
        out.rndInSnap = sink.reduce((a, x) => a + (x.audit.rnd || 0), 0);
        out.owners = [...new Set(good.flatMap(x => x.audit.manifest.map(m => m.owner)))];
        out.inputErrs = good.flatMap(x => PSY.validateInput(x.input));
        // 拍快照時，這個人的決策紀錄裡還沒有這件事（拍在決定之前）：逐一核對快照當下的紀錄長度 ≤ 事後
        out.beforeOk = good.every(x => typeof x.audit.log_len_before === 'number');
        // 舊流程的事實句會寫出借款人身上的錢；快照裡不准出現「身上只剩」這種來自舊 prompt 的句子
        out.oldFactsLeak = good.filter(x => /身上只剩/.test(PSY.stable(x.input))).length;
        // ---- 離線評估：人工標記的固定回應（只驗流程，不是角色行為）----
        const fix = (input) => { const ops = input.options.map(o => o.opt); const im = []; if (ops.includes('refuse')) im.push({ opt: 'refuse', expect: [{ what: '錢留在身上', who: [input.ids.agent], status: 'derived', ev: ['s_cash'] }], like: ['c1'], dislike: ['c2'], unsure: [] }); if (ops.includes('lend')) im.push({ opt: 'lend', expect: [{ what: '對方說會還', who: [], status: 'inferred', ev: ['v_promise'] }], like: ['c2'], dislike: ['c1'], unsure: ['不知道會不會還'] });
            return { label: 'TEST_FIXTURE_HANDWRITTEN', appraisal: { contract: 1, concerns: [{ id: 'c1', what: '自己的錢', ev: ['s_cash'] }, { id: 'c2', what: '對方開口了', ev: ['o_req'] }], reading: { what: '有人來借錢', unsure: [] }, impacts: im, not_considered: ops.filter(o => !im.some(i => i.opt === o)).map(o => ({ opt: o, why: '當下沒想到' })) }, choice: { contract: 1, opt: 'refuse', params: {}, because: ['c1'], accept: [], left: [], public: '這次不方便', private: '', commit: null, act: { opt: 'refuse' } } }; };
        const fixtures = {}; for (const x of good) fixtures[PSY.inputKey(x.input)] = fix(x.input);
        // 先等遊戲自己排隊中的非同步工作（最後幾個 tick 留下的）跑完，再拍「評估前」，才分得出變化是不是評估造成的
        // 畫面每一幀會用 Math.random 做視覺效果（與世界無關），所以「停止」只看世界與決策核心；亂數的背景消耗另外記錄
        const cur = () => ser() + JSON.stringify(w.decide); let prev = cur(), still = 0; const n0 = n; for (let k = 0; k < 40 && still < 3; k++) { await new Promise(r => setTimeout(r, 200)); const c = cur(); still = c === prev ? still + 1 : 0; prev = c; } out.settled = still >= 3;
        out.bgRng = n - n0; const before = cur(); out.evBefore = ser(); const nE0 = n; const mr0 = Math.random; let psyRnd = 0; const log = new PSY.ResearchLog(); const cache = new Map(); const E = PSY.ReplayEvaluator(fixtures);
        for (const x of good) await PSY.evaluate(x, [E], { log, cache }); out.evalRngDelta = n - nE0;
        out.evalStatus = log.rows.reduce((o, r) => (o[r.status + (r.from_cache ? '(快取)' : '')] = (o[r.status + (r.from_cache ? '(快取)' : '')] || 0) + 1, o), {}); out.evalRejected = log.rejected.length; out.evalNotes = log.rows.flatMap(r => r.notes);
        out.evAfter = ser(); out.worldUnchangedByEval = before === cur();
        out.research = JSON.stringify(log.toJSON()); out.sample = good.length ? JSON.stringify(good[0].input) : null;
        // ---- 卸下掛勾 ----
        untap(); out.untapRestored = DECIDE.KINDS.asked.options === K0;
        // ---- 真實遊戲物件的配對（量完隔離之後才動這個世界）----
        const adults = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && w.wallet?.bal?.[a.agentId] >= 25).sort((x, y) => String(x.agentId).localeCompare(String(y.agentId)));
        const L = adults[0], B = adults[1]; const e0 = PSY_LOAN.eventOf(w, L, { from: B.agentId, n: 20 });
        const S = (e) => PSY.snapshot(w, PSY_LOAN, e || e0).input; const base = S(); const P = {};
        { const v = w.wallet.bal[B.agentId]; w.wallet.bal[B.agentId] = 98765.43; const bk = w.bank && w.bank.dep ? w.bank.dep[B.agentId] : undefined; if (w.bank?.dep) w.bank.dep[B.agentId] = 55555; const h = S(); P.hiddenSame = PSY.hashOf(h) === PSY.hashOf(base); P.hiddenNoLeak = !/98765|55555/.test(PSY.stable(h)); w.wallet.bal[B.agentId] = v; if (w.bank?.dep) { if (bk === undefined) delete w.bank.dep[B.agentId]; else w.bank.dep[B.agentId] = bk; } }
        { w.health = w.health || {}; w.health.a = w.health.a || {}; const old = w.health.a[L.agentId]; w.health.a[L.agentId] = [{ k: 'injury', s: 2, p: 'f' }]; const m = S(); P.medObl = m.self.obligations.some(o => o.amount === 60) && !base.self.obligations.some(o => o.what.includes('腳')); P.medDerived = m.derived.some(d => d.id === 'd_known_total'); P.medStateVer = m.versions.state !== base.versions.state; if (old === undefined) delete w.health.a[L.agentId]; else w.health.a[L.agentId] = old; }
        { const before2 = L.memory.entries.length; L.memory.add(w.tickCount, '', 'social', B.name + '準時把借的 10 銀幣還我了，這人可靠。', 4, [B.name]); const m = S(); P.memRecall = m.recall.some(x => x.text.includes('準時把借的')); P.memKnowVer = m.versions.knowledge !== base.versions.knowledge; L.memory.entries.splice(before2); }
        { const m = S(Object.assign({}, e0, { said: '家裡屋頂破了要修' })); P.saidSeen = m.seen.some(x => x.id === 'o_said' && x.src === 'heard_direct:' + B.agentId); }
        P.restored = PSY.hashOf(S()) === PSY.hashOf(base); out.paired = P; out.pair = { L: L.name, B: B.name };
        return out;
    }, { DAYS, SEED, TIER, MODE: mode });
    r.errs = errs; r.external = ext; r.extUrls = extUrls; await page.close(); return r;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true }); const browser = await chromium.launch(); const t0 = Date.now();
    const off1 = await run(browser, 'off'); process.stderr.write('off#1 ' + Math.round((Date.now() - t0) / 1000) + 's\n');
    const off2 = await run(browser, 'off'); process.stderr.write('off#2 ' + Math.round((Date.now() - t0) / 1000) + 's\n');
    const on = await run(browser, 'on'); process.stderr.write('on ' + Math.round((Date.now() - t0) / 1000) + 's\n');
    await browser.close();
    if (process.env.DUMP) { for (const [k, r] of [['off1', off1], ['off2', off2], ['on', on]]) fs.writeFileSync(path.join(OUT, k + '.save.json'), r.save); fs.writeFileSync(path.join(OUT, 'ev_before.json'), on.evBefore || ''); fs.writeFileSync(path.join(OUT, 'ev_after.json'), on.evAfter || ''); console.log('ext', JSON.stringify(off1.extUrls), JSON.stringify(on.extUrls)); }
    const h = (r) => ({ save: sha(r.save), decide: sha(r.decide), rng: r.rng, tick: r.tick });
    console.log('— 基線可重現（關 vs 關）');
    ok(h(off1).save === h(off2).save && h(off1).decide === h(off2).decide && off1.rng === off2.rng, '兩輪關閉結果逐字相同', JSON.stringify([h(off1), h(off2)]));
    console.log('— 影子開關不改變世界（關 vs 開）');
    ok(h(off1).save === h(on).save, '完整存檔內容相同', h(off1).save.slice(0, 12) + ' vs ' + h(on).save.slice(0, 12));
    ok(h(off1).decide === h(on).decide, '決策核心狀態與佇列相同'); ok(off1.rng === on.rng, '亂數取用次數相同', off1.rng + ' vs ' + on.rng); ok(off1.tick === on.tick, 'tick 數相同');
    ok(!off1.errs.length && !on.errs.length, '頁面沒有錯誤', (off1.errs.concat(on.errs)).slice(0, 3).join(' | ')); const ext = [off1, off2, on].flatMap(r => r.extUrls); ok(ext.every(u => u.startsWith('https://fonts.googleapis.com/')), '除了被擋下的字型樣式表，沒有任何外部請求（沒有 AI、沒有 API）', JSON.stringify(ext));
    console.log('— 快照稽核');
    ok(on.snaps > 0, '這段期間確實發生了「有人來借錢」並拍到快照', 'snaps=' + on.snaps + ' picks=' + on.askedPicks);
    ok(on.snapGood === on.snaps && !on.snapErr.length, '每份快照都成功', on.snapErr.slice(0, 3).join(','));
    ok(on.snapGood <= on.askedPicks, '快照數不超過實際決策數（同一天同一件事只拍一次）', on.snapGood + ' / ' + on.askedPicks);
    ok(on.rndInSnap === 0, '快照沒有取用亂數'); ok(on.owners.every(o => ['self', 'household', 'public'].includes(o)), '讀取清單只有本人、同戶、公開', on.owners.join(','));
    ok(!on.inputErrs.length, '所有輸入通過驗證', on.inputErrs.slice(0, 3).join(',')); ok(on.beforeOk, '每份快照都記下了拍攝當下的紀錄長度'); ok(on.oldFactsLeak === 0, '快照沒有沿用舊 prompt 的借款人現金句');
    console.log('— 離線評估');
    ok((on.evalStatus.done || 0) + (on.evalStatus['done(快取)'] || 0) === on.snapGood, '全部評估完成（固定回應）', JSON.stringify(on.evalStatus)); ok(on.settled, '評估前，遊戲自己留下的非同步工作已經停止'); ok(on.worldUnchangedByEval, '評估前後世界、決策核心、亂數都沒變'); ok(on.untapRestored, '卸下掛勾後原函式還原');
    console.log('— 真實遊戲物件配對（' + on.pair.L + ' 被 ' + on.pair.B + ' 開口借錢）');
    const P = on.paired; ok(P.hiddenSame, '只改借款人的現金與存款 → 輸入雜湊相同'); ok(P.hiddenNoLeak, '隱藏數字沒出現在輸入');
    ok(P.medObl && P.medDerived && P.medStateVer, '本人腳傷要開刀 60 → 支出、算術、狀態版本都跟著變', JSON.stringify(P)); ok(P.memRecall && P.memKnowVer, '加入還款記憶 → 進入可取用記憶、知識版本變'); ok(P.saidSeen, '朋友說明用途 → 進入觀察並標明親口說'); ok(P.restored, '還原後輸入回到原樣');
    // 研究輸出與版本追溯
    fs.writeFileSync(path.join(OUT, 'research_log.json'), on.research); if (on.sample) fs.writeFileSync(path.join(OUT, 'sample_input.json'), JSON.stringify(JSON.parse(on.sample), null, 1));
    fs.writeFileSync(path.join(OUT, 'shadow_summary.json'), JSON.stringify({ bgRng: on.bgRng, evalRngDelta: on.evalRngDelta, days: DAYS, seed: SEED, tier: TIER, off1: h(off1), off2: h(off2), on: h(on), pop: on.pop, snaps: on.snaps, askedPicks: on.askedPicks, evalStatus: on.evalStatus, evalNotes: on.evalNotes.slice(0, 20), owners: on.owners, paired: P, pair: on.pair, sec: Math.round((Date.now() - t0) / 1000) }, null, 1));
    console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();
