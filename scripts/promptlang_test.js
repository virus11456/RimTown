// v11.6.1 英文介面送給 AI 的題目不能夾中文
// 起因：線上英文版實測，37 筆送給 AI 的請求有 13 筆含中文——對話劇本、每日行程、臨時改行程這幾份題目有一百多句 t('中文') 沒有英文對照，
// 日報記者那一份整份寫死中文，漁夫／獵人的職稱、規則寫的告示與「私下的打算」直接把中文存成原文。
// 做法：用 scripts/prompt-lang-capture.js 固定亂數種子跑一段（模擬自己會送的題目），再直接叫出玩家動手才會送的題目（EXTRA），
//      把每一筆 /api/chat 的請求內容抓下來檢查。只看請求內容，不碰標頭。
//   1) 英文介面：沒有任何一筆含中文字；幾種主要的題目都有出現
//   2) 中文介面：同一段跑出來的題目還是中文，幾句固定的句子一字不差（這一版沒有改中文題目）
//   3) 幾個當初漏掉的地方各自重現一次（職稱、婚姻狀態、名字被切一半、規則寫的告示與打算）
// 需要本機伺服器:cd chrome-extension && python3 -m http.server 8126
const { execFileSync } = require('child_process'); const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8126/';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 600) : '')); } };
const HAN = /[㐀-鿿豈-﫿぀-ヿ㄀-ㄯ]/;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promptlang-'));
const capture = (lang) => { const out = path.join(tmp, lang + '.jsonl'); execFileSync('node', [path.join(__dirname, 'prompt-lang-capture.js'), lang, out, '11', '0', '8'], { env: { ...process.env, BASE, EXTRA: '1', REPLY: 'canned' }, stdio: 'pipe', timeout: 240000 }); return fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '');
const jwt = b64({ alg: 'HS256' }) + '.' + b64({ u: 'tester', id: 1, exp: Math.floor(Date.now() / 1000) + 86400 }) + '.sig';

(async () => {
  // ---------- 1) 英文介面 ----------
  console.log('— 英文介面：送出去的題目');
  const en = capture('en');
  const bad = en.filter(r => HAN.test(r.prompt));
  ok(en.length >= 300, `抓到夠多筆請求（${en.length}）`, en.length);
  ok(bad.length === 0, `沒有任何一筆含中文字（${bad.length}／${en.length}）`, bad.slice(0, 3).map(r => r.site + ' ' + (r.prompt.match(/[^\n]{0,30}[㐀-鿿][^\n]{0,30}/) || [''])[0]));
  ok(en.every(r => r.lang === 'en'), '每一筆都標成英文（lang=en）', [...new Set(en.map(r => r.lang))]);
  const has = (re) => en.some(r => re.test(r.prompt));
  ok(has(/^You are a gifted novelist writing a character dialogue script/) && has(/\[Important rules\]/), '對話劇本那一份有送，規則段落是英文');
  ok(has(/^You are planning a realistic day/) && has(/\[Task\] For each resident above:/) && has(/"steps": \["small action 1", "small action 2"\]/), '每日行程那一份有送，任務與輸出格式是英文');
  ok(has(/^You are "re-planning on the fly"/) && has(/\[Task\] Rewrite the schedule from now on/), '臨時改行程那一份有送');
  ok(has(/^You are "[^"]+"\. /) && has(/═══ Today's key events ═══/) && has(/Write an engaging daily paper in the first person/), '日報記者那一份整份是英文（以前整份中文）');
  ok(has(/— a real resident of .*is talking to you/) && has(/\[Reply rules\]/) && has(/\[Output format\] Follow strictly!/), '跟旅人聊天那一份有送（玩家動手才有）');
  ok(has(/You are handling a "whispered thought"/), '耳語那一份有送（玩家動手才有）');
  ok(en.filter(r => r.phase === 'extra').length >= 30, `玩家動手才會送的題目有叫出來（${en.filter(r => r.phase === 'extra').length} 筆）`);
  ok(!has(/\d yrs[A-Z]/) && !has(/Married to [A-Z][a-z]+結婚/), '年齡和職稱沒有黏在一起（32 yrsDoctor）、婚姻狀態後面沒有多一個「結婚」');

  // ---------- 2) 中文介面 ----------
  console.log('— 中文介面：題目還是原來的中文');
  const zh = capture('zh'); const zhas = (s) => zh.some(r => r.prompt.includes(s));
  ok(zh.length >= 300 && zh.every(r => r.lang === 'zh'), `抓到夠多筆請求（${zh.length}），都標成中文`);
  ok(zh.every(r => !/^You are |\[Important rules\]|\[Task\]/.test(r.prompt)), '沒有任何一筆變成英文開頭');
  ok(zhas('這是兩位小鎮居民偶然碰面的場景。請寫出生動、自然、有溫度的對話——就像真實的鄰居閒聊一樣。') && zhas('【重要規則】\n- 必須使用繁體中文（台灣用語），不可使用簡體中文\n- 絕對不要讓角色報告自己的狀態'), '對話劇本的固定句子一字不差');
  ok(zhas('【任務】為上面每一位居民：\n1. 根據昨天發生的事，把「近況」改寫成一句 40 字內的人生此刻主線') && zhas('{"plans": [{"name": "居民姓名", "currently": "...", "plan": [{"time": "06:00", "text": "時段在做什麼", "steps": ["小動作1", "小動作2"]}]}]}'), '每日行程的任務與輸出格式一字不差');
  ok(zh.some(r => /^你是「[^」]+」，/.test(r.prompt) && r.prompt.includes('你正在為邊境鎮寫今天的日報——這是小鎮裡人人都愛看的報紙！\n\n═══ 今日重要事件 ═══') && r.prompt.includes('- 繁體中文（台灣口語風格）\n- 不要用「本報記者」這種官腔')), '日報記者那一份開頭、段落標題與結尾一字不差');
  ok(zh.some(r => /歲[^\n，]{1,8}，性格/.test(r.prompt)) && zhas('已與') && zh.some(r => /已與[^\n；，。]{2,6}結婚/.test(r.prompt)), '「32歲醫生，性格…」「已與某某結婚」照舊');

  // ---------- 3) 當初漏掉的地方 ----------
  console.log('— 各個漏洞各自重現');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (lang) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/me') ? { logged_in: true, user: { id: 1, username: 'tester' } } : { saves: [], reply: '' }) }));
    await page.addInitScript(({ jwt, lang }) => { localStorage.setItem('rimtown-lang', lang); localStorage.setItem('rimtown_jwt', jwt); localStorage.setItem('rimtown_tutorial_done', '1'); localStorage.setItem('rimtown_invite_ok', '1'); localStorage.setItem('rimtown_gh_intro', '1'); localStorage.setItem('rimtown_ui_all', '1'); localStorage.setItem('rimtown_3d_quality', 'low'); }, { jwt, lang });
    await page.goto(BASE + 'town.html', { waitUntil: 'load' }); await page.waitForFunction(() => window.rimtownApp?._initReady, null, { timeout: 90000 }); if (lang === 'en') await page.evaluate(() => new Promise(r => I18N.ensureDict(r)));
    return { ctx, page, errs }; };
  const probe = () => {
    const app = window.rimtownApp; app._setPaused?.(true); clearInterval(app.simInterval); app.simInterval = null; const w = app.world; const ce = w.conversationEngine; const o = {};
    const npcs = Object.values(w.agents).filter(a => !a.isPlayer && !a.isDead && (a.age ?? 30) >= 18); const a = npcs[0], b = npcs[1];
    // 職稱：食物分工把農夫換成漁夫／獵人
    const farmer = npcs.find(x => x.job?.key === 'farmer');
    if (farmer && typeof ECON !== 'undefined' && ECON.applyRole) { ECON.applyRole(w, farmer, 'fish'); o.roleTitle = farmer.job.title; }
    a.job = a.job || new Job('farmer'); const keep = a.job.title; a.job.title = '漁夫'; o.profJob = ce._buildCharacterProfile(a).job; o.epitaph = (() => { try { return LifecycleSystem.prototype._generateEpitaph.call(w.lifecycle || {}, a); } catch (e) { return 'ERR ' + e.message; } })(); a.job.title = keep;
    // 婚姻狀態、在意的事、簡介
    const p0 = a.relationships.getPartner; a.relationships.getPartner = () => ({ status: 'married', targetName: b.name }); o.married = ce._buildCharacterProfile(a).status.split(/[;；]/)[0]; a.relationships.getPartner = () => ({ status: 'dating', targetName: b.name }); o.dating = ce._buildCharacterProfile(a).status.split(/[;；]/)[0]; a.relationships.getPartner = p0;
    const v0 = a.personality.values; a.personality.values = ['知識', '社群']; o.values = ce._buildCharacterProfile(a).values.split(/[;；]/)[0]; a.personality.values = v0;
    o.ageJob = ce._ageJob ? ce._ageJob({ age: 32, job: ce._buildCharacterProfile(a).job }) : null;
    // 隨機卡司的全名以固定卡司的名字開頭：周明哲 ⊃ 周明（Milo）
    new Agent('t_zmz', '周明哲', 30); o.nameFull = I18N.localizeNames('新居民周明哲來了', true); o.nameBack = I18N.delocalizeNames(I18N.localizeName('周明哲'));
    o.nameShort = I18N.localizeNames('周明來了', true);
    // AI 取的店名回來時人名已換回中文，登記成「中文＝中文」：整句替換要還是能把裡面的人名換成英文
    I18N.registerName("楊鋒's Quiet Brew", "楊鋒's Quiet Brew"); o.shopName = I18N.localizeNames("我開了自己的店「楊鋒's Quiet Brew」", true); o.shopBack = I18N.delocalizeNames("Felix's Quiet Brew");
    // 規則寫的「私下的打算」與告示：存成樣板，不是原文
    const flatKinds = (x) => x == null ? 'null' : typeof x === 'string' ? 'string' : x.raw != null ? 'raw' : x.k ? 'k' : '?';
    o.scheme = []; o.board = [];
    if (typeof SCHEME !== 'undefined' && SCHEME.ruleInvent) for (let i = 0; i < 300; i++) { const r = SCHEME.ruleInvent(w, npcs[i % npcs.length]); if (r) o.scheme.push(flatKinds(r.title) + '/' + flatKinds(r.why)); }
    if (typeof BOARD !== 'undefined' && BOARD.ruleWrite) for (let i = 0; i < 300; i++) { const r = BOARD.ruleWrite(w, npcs[i % npcs.length]); if (r) o.board.push(flatKinds(r.text) + '/' + flatKinds(r.why)); }
    o.scheme = [...new Set(o.scheme)]; o.board = [...new Set(o.board)];
    // 截字前先換人名：決策核心的「近況／鎮上」每句有字數上限
    o.buzzKey = t('{x}：{y}');
    return o;
  };
  { const { ctx, page, errs } = await open('en'); const o = await page.evaluate(probe);
    ok(o.roleTitle === 'Fisher', '農夫改去捕魚，職稱存的是英文（Fisher）', o.roleTitle);
    ok(o.profJob === 'Fisher', '舊存檔裡存成中文的職稱（漁夫），放進題目時翻成英文', o.profJob);
    ok(typeof o.epitaph === 'string' && /Fisher/.test(o.epitaph) && !HAN.test(o.epitaph), '墓誌銘裡的職稱是英文', o.epitaph);
    ok(/^Married to \S+$/.test(o.married) && /^Dating \S+$/.test(o.dating) && !/結婚|交往|dating$/.test(o.married + o.dating), '婚姻狀態：Married to X／Dating X，後面沒有多餘的字（名字送出前才換成英文）', [o.married, o.dating]);
    ok(o.values === 'Knowledge, Community', '在意的事（存中文）翻成英文', o.values);
    ok(/^32-year-old [A-Z]/.test(o.ageJob || ''), '年齡與職稱：32-year-old Farmer', o.ageJob);
    ok(!HAN.test(o.nameFull.replace('新居民', '').replace('來了', '')) && o.nameBack === '周明哲', '「周明哲」整個換成英文名，換得回來（以前變成 Milo哲）', [o.nameFull, o.nameBack]);
    ok(/^Milo/.test(o.nameShort), '「周明」還是 Milo', o.nameShort);
    ok(/Felix's Quiet Brew/.test(o.shopName) && !/楊鋒/.test(o.shopName) && o.shopBack === "楊鋒's Quiet Brew", 'AI 取的店名裡的人名換得成英文、也換得回來（以前永遠是「楊鋒\'s Quiet Brew」）', [o.shopName, o.shopBack]);
    ok(o.scheme.length > 0 && o.scheme.every(x => !/string|raw/.test(x)), '規則寫的打算：標題與理由都是樣板', o.scheme);
    ok(o.board.length > 0 && o.board.every(x => !/string|raw/.test(x)), '規則寫的告示與信：內容與理由都是樣板', o.board);
    ok(o.buzzKey === '{x}: {y}', '「我聽說了某某：想法」這條記憶樣板有英文', o.buzzKey);
    ok(errs.length === 0, '英文頁面沒有程式錯誤', errs.slice(0, 3)); await ctx.close(); }
  { const { ctx, page, errs } = await open('zh'); const o = await page.evaluate(probe);
    ok(o.roleTitle === '漁夫' && o.profJob === '漁夫', '中文：職稱照舊是漁夫', [o.roleTitle, o.profJob]);
    ok(/^已與.+結婚$/.test(o.married) && /^正在與.+交往$/.test(o.dating), '中文：已與某某結婚／正在與某某交往', [o.married, o.dating]);
    ok(o.values === '知識、社群', '中文：在意的事照舊', o.values);
    ok(/^32歲/.test(o.ageJob || ''), '中文：32歲農夫', o.ageJob);
    ok(errs.length === 0, '中文頁面沒有程式錯誤', errs.slice(0, 3)); await ctx.close(); }
  await browser.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
