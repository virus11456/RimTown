// 擬人化智能體 D1 影子模式隔離測試（瀏覽器；不連任何外部服務、不呼叫任何真的 AI）
// A. AI 關閉：同一顆種子跑三輪「關、關、開」。比對完整存檔（扣 savedAt）、決策核心狀態與佇列、亂數取用次數、tick 數。
// B. AI 開啟：同樣三輪，但決策核心的 AI 呼叫換成本機的固定回應（不連網）。回應依呼叫順序：立即、隔天、兩天後才回，
//    走到非同步返回、同一請求重複列出選項、等待期間處境改變、逾時改照個性決定等路徑。固定回應裡有不同的選擇（a／b 輪流），
//    只用來走流程：不是備援、也不是任何角色的行為結果。
//    （固定回應的內容與釋放時機兩輪完全相同，所以「關 vs 開」仍是公平比較。）
// 兩組都裝同一套「測試記錄器」：記下『列出選項』與『執行選項』的先後，用來實際核對快照拍在執行之前（三輪都裝，比對仍公平）。
// C. 開的那一輪：快照稽核、離線評估（評估期間的亂數呼叫逐一記錄堆疊，看是不是來自 D1 檔案）、真實遊戲物件配對、
//    第二個情境「店面失火求助」。
// 第二個情境（店面失火）本輪暫停驗收：FIRE=1 才跑。
// 用法：node scripts/psy_d1_shadow_test.js [天數=30] [種子=22] [等級=2] [輸出目錄=test-results/psy_d1]   需要本機 8126 服務 chrome-extension/
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const DAYS = +(process.argv[2] || 30), SEED = +(process.argv[3] || 22), TIER = +(process.argv[4] || 2), OUT = process.argv[5] || path.join(__dirname, '../test-results/psy_d1');
const BASE = process.env.BASE || 'http://localhost:8126/';
const PSY_FILES = ['psy-core.js', 'psy-world.js', 'psy-loan.js', 'psy-fire.js']; const RUN_FIRE = process.env.FIRE === '1';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let pass = 0, fail = 0; const fails = []; const ok = (c, n, x) => { if (c) pass++; else { fail++; fails.push(n + (x ? ' :: ' + x : '')); console.log('  ✗ ' + n + (x ? ' :: ' + x : '')); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

async function run(browser, { tap, ai }) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); const extUrls = []; const apiPaths = {};
    await page.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(BASE)) { extUrls.push(u.slice(0, 80)); return r.abort(); } if (/\/api\//.test(u)) { const k = r.request().method() + ' ' + u.replace(/\?.*/, '').replace(BASE.replace(/\/$/, ''), ''); apiPaths[k] = (apiPaths[k] || 0) + 1; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }); } const pathname = decodeURIComponent(new URL(u).pathname).replace(/^\/+/, ''); const root = path.resolve(__dirname, '../chrome-extension'); const file = path.resolve(root, pathname); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return r.fulfill({ status: 404, body: '' }); const ext = path.extname(file); const types = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }; return r.fulfill({ status: 200, contentType: types[ext] || 'application/octet-stream', body: fs.readFileSync(file) }); });
    await page.addInitScript(({ jwt }) => { localStorage.setItem('rimtown-lang', 'zh'); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 120000 });
    if (tap) for (const f of PSY_FILES) await page.addScriptTag({ url: BASE + f }); // 用網址載入，堆疊裡才看得出呼叫來自哪個檔案
    const r = await page.evaluate(async ({ DAYS, SEED, TIER, TAP, AI, FIRE }) => {
        const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; app._gameAlert = () => {}; app._showCornerNotice = () => {};
        let s = SEED >>> 0, n = 0; const seeded = () => { n++; s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        Math.random = seeded; let clk = 1700000000000; Date.now = () => (clk += 7); let pn = 1000; performance.now = () => (pn += 3);
        const w = new World(); app.world = w; w.reset(); w.observerMode = true; ORIGIN.seed(w, TIER, { seed: SEED }); w.observerMode = true; w.fullAgentMode = false; WALLET.S(w);
        try { app.state = w.getState(); app._generateTileMapLayout(); } catch (e) {}
        // 測試環境控制：地圖物件留著頁面開啟時那座城的住房對照與配偶表（村民編號照名字產生），清掉；不是遊戲修改
        if (app.tileMap) { app.tileMap.agentPartners = {}; app.tileMap._agentHouseMap = null; }
        const ser = () => { const o = w.serialize(); delete o.savedAt; return JSON.stringify(o); }; // savedAt 是真實時鐘
        // B：AI 開啟。決策核心與其他系統的 AI 呼叫都換成立即回覆的固定內容（人工標記；不是角色行為，也不連網）
        let aiCalls = 0, closing = false; const held = []; const lagN = [0, 0, 0]; const dayNow = () => w._absDay();
        const drainMicro = async () => { for (let k = 0; k < 400; k++) await Promise.resolve(); }; // 只跑微任務：不讓計時器插隊，兩輪的先後才會一樣
        const release = async (all) => { const due = held.filter(h => all || h.due <= dayNow()); for (const h of due) { held.splice(held.indexOf(h), 1); h.res(); } if (due.length) await drainMicro(); return due.length; };
        if (AI) { const ce = w.conversationEngine; w.fullAgentMode = true; ce.fullAgentOk = () => true;
            ce._askJson = (prompt, n) => { const i = aiCalls++; const rows = [1, 2, 3, 4, 5, 6].map(k => ({ n: k, pick: (i + k) % 2 ? 'a' : 'b', why: '（測試固定回應 TEST_FIXTURE_HANDWRITTEN）', next: '' })); const lag = closing ? 0 : i % 3; lagN[lag]++;
                if (!lag || closing) return Promise.resolve(rows); /* 收尾時一律立即回，避免放掉的回應又引出新的等待 */ return new Promise(res => held.push({ due: dayNow() + lag, res: () => res(rows) })); };
            if (ce.llm) ce.llm.generate = async () => '__ERROR__'; }
        // 測試記錄器（三輪都裝）：記下「有人來借錢」的選項何時列出、何時執行
        // 每個請求（引擎傳進來的 ctx 物件）給一個測試用編號，用來核對「這次執行之前，最近一次列出選項時有沒有拍快照（或判定沒變而略過）」
        const order = []; const K = DECIDE.KINDS.asked; const orig = K.options; const cidOf = new WeakMap(); let cidN = 0, lastCid = null;
        K.options = function (w2, a, ctx) { const opts = orig.apply(this, arguments); let cid = cidOf.get(ctx); if (!cid) { cid = 'c' + (++cidN); cidOf.set(ctx, cid); } lastCid = cid; order.push(['opts', a.agentId, dayNow(), cid]);
            for (const op of opts) { const r0 = op.run; op.run = function () { order.push(['run', a.agentId, dayNow(), cid, op.id]); return r0.apply(this, arguments); }; } return opts; };
        const sink = []; const sinkRec = { push: (x) => { order.push(['snap', x?.input?.ids?.agent || '?', dayNow(), lastCid, x?.input?.ids?.event || '?', x?.audit?.version ?? null]); return sink.push(x); }, onSkip: (x) => order.push(['skip', x.agent, dayNow(), lastCid, x.event]) };
        let untap = null, K1 = null; if (TAP) { K1 = K.options; untap = PSY.tap(DECIDE, PSY_LOAN, sinkRec); }
        let released = 0;
        for (let d = 0; d < DAYS; d++) { if (AI) released += await release(false); for (let i = 0; i < 96; i++) { w.paused = false; w.tick(); } if (AI) await drainMicro(); }
        w.paused = true; if (AI) { closing = true; for (let k = 0; k < 20 && held.length; k++) released += await release(true); await drainMicro(); await DECIDE.flush(); } // 收尾：還沒回的一次放掉，所有回話都處理完再比較
        const optsByKey = {}; for (const e of order) if (e[0] === 'opts') { const k = e[3]; optsByKey[k] = (optsByKey[k] || 0) + 1; }
        const relistDays = {}; for (const e of order) if (e[0] === 'opts') (relistDays[e[3]] = relistDays[e[3]] || new Set()).add(e[2]);
        const out = { rng: n, tick: w.tickCount, pop: Object.values(w.agents).filter(a => !a.isDead).length, save: ser(), decide: JSON.stringify(w.decide), aiCalls, aiDecisions: w.decide?.st?.ai || 0,
            askedPicks: Object.entries(w.decide?.pick || {}).filter(([k]) => k.startsWith('asked.')).reduce((x, [, v]) => x + v, 0), optsTwice: Object.values(optsByKey).filter(v => v >= 2).length,
            relistOtherDay: Object.values(relistDays).filter(s => s.size >= 2).length, lagN, released, heldLeft: held.length, aiMiss: w.decide?.st?.aiMiss || 0, requests: cidN,
            runs: order.filter(e => e[0] === 'run').length,
            orderNoSnap: JSON.stringify(order.filter(e => e[0] !== 'snap' && e[0] !== 'skip')) };
        if (!TAP) return out;
        // ---- 快照稽核 ----
        const good = sink.filter(x => x.input); out.snaps = sink.length; out.snapGood = good.length; out.snapErr = sink.filter(x => !x.input).map(x => x.audit.error);
        out.rndInSnap = sink.reduce((a, x) => a + (x.audit.rnd || 0), 0);
        out.owners = [...new Set(good.flatMap(x => x.audit.manifest.map(m => m.owner)))];
        out.inputErrs = good.flatMap(x => PSY.validateInput(x.input));
        out.oldFactsLeak = good.filter(x => /身上只剩/.test(PSY.stable(x.input))).length;
        // 實際核對（依請求編號）：
        //  1. 每份快照都緊接在同一請求的「列出選項」之後
        //  2. 每次執行之前，同一請求最近一次列出選項時，有拍快照或判定處境沒變而略過（快照確實在這次決定執行之前）
        //  3. 同一請求只對應一個事件編號；版本 0、1、2…連續；相鄰版本的輸入不同（沒變就不重拍）
        let afterOpts = 0, runCovered = 0, runTotal = 0, laterRun = 0; const evOfCid = {}, verOfEv = {}; let cidEvBad = 0, verBad = 0;
        order.forEach((e, i) => {
            if (e[0] === 'snap' || e[0] === 'skip') { const p = order[i - 1]; if (p && p[0] === 'opts' && p[3] === e[3]) afterOpts++; }
            if (e[0] === 'snap') { if (evOfCid[e[3]] && evOfCid[e[3]] !== e[4]) cidEvBad++; evOfCid[e[3]] = e[4]; const vs = verOfEv[e[4]] || (verOfEv[e[4]] = []); if (e[5] !== vs.length) verBad++; vs.push(e[5]); if (order.slice(i + 1).some(x => x[0] === 'run' && x[3] === e[3])) laterRun++; }
            if (e[0] === 'run') { runTotal++; let j = i - 1; while (j >= 0 && !(order[j][0] === 'opts' && order[j][3] === e[3])) j--; const nx = order[j + 1]; if (j >= 0 && nx && (nx[0] === 'snap' || nx[0] === 'skip') && nx[3] === e[3]) runCovered++; }
        });
        const skips = order.filter(e => e[0] === 'skip').length; const vers = good.filter(x => x.audit.version > 0);
        const byEv = {}; for (const x of good) (byEv[x.input.ids.event] = byEv[x.input.ids.event] || []).push(x); let adjSame = 0; for (const L0 of Object.values(byEv)) for (let k = 1; k < L0.length; k++) if (PSY.inputKey(L0[k].input) === PSY.inputKey(L0[k - 1].input)) adjSame++;
        Object.assign(out, { snapAfterOpts: afterOpts, snapAndSkip: good.length + skips, runCovered, runTotal, snapWithLaterRun: laterRun, cidEvBad, verBad, skips, versionsGt0: vers.length, adjSame, supersedesOk: vers.every(x => x.audit.supersedes === x.input.ids.event + '#v' + (x.audit.version - 1)), decisionsUnique: new Set(good.map(x => x.input.ids.decision)).size === good.length });
        out.versionDiff = vers.length ? (() => { const v = vers[0]; const prev = byEv[v.input.ids.event][v.audit.version - 1]; return PSY.diff(prev.input, v.input).map(d => d.path).slice(0, 12); })() : [];
        // ---- 離線評估（人工標記的固定回應，只驗流程）----
        const fix = (input) => { const ops = input.options.map(o => o.opt); const im = []; if (ops.includes('refuse')) im.push({ opt: 'refuse', expect: [{ what: '錢留在身上', who: [input.ids.agent], status: 'derived', ev: ['s_cash'] }], like: ['c1'], dislike: ['c2'], unsure: [] });
            if (ops.includes('lend')) im.push({ opt: 'lend', params: { amount: input.options.find(o => o.opt === 'lend').params.amount.requested }, expect: [{ what: '對方說會還', who: [], status: 'inferred', ev: ['v_promise'] }], like: ['c2'], dislike: ['c1'], unsure: ['不知道會不會還'] });
            return { label: 'TEST_FIXTURE_HANDWRITTEN', appraisal: { contract: 1, concerns: [{ id: 'c1', what: '自己的錢', ev: ['s_cash'] }, { id: 'c2', what: '對方開口了', ev: ['o_req'] }], reading: { what: '有人來借錢', unsure: [] }, impacts: im, not_considered: ops.filter(o => !im.some(i => i.opt === o)).map(o => ({ opt: o, why: '當下沒想到' })) },
                choice: { contract: 1, opt: 'refuse', params: {}, because: ['c1'], accept: [], left: [], public: '這次不方便', private: '', commit: null, act: { opt: 'refuse' } } }; };
        const fixtures = {}; for (const x of good) fixtures[PSY.inputKey(x.input)] = fix(x.input);
        const cur = () => ser() + JSON.stringify(w.decide); let prev = cur(), still = 0; const n0 = n;
        for (let k = 0; k < 40 && still < 3; k++) { await new Promise(r => setTimeout(r, 200)); const c = cur(); still = c === prev ? still + 1 : 0; prev = c; } out.settled = still >= 3; out.bgRng = n - n0;
        const before0 = cur(); const log = new PSY.ResearchLog(); const cache = new Map(); const E = PSY.ReplayEvaluator(fixtures);
        // 評估期間換上計數用的亂數（不消耗世界的序列）；每次呼叫看堆疊，來自 D1 檔案的另外計數
        const nEval0 = n; let evRnd = 0, evRndPsy = 0; Math.random = function () { evRnd++; if (/psy-(core|world|loan|fire)\.js/.test(String(new Error().stack))) evRndPsy++; return 0.5; };
        try { for (const x of good) await PSY.evaluate(x, [E], { log, cache }); } finally { Math.random = seeded; }
        out.evRnd = evRnd; out.evRndPsy = evRndPsy; out.evSeededUsed = n - nEval0; out.logRejected = log.rejected.length;
        { const inputs = {}; for (const x of good) inputs[x.input.ids.decision] = x.input; out.spot = JSON.stringify(PSY.spotSample(log.rows, inputs, 5)); }
        out.evalStatus = log.rows.reduce((o, r) => (o[r.status + (r.from_cache ? '(快取)' : '')] = (o[r.status + (r.from_cache ? '(快取)' : '')] || 0) + 1, o), {}); out.evalNotes = log.rows.flatMap(r => r.notes); out.evalFails = log.rows.filter(r => r.status !== 'done').map(r => r.fail + JSON.stringify(r.tries));
        out.worldUnchangedByEval = before0 === cur();
        out.research = JSON.stringify(log.toJSON()); out.sample = good.length ? JSON.stringify(good[0].input) : null;
        untap(); out.untapRestored = K.options === K1; K.options = orig;
        // ---- 真實遊戲物件配對（量完隔離之後才動這個世界）----
        const adults = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18 && w.wallet?.bal?.[a.agentId] >= 25).sort((x, y) => String(x.agentId).localeCompare(String(y.agentId)));
        const L = adults[0], B = adults[1]; const e0 = PSY_LOAN.eventOf(w, L, { from: B.agentId, n: 20 });
        const S = (e) => PSY.snapshot(w, PSY_LOAN, e || e0).input; const base = S(); const P = {};
        { const v = w.wallet.bal[B.agentId]; w.wallet.bal[B.agentId] = 98765.43; const bk = w.bank?.dep?.[B.agentId]; if (w.bank?.dep) w.bank.dep[B.agentId] = 55555; const h = S(); P.hiddenSame = PSY.hashOf(h) === PSY.hashOf(base); P.hiddenNoLeak = !/98765|55555/.test(PSY.stable(h)); w.wallet.bal[B.agentId] = v; if (w.bank?.dep) { if (bk === undefined) delete w.bank.dep[B.agentId]; else w.bank.dep[B.agentId] = bk; } }
        { w.health = w.health || {}; w.health.a = w.health.a || {}; const old = w.health.a[L.agentId]; w.health.a[L.agentId] = [{ k: 'injury', s: 2, p: 'f' }]; const m = S(); P.medObl = m.self.obligations.some(o => o.amount === 60) && !base.self.obligations.some(o => o.src === 'own_body' && o.what.includes('腳')); P.medStateVer = m.versions.state !== base.versions.state; if (old === undefined) delete w.health.a[L.agentId]; else w.health.a[L.agentId] = old; }
        { const before2 = L.memory.entries.length; L.memory.add(w.tickCount, '', 'social', B.name + '準時把借的 10 銀幣還我了，這人可靠。', 4, [B.name]); const m = S(); P.memRecall = m.recall.some(x => x.text.includes('準時把借的')); P.memKnowVer = m.versions.knowledge !== base.versions.knowledge; L.memory.entries.splice(before2); }
        { const m = S(Object.assign({}, e0, { said: '家裡屋頂破了要修' })); P.saidSeen = m.seen.some(x => x.id === 'o_said' && x.src === 'heard_direct:' + B.agentId); }
        // 別人的病況：讀取器一律不讀健康表（家人、同住也一樣）；改同住者或家人的健康表，輸入不變
        { const R0 = PSY.reader(w, L.agentId); const co = R0.cohabitants(); const kin = R0.kin().map(k => k.id); P.cohabCount = co.length; P.kinCount = kin.length;
          let blocked = false; try { R0.healthOf(B.agentId); } catch (e) { blocked = e.name === 'BoundaryError'; } P.otherHealthBlocked = blocked;
          const near = [...new Set(co.concat(kin))]; const saved = near.map(id => [id, w.health?.a?.[id]]); w.health = w.health || {}; w.health.a = w.health.a || {}; for (const id of near) w.health.a[id] = [{ k: 'disease', s: 3, p: 'c' }];
          P.nearHealthHidden = PSY.hashOf(S()) === PSY.hashOf(base); P.nearCount = near.length; for (const [id, v] of saved) { if (v === undefined) delete w.health.a[id]; else w.health.a[id] = v; } }
        P.restored = PSY.hashOf(S()) === PSY.hashOf(base); out.paired = P; out.pair = { L: L.name, B: B.name };
        // ---- 第二個情境：店面失火求助（本輪暫停驗收，FIRE=1 才跑）----
        if (!FIRE) return out;
        const F = {}; const realFires = PSY_FIRE.firesInLog(w); F.realFires = realFires.length;
        const owners = Object.values(w.market?.owners || {}).filter(id => w.agents[id] && !w.agents[id].isDead);
        const fires = realFires.length ? realFires.slice(0, 3) : owners.slice(0, 3).map(id => ({ owner: id, shop: '鋪子', loss: 30, constructed: true }));
        F.used = fires.length; F.constructed = !realFires.length;
        const fsnaps = fires.map(fr => { const helper = adults.find(a => a.agentId !== fr.owner); return PSY.snapshot(w, PSY_FIRE, PSY_FIRE.eventOf(w, helper.agentId, fr, '鋪子燒了，能不能幫個忙')); });
        F.ok = fsnaps.filter(x => x.input && !PSY.validateInput(x.input).length && x.audit.rnd === 0).length;
        F.owners = [...new Set(fsnaps.flatMap(x => x.audit.manifest ? x.audit.manifest.map(m => m.owner) : []))];
        if (fsnaps[0]?.input) { const fr = fires[0]; const ow = fr.owner; const v = w.wallet.bal[ow]; w.wallet.bal[ow] = 87654.32; const h = PSY.snapshot(w, PSY_FIRE, fsnaps[0].input.ids && PSY_FIRE.eventOf(w, fsnaps[0].input.ids.agent, fr, '鋪子燒了，能不能幫個忙')); w.wallet.bal[ow] = v; F.hiddenSame = PSY.hashOf(h.input) === PSY.hashOf(fsnaps[0].input); F.noLeak = !/87654/.test(PSY.stable(h.input)); }
        const ffix = {}; for (const x of fsnaps.filter(x => x.input)) { const ops = x.input.options.map(o => o.opt); ffix[PSY.inputKey(x.input)] = { label: 'TEST_FIXTURE_HANDWRITTEN', appraisal: { contract: 1, concerns: [{ id: 'c1', what: '對方的鋪子燒了', ev: ['o_fire', 'o_req'] }], reading: { what: '有人遭遇損失來求助', unsure: [] }, impacts: [{ opt: 'labor', params: { days: 1 }, expect: [{ what: '一天不能做自己的工作', who: [x.input.ids.agent], status: 'derived', ev: ['opt:labor'] }], like: ['c1'], dislike: [], unsure: [] }], not_considered: ops.filter(o => o !== 'labor').map(o => ({ opt: o, why: '當下沒想到' })) }, choice: { contract: 1, opt: 'labor', params: { days: 1 }, because: ['c1'], accept: [], left: [], public: '我去幫你', private: '', commit: '明天去幫忙', act: { opt: 'labor', days: 1 } } }; }
        const flog = new PSY.ResearchLog(); for (const x of fsnaps.filter(x => x.input)) await PSY.evaluate(x, [PSY.ReplayEvaluator(ffix)], { log: flog }); F.evalDone = flog.rows.filter(r => r.status === 'done').length; F.sample = fsnaps[0]?.input ? JSON.stringify(fsnaps[0].input) : null;
        out.fire = F;
        return out;
    }, { DAYS, SEED, TIER, TAP: tap, AI: ai, FIRE: RUN_FIRE });
    r.errs = errs; r.extUrls = extUrls; r.apiPaths = apiPaths; await page.close(); return r;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true }); const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}); const t0 = Date.now(); const R = {};
    for (const [k, o] of [['off1', { tap: false, ai: false }], ['off2', { tap: false, ai: false }], ['on', { tap: true, ai: false }], ['aiOff1', { tap: false, ai: true }], ['aiOff2', { tap: false, ai: true }], ['aiOn', { tap: true, ai: true }]]) { R[k] = await run(browser, o); process.stderr.write(k + ' ' + Math.round((Date.now() - t0) / 1000) + 's\n'); }
    await browser.close();
    const h = (r) => ({ save: sha(r.save), decide: sha(r.decide), order: sha(r.orderNoSnap), rng: r.rng, tick: r.tick });
    for (const [label, a, b, c] of [['AI 關閉', R.off1, R.off2, R.on], ['AI 開啟（固定回應）', R.aiOff1, R.aiOff2, R.aiOn]]) {
        console.log('— ' + label + '：基線可重現（關 vs 關）');
        ok(h(a).save === h(b).save && h(a).decide === h(b).decide && a.rng === b.rng && h(a).order === h(b).order, '兩輪關閉結果逐字相同', JSON.stringify([h(a), h(b)]));
        console.log('— ' + label + '：影子開關不改變世界（關 vs 開）');
        ok(h(a).save === h(c).save, '完整存檔內容相同'); ok(h(a).decide === h(c).decide, '決策核心狀態與佇列相同'); ok(a.rng === c.rng, '亂數取用次數相同', a.rng + ' vs ' + c.rng); ok(a.tick === c.tick, 'tick 數相同');
        ok(h(a).order === h(c).order, '選項列出與執行的先後順序相同');
        console.log('— ' + label + '：快照稽核');
        ok(c.snaps > 0 && c.snapGood === c.snaps && !c.snapErr.length, '拍到快照且全部成功', 'snaps=' + c.snaps + ' picks=' + c.askedPicks + ' ' + c.snapErr.slice(0, 2).join(','));
        ok(c.snapAfterOpts === c.snapAndSkip, '每份快照（或略過紀錄）都緊接在同一請求的選項列出之後', c.snapAfterOpts + ' / ' + c.snapAndSkip);
        ok(c.runTotal > 0 && c.runCovered === c.runTotal, '每次執行之前，同一請求最近一次列出選項時都有快照或「沒變而略過」（快照在這次決定執行之前）', c.runCovered + ' / ' + c.runTotal);
        ok(c.cidEvBad === 0 && c.verBad === 0 && c.adjSame === 0 && c.supersedesOk && c.decisionsUnique, '同一請求只對應一個事件；版本連續、相鄰版本輸入不同、標明取代前一版；決策編號不重複', JSON.stringify({ cidEvBad: c.cidEvBad, verBad: c.verBad, adjSame: c.adjSame }));
        ok(c.logRejected === 0, '研究紀錄沒有收到重複回應');
        ok(c.rndInSnap === 0, '快照沒有取用亂數'); ok(c.owners.every(o => ['self', 'cohabitant', 'public'].includes(o)), '讀取清單只有本人、同住、公開', c.owners.join(','));
        ok(!c.inputErrs.length && c.oldFactsLeak === 0, '輸入通過驗證，沒有舊 prompt 的借款人現金句');
        console.log('— ' + label + '：離線評估');
        ok((c.evalStatus.done || 0) + (c.evalStatus['done(快取)'] || 0) === c.snapGood, '全部評估完成（固定回應）', JSON.stringify(c.evalStatus) + c.evalFails.slice(0, 2).join(' '));
        ok(c.settled, '評估前，遊戲自己的非同步工作已經停止'); ok(c.worldUnchangedByEval, '評估前後世界與決策核心不變'); ok(c.evRndPsy === 0, '評估期間 D1 檔案沒有呼叫亂數（逐次看呼叫堆疊）', 'evRnd=' + c.evRnd + ' psy=' + c.evRndPsy);
        ok(c.evSeededUsed === 0, '評估期間遊戲的種子亂數序列一次都沒被取用', 'used=' + c.evSeededUsed); ok(c.untapRestored, '卸下掛勾後原函式還原');
        ok(!a.errs.length && !b.errs.length && !c.errs.length, '頁面沒有錯誤', a.errs.concat(b.errs, c.errs).slice(0, 3).join(' | '));
        const ext = [a, b, c].flatMap(r => r.extUrls); ok(ext.every(u => u.startsWith('https://fonts.googleapis.com/')), '除了被擋下的字型樣式表，沒有外部請求', JSON.stringify(ext.filter(u => !u.startsWith('https://fonts.googleapis.com/'))));
    }
    console.log('— AI 開啟那組確實走到各條路徑（本機固定回應；這些是路徑有沒有被走到，不是行為結果）');
    const A = R.aiOn; ok(A.aiCalls > 0 && A.aiDecisions > 0, '決策核心呼叫了固定回應、有 AI 決定', 'aiCalls=' + A.aiCalls + ' aiDecisions=' + A.aiDecisions);
    ok(A.lagN[1] > 0 && A.lagN[2] > 0 && A.released === A.lagN[1] + A.lagN[2] && A.heldLeft === 0, '非同步返回：有隔天回、兩天後回的回應，最後全部放掉', JSON.stringify({ lag: A.lagN, released: A.released }));
    ok(A.aiMiss > 0, '有回應來得太晚、已先照個性決定（逾時路徑）', 'aiMiss=' + A.aiMiss);
    ok(A.optsTwice > 0 && A.skips > 0, '同一請求被重複列出選項，處境沒變的那幾次判定略過（去重真的被用到）', 'optsTwice=' + A.optsTwice + ' skips=' + A.skips);
    ok(A.relistOtherDay > 0, '同一請求在不同天被列出（回應隔天才到）', 'relistOtherDay=' + A.relistOtherDay);
    console.log('  （資訊）同一請求處境改變而拍新版本：' + A.versionsGt0 + ' 份' + (A.versionsGt0 ? '，改變的欄位例：' + A.versionDiff.join(' ') : '（這段期間沒有發生；版本機制由單元測試覆蓋）'));
    // 遊戲自己會發 /api/chat 等請求（AI 關閉時也有，例如鏡頭附近的對話）；測試全部在本機回空內容，沒有任何請求離開本機。D1 檔案本身沒有網路呼叫（單元測試掃原始碼）
    const chat = (r) => r.apiPaths['POST /api/chat'] || 0; console.log('  （資訊）遊戲自己發出、被本機攔下的 /api/chat：關 ' + chat(R.off1) + '、開 ' + chat(R.on) + '、AI 開啟組 開 ' + chat(R.aiOn) + '；差異來自評估前的等待期間');
    ok([R.off1, R.off2, R.on, R.aiOff1, R.aiOff2, R.aiOn].every(r => !r.extUrls.some(u => !u.startsWith('https://fonts.googleapis.com/'))), '六輪都沒有任何請求離開本機（字型樣式表以外的外部網址一律擋下，/api 一律本機回假資料）');
    console.log('— 真實遊戲物件配對（' + R.on.pair.L + ' 被 ' + R.on.pair.B + ' 開口借錢）');
    const P = R.on.paired; ok(P.hiddenSame && P.hiddenNoLeak, '只改借款人的現金與存款 → 輸入不變、數字不外洩'); ok(P.medObl && P.medStateVer, '本人腳傷 → 支出與狀態版本跟著變'); ok(P.memRecall && P.memKnowVer, '加入還款記憶 → 進入可取用記憶'); ok(P.saidSeen, '朋友說明用途 → 進入觀察');
    ok(P.otherHealthBlocked, '讀別人的健康表 → BoundaryError'); ok(P.nearHealthHidden, '同住者與家人（' + P.nearCount + ' 人）的健康表改成重病，輸入不變（沒有知情依據就不給）'); ok(P.restored, '還原後輸入回到原樣');
    const F = R.on.fire || null;
    if (RUN_FIRE) {
    console.log('— 第二個情境：店面失火求助（' + (R.on.fire.constructed ? '這段期間沒有真實失火，用產業主人建構' : '用真實失火 ' + R.on.fire.realFires + ' 件') + '）');
    ok(F.used > 0 && F.ok === F.used, '快照全部通過驗證、沒用亂數', F.ok + ' / ' + F.used); ok(F.owners.every(o => ['self', 'cohabitant', 'public'].includes(o)), '讀取清單只有本人、同住、公開', F.owners.join(','));
    ok(F.hiddenSame && F.noLeak, '只改老闆的現金 → 輸入不變'); ok(F.evalDone === F.ok, '固定回應走完兩階段（只驗流程）', F.evalDone + ' / ' + F.ok);
    } else console.log('— 第二個情境（店面失火）本輪暫停驗收，略過；FIRE=1 才跑');
    fs.writeFileSync(path.join(OUT, 'research_log.json'), R.on.research); fs.writeFileSync(path.join(OUT, 'research_log_ai.json'), R.aiOn.research);
    if (R.on.sample) fs.writeFileSync(path.join(OUT, 'sample_input.json'), JSON.stringify(JSON.parse(R.on.sample), null, 1)); if (F && F.sample) fs.writeFileSync(path.join(OUT, 'sample_fire_input.json'), JSON.stringify(JSON.parse(F.sample), null, 1));
    fs.writeFileSync(path.join(OUT, 'spot_check.json'), JSON.stringify(JSON.parse(R.on.spot), null, 1)); fs.writeFileSync(path.join(OUT, 'spot_check_ai.json'), JSON.stringify(JSON.parse(R.aiOn.spot), null, 1));
    const sm = (r) => ({ ...h(r), snaps: r.snaps, picks: r.askedPicks, requests: r.requests, runs: r.runTotal, runCovered: r.runCovered, snapWithLaterRun: r.snapWithLaterRun, skips: r.skips, versionsGt0: r.versionsGt0, versionDiff: r.versionDiff, optsTwice: r.optsTwice, relistOtherDay: r.relistOtherDay, lagN: r.lagN, released: r.released, aiMiss: r.aiMiss, aiCalls: r.aiCalls, aiDecisions: r.aiDecisions, evalStatus: r.evalStatus, evRnd: r.evRnd, evRndPsy: r.evRndPsy, evSeededUsed: r.evSeededUsed, bgRng: r.bgRng, pop: r.pop });
    const comparison = { // 影子開關比較的範圍、環境控制與排除項
        compared: ['完整存檔 world.serialize()（扣 savedAt）的 SHA-256', '決策核心狀態 JSON.stringify(w.decide)：決策紀錄、選擇統計、冷卻、佇列 q、計畫', '種子亂數取用次數', 'tick 數', '「有人來借錢」選項列出與執行的完整先後順序（含請求編號、選項編號，不含快照與略過紀錄）'],
        excluded: ['savedAt（真實時鐘）', '等 AI 回話的名單：存在決策核心私有的 WeakMap，測試讀不到，以選項列出／執行順序與 st.aiMiss 間接比較', '渲染器自己的亂數與畫面', '遊戲發出、被本機攔下的 /api 請求次數（評估前的等待期間長短不同，見 apiPaths）'],
        controls: ['Math.random 換成種子亂數並計數', 'Date.now、performance.now 換成固定步進', '重建地圖配置後清掉地圖物件殘留的住房對照與配偶表（遊戲既有問題，不是修改遊戲）', '迴圈結束設 w.paused = true，等遊戲非同步工作停止才評估', 'AI 回應只在每天開始前與收尾時釋放，之後只跑微任務（不讓計時器插隊）', '所有外部網址擋下（字型樣式表除外）；/api 一律本機回假資料'] };
    fs.writeFileSync(path.join(OUT, 'shadow_summary.json'), JSON.stringify({ comparison, fire_run: RUN_FIRE, apiPaths: { off1: R.off1.apiPaths, on: R.on.apiPaths, aiOn: R.aiOn.apiPaths }, days: DAYS, seed: SEED, tier: TIER, base: { off1: h(R.off1), off2: h(R.off2), on: sm(R.on) }, ai: { off1: h(R.aiOff1), off2: h(R.aiOff2), on: sm(R.aiOn) }, paired: P, pair: R.on.pair, fire: F ? Object.assign({}, F, { sample: undefined }) : '本輪暫停驗收，未執行', sec: Math.round((Date.now() - t0) / 1000) }, null, 1));
    console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(fails.join('\n')); process.exit(1); }
})();

